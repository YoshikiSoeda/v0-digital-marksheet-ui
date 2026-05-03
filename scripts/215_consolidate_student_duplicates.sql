-- ADR-004 Phase B-2-a (script 215): students の重複統合
--
-- 結論: スキップ (2026-05-03 時点で重複なし)
--
-- 確認結果(本番 DB 2026-05-03):
--   total students = 703
--   distinct (university_code, student_id) = 703
--   → 重複ゼロ。統合作業不要。
--
-- 本ファイルは ADR-004 の連番を維持するためのプレースホルダー。
-- 将来重複が発生した場合(test_session 跨ぎで同一学生が異なる name/email で登録された等)、
-- このファイルを実装してから scripts/216 の UNIQUE 制約適用を再試行する。

-- 現状チェック(将来再実行用)
DO $$
DECLARE
  total_count int;
  distinct_count int;
BEGIN
  SELECT count(*) INTO total_count FROM public.students;
  SELECT count(DISTINCT (university_code, student_id)) INTO distinct_count FROM public.students;

  IF total_count <> distinct_count THEN
    RAISE EXCEPTION 'students has duplicates: total=%, distinct(univ, student_id)=% — manual consolidation required before scripts/216',
      total_count, distinct_count;
  END IF;

  RAISE NOTICE 'OK: no duplicates (total=%, distinct=%)', total_count, distinct_count;
END $$;
