-- ADR-004 Phase B-2-c (script 220): RPC `register_student_canonical` から
-- `students.test_session_id` / `students.room_number` 列への書き込みを除去する
--
-- 背景:
--   scripts/219 で導入した RPC は students INSERT に「後方互換のため」両列を埋めていた。
--   しかし PR1 で application 層から両列の **読み取り** を全て assignments 経由に切り替えたため、
--   students 行の両列値はもう参照されず、INSERT する意味がなくなった。
--   この PR で書き込みも止め、両列を完全に「読まない・書かない」状態にする。
--
--   両列は次フェーズ (scripts/221, B-2-c PR3) で DROP COLUMN する予定。
--
-- 変更点:
--   - INSERT INTO public.students の列リストから test_session_id, room_number を除去
--   - VALUES からも p_test_session_id, p_room_number を除去
--   - パラメータ自体は保持(assignments INSERT で引き続き使う)
--   - assignments INSERT 部はそのまま据置
--
-- 互換性:
--   - 既存 students 行: 両列の値は据置される(まだ DB 列として存在)
--   - 新規 students 行: 両列は NULL で挿入される(両列とも NULLABLE 確認済)
--   - assignments 経由の roomNumber / testSessionId 取得は引き続き正常動作
--
-- ロールバック:
--   scripts/219 の関数定義をそのまま再 apply で巻き戻し可能(冪等)。

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
  --    ADR-004 Phase B-2-c: students.test_session_id / room_number は書き込まない。
  --    これらは student_test_session_assignments のみで管理する。
  INSERT INTO public.students (
    student_id, name, email, department, grade,
    university_code, subject_code
  ) VALUES (
    p_student_id, p_name, p_email, p_department, p_grade,
    p_university_code, p_subject_code
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
