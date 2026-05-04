-- ADR-007 Phase C-3 (script 226): register_teachers_bulk を canonical 化
--
-- 背景:
--   scripts/207 で導入した register_teachers_bulk は ON CONFLICT (email, test_session_id) で
--   upsert していたため、同じ教員を別 test_session に登録するたびに teachers 行が増えていた。
--
--   Phase C-1 で teachers に (university_code, email) UNIQUE 制約と
--   teacher_test_session_assignments junction を導入済 (scripts/223)。
--
--   本スクリプトで RPC の挙動を canonical (univ + email) ON CONFLICT に変更し、
--   session 紐付けは junction に書き込むようにする。
--
-- 仕様:
--   - INSERT 時:
--       teachers に新規 INSERT (legacy test_session_id / assigned_room_number 列も後方互換のため埋める)
--       assignments にも INSERT
--   - 既存 teachers 行がある場合 (univ + email 重複):
--       teachers の name/password/role/subject_code/account_type のみ最新値で UPDATE
--       teachers の test_session_id / assigned_room_number 列は触らない (canonical 化のため)
--       assignments には新しい (teacher_id, test_session_id, assigned_room_number) を upsert
--
--   → 同じ教員を別 test_session に登録しても teachers は 1 行、assignments が増える
--
-- セキュリティ:
--   SECURITY DEFINER。service_role からのみ呼ばれる前提。
--
-- ロールバック:
--   scripts/207 の関数定義を再 apply で巻き戻し可能。

CREATE OR REPLACE FUNCTION public.register_teachers_bulk(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec jsonb;
  cnt integer := 0;
  v_teacher_id uuid;
  v_test_session_id uuid;
  v_assigned_room text;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'array' THEN
    RAISE EXCEPTION 'p_data must be a JSONB array';
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
    v_test_session_id := NULLIF(rec->>'test_session_id', '')::uuid;
    v_assigned_room   := NULLIF(rec->>'assigned_room_number', '');

    -- 1. canonical upsert (univ + email で一意)
    --    既存行がある場合は人物属性のみ最新値で更新。
    --    test_session_id / assigned_room_number 列は canonical 化のため触らない (C-7 で削除予定)。
    --    新規 INSERT のときだけ後方互換のため両列を埋める。
    INSERT INTO public.teachers (
      name, email, password, role,
      assigned_room_number, subject_code, university_code,
      account_type, test_session_id
    )
    VALUES (
      rec->>'name',
      rec->>'email',
      public.hash_password_if_plain(rec->>'password'),
      rec->>'role',
      v_assigned_room,
      NULLIF(rec->>'subject_code', ''),
      COALESCE(NULLIF(rec->>'university_code', ''), 'dentshowa'),
      NULLIF(rec->>'account_type', ''),
      v_test_session_id
    )
    ON CONFLICT (university_code, email) DO UPDATE SET
      name         = EXCLUDED.name,
      password     = public.hash_password_if_plain(EXCLUDED.password),
      role         = EXCLUDED.role,
      subject_code = COALESCE(EXCLUDED.subject_code, public.teachers.subject_code),
      account_type = COALESCE(EXCLUDED.account_type, public.teachers.account_type),
      updated_at   = now()
    RETURNING id INTO v_teacher_id;

    -- 2. assignment upsert (test_session_id があるとき)
    IF v_test_session_id IS NOT NULL THEN
      INSERT INTO public.teacher_test_session_assignments (
        teacher_id, test_session_id, assigned_room_number
      ) VALUES (
        v_teacher_id, v_test_session_id, v_assigned_room
      )
      ON CONFLICT (teacher_id, test_session_id) DO UPDATE SET
        assigned_room_number = EXCLUDED.assigned_room_number,
        updated_at           = now();
    END IF;

    cnt := cnt + 1;
  END LOOP;

  RETURN jsonb_build_object('upserted', cnt);
END $$;
