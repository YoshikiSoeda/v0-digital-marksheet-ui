-- ADR-004 Phase B-2-a (script 217): 既存 students を student_test_session_assignments に backfill
--
-- 背景:
--   scripts/213 で junction テーブル "student_test_session_assignments" を新設したが空。
--   現状の students は (id, test_session_id, room_number) を保持しているため、
--   各 students 行から 1 件ずつ assignments を生成する。
--
--   これにより、同じ学生 (= students.id) が将来別の test_session に追加で割り当てられても
--   assignments に複数行として共存できる canonical 化の前提が整う。
--
-- 適用後の影響:
--   - assignments テーブルに 703 行が追加される(2026-05-03 時点)
--   - students テーブル本体は変更しない (test_session_id / room_number はまだ持ったまま)
--   - 後続 scripts/218 で students.test_session_id を NULL 許容に緩和
--   - API/UI の段階移行が完了したら、別 PR で students から両列を完全削除
--
-- 冪等性:
--   ON CONFLICT DO NOTHING で 2 回目以降は no-op。
--
-- ロールバック:
--   DELETE FROM public.student_test_session_assignments;

INSERT INTO public.student_test_session_assignments (student_id, test_session_id, room_number, created_at, updated_at)
SELECT
  s.id,
  s.test_session_id,
  s.room_number,
  COALESCE(s.created_at, now()),
  COALESCE(s.updated_at, now())
FROM public.students s
WHERE s.test_session_id IS NOT NULL
ON CONFLICT (student_id, test_session_id) DO NOTHING;

-- 検証: students の (test_session_id 持ち行) と assignments の行数が一致するはず
DO $$
DECLARE
  expected int;
  actual int;
BEGIN
  SELECT count(*) INTO expected FROM public.students WHERE test_session_id IS NOT NULL;
  SELECT count(*) INTO actual FROM public.student_test_session_assignments;
  IF actual < expected THEN
    RAISE EXCEPTION 'Backfill incomplete: expected >= %, got %', expected, actual;
  END IF;
  RAISE NOTICE 'OK: assignments=% (students-with-session=%)', actual, expected;
END $$;
