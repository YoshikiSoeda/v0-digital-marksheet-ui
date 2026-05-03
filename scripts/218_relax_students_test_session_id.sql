-- ADR-004 Phase B-2-a (script 218): students.test_session_id を NOT NULL → NULLABLE に緩和
--
-- 背景:
--   ADR-004 の最終形態では students.test_session_id 列を完全削除する予定だが、
--   段階移行のため現時点では「列を残しつつ NULL 許容」に変更する。これにより:
--     - 新規の canonical 学生が test_session_id 不要で作成可能になる
--     - 既存の API / UI コードは引き続き列を読める(後方互換)
--     - 後続 PR で API / UI を assignments 経由に切り替えてから完全削除する
--
--   同時に room_number も NULL 許容のまま(元から nullable なので変更不要)。
--
-- 適用後の影響:
--   - INSERT INTO students VALUES (..., test_session_id => NULL) が許される
--   - 既存行の test_session_id 値は変更しない
--   - lib/api/students.ts は引き続き universityCode/testSessionId フィルタで読める
--
-- ロールバック:
--   バックフィルが完了している前提で:
--   ALTER TABLE public.students ALTER COLUMN test_session_id SET NOT NULL;
--   ※ NULL 行があると失敗するので注意

ALTER TABLE public.students
  ALTER COLUMN test_session_id DROP NOT NULL;

COMMENT ON COLUMN public.students.test_session_id IS
  'ADR-004 Phase B-2-a: 段階移行のため NULL 許容化。canonical な学生は NULL で作成し、test_session 紐付けは student_test_session_assignments で行う。後続 PR で完全削除予定。';

-- 検証
DO $$
DECLARE
  is_nullable text;
BEGIN
  SELECT is_nullable INTO is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'students'
    AND column_name = 'test_session_id';
  IF is_nullable <> 'YES' THEN
    RAISE EXCEPTION 'Migration failed: students.test_session_id is still %', is_nullable;
  END IF;
  RAISE NOTICE 'OK: students.test_session_id is now NULLABLE';
END $$;
