-- ADR-004 Phase B-2-b (script 219): RPC \`register_student_canonical\` を作成
--
-- 背景:
--   Phase B-2-a で students は (university_code, student_id) UNIQUE な canonical テーブルになり、
--   test_session 紐付けは student_test_session_assignments で扱う構造に変えた。
--   しかし API 側 (POST /api/students) は依然として students テーブルを直接 upsert していて、
--   onConflict が \`(student_id, test_session_id)\` だったため、同じ学生を別 test_session に
--   登録するたびに students 行が増えてしまっていた。
--
--   この RPC は「学生本体の canonical upsert + assignment の upsert」を 1 つの transaction で
--   atomic に行うことで、API 側の処理をシンプルにしつつ正しい canonical 化を実現する。
--
-- 仕様:
--   - INSERT 時:
--       students に新規 INSERT (test_session_id / room_number 列も後方互換のため一旦埋める)
--       assignments にも INSERT
--   - 既存 students 行がある場合 (univ + student_id 重複):
--       students の name/email/department/grade/subject_code は最新値で UPDATE
--       students の test_session_id / room_number 列は触らない (canonical 化のため)
--       assignments には新しい (student_id, test_session_id, room_number) を upsert
--
--   → 同じ学生を別 test_session に登録しても students は 1 行、assignments が増える
--
-- セキュリティ:
--   SECURITY DEFINER。service_role からのみ呼ばれる前提なので RLS バイパスでも問題ない。
--
-- ロールバック:
--   DROP FUNCTION public.register_student_canonical(text,text,text,text,text,text,text,uuid,text);

CREATE OR REPLACE FUNCTION public.register_student_canonical(
  p_student_id      text,
  p_name            text,
  p_email           text,
  p_department      text,
  p_grade           text,
  p_university_code text,
  p_subject_code    text,
  p_test_session_id uuid,
  p_room_number     text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_uuid uuid;
BEGIN
  -- 1. canonical upsert (univ + student_id で一意)
  --    既存行があるときは text 系の人物属性のみ最新値で更新。
  --    test_session_id / room_number 列は canonical 化のため触らない (B-2-c で削除予定)。
  --    新規 INSERT のときだけ後方互換のため両列を埋める。
  INSERT INTO public.students (
    student_id, name, email, department, grade,
    university_code, subject_code,
    test_session_id, room_number
  ) VALUES (
    p_student_id, p_name, p_email, p_department, p_grade,
    p_university_code, p_subject_code,
    p_test_session_id, p_room_number
  )
  ON CONFLICT (university_code, student_id) DO UPDATE SET
    name         = EXCLUDED.name,
    email        = COALESCE(EXCLUDED.email, students.email),
    department   = COALESCE(EXCLUDED.department, students.department),
    grade        = COALESCE(EXCLUDED.grade, students.grade),
    subject_code = COALESCE(EXCLUDED.subject_code, students.subject_code),
    updated_at   = now()
  RETURNING id INTO v_student_uuid;

  -- 2. assignment upsert (test_session_id があるとき)
  IF p_test_session_id IS NOT NULL THEN
    INSERT INTO public.student_test_session_assignments (
      student_id, test_session_id, room_number
    ) VALUES (
      v_student_uuid, p_test_session_id, p_room_number
    )
    ON CONFLICT (student_id, test_session_id) DO UPDATE SET
      room_number = EXCLUDED.room_number,
      updated_at  = now();
  END IF;

  RETURN v_student_uuid;
END;
$$;

COMMENT ON FUNCTION public.register_student_canonical IS
  'ADR-004 Phase B-2-b: 学生の canonical upsert + assignment 作成を atomic に行う。POST /api/students から呼ばれる。';

GRANT EXECUTE ON FUNCTION public.register_student_canonical TO service_role;
