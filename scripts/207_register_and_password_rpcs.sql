-- ============================================================
-- Phase 8c: Registration & password update RPCs
-- ============================================================
-- Phase 8 (verify_*_login) の対になる、書き込み側の RPC。
-- API ルートから service role で呼ばれ、平文 password を bcrypt 化して保存する。
-- 既に bcrypt ($2a$ / $2b$ プレフィックス) のものはそのまま据置(再ハッシュしない)。

-- ------------------------------------------------------------
-- 内部ヘルパ: 平文だけハッシュ化、すでに hash 済みなら据置
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hash_password_if_plain(p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_password IS NULL OR p_password = '' THEN
    RETURN p_password;
  END IF;
  IF p_password ~ '^\$2[ab]\$' THEN
    RETURN p_password; -- already bcrypt
  END IF;
  RETURN extensions.crypt(p_password, extensions.gen_salt('bf', 10));
END $$;

-- ------------------------------------------------------------
-- register_teachers_bulk
--   入力: jsonb 配列。各要素は teachers テーブルの 1 行に相当する。
--   挙動: ON CONFLICT (email, test_session_id) DO UPDATE で upsert。
--         password は hash_password_if_plain を通してから書く。
--   戻値: 影響を受けた行数(jsonb で {"upserted": N})
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_teachers_bulk(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec jsonb;
  cnt integer := 0;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'array' THEN
    RAISE EXCEPTION 'p_data must be a JSONB array';
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
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
      NULLIF(rec->>'assigned_room_number', ''),
      NULLIF(rec->>'subject_code', ''),
      COALESCE(NULLIF(rec->>'university_code', ''), 'dentshowa'),
      NULLIF(rec->>'account_type', ''),
      NULLIF(rec->>'test_session_id', '')::uuid
    )
    ON CONFLICT (email, test_session_id) DO UPDATE SET
      name = EXCLUDED.name,
      password = public.hash_password_if_plain(EXCLUDED.password),
      role = EXCLUDED.role,
      assigned_room_number = EXCLUDED.assigned_room_number,
      subject_code = EXCLUDED.subject_code,
      university_code = EXCLUDED.university_code,
      account_type = COALESCE(EXCLUDED.account_type, public.teachers.account_type),
      updated_at = now();
    cnt := cnt + 1;
  END LOOP;

  RETURN jsonb_build_object('upserted', cnt);
END $$;

-- ------------------------------------------------------------
-- register_patients_bulk (同等)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_patients_bulk(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec jsonb;
  cnt integer := 0;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'array' THEN
    RAISE EXCEPTION 'p_data must be a JSONB array';
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
    INSERT INTO public.patients (
      name, email, password, role,
      assigned_room_number, subject_code, university_code,
      account_type, test_session_id
    )
    VALUES (
      rec->>'name',
      rec->>'email',
      public.hash_password_if_plain(rec->>'password'),
      rec->>'role',
      NULLIF(rec->>'assigned_room_number', ''),
      NULLIF(rec->>'subject_code', ''),
      COALESCE(NULLIF(rec->>'university_code', ''), 'dentshowa'),
      NULLIF(rec->>'account_type', ''),
      NULLIF(rec->>'test_session_id', '')::uuid
    )
    ON CONFLICT (email, test_session_id) DO UPDATE SET
      name = EXCLUDED.name,
      password = public.hash_password_if_plain(EXCLUDED.password),
      role = EXCLUDED.role,
      assigned_room_number = EXCLUDED.assigned_room_number,
      subject_code = EXCLUDED.subject_code,
      university_code = EXCLUDED.university_code,
      account_type = COALESCE(EXCLUDED.account_type, public.patients.account_type),
      updated_at = now();
    cnt := cnt + 1;
  END LOOP;

  RETURN jsonb_build_object('upserted', cnt);
END $$;

-- ------------------------------------------------------------
-- update_user_password
--   email を持つ teacher または patient の password を bcrypt 化して UPDATE。
--   戻値: jsonb {"updated": "teachers"|"patients"|null}
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_password(p_email TEXT, p_password TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hashed TEXT;
  v_count integer;
BEGIN
  IF p_email IS NULL OR p_email = '' OR p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'email and password are required';
  END IF;

  v_hashed := public.hash_password_if_plain(p_password);

  UPDATE public.teachers
     SET password = v_hashed, updated_at = now()
   WHERE email = p_email;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RETURN jsonb_build_object('updated', 'teachers', 'rows', v_count);
  END IF;

  UPDATE public.patients
     SET password = v_hashed, updated_at = now()
   WHERE email = p_email;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RETURN jsonb_build_object('updated', 'patients', 'rows', v_count);
  END IF;

  RETURN jsonb_build_object('updated', NULL, 'rows', 0);
END $$;

-- ------------------------------------------------------------
-- 権限付与: anon は呼べない / service role と authenticated に GRANT
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.register_teachers_bulk(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_patients_bulk(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_password(TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_teachers_bulk(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_patients_bulk(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_user_password(TEXT, TEXT) TO service_role;
