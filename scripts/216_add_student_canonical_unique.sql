-- ADR-004 Phase B-2-a (script 216): students に (university_code, student_id) UNIQUE 制約を追加
--
-- 背景:
--   ADR-004 で students を canonical (大学+学籍番号で一意) なマスターテーブルに変える方針。
--   その前提として、(university_code, student_id) で UNIQUE であることを DB レベルで保証する。
--
-- 前提:
--   scripts/215 で重複統合済み (2026-05-03 時点では重複なしのため no-op)
--
-- 適用後の影響:
--   なし(現状データは既に一意)。今後、同一大学で同じ学籍番号を重複登録しようとすると
--   23505 unique_violation で拒否される。これが canonical 化の入口。
--
-- ロールバック:
--   ALTER TABLE public.students DROP CONSTRAINT students_canonical_unique;

-- 防御的に、適用前に重複再確認
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM (
    SELECT university_code, student_id, count(*) AS c
    FROM public.students
    GROUP BY university_code, student_id
    HAVING count(*) > 1
  ) sub;
  IF cnt > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % duplicate (university_code, student_id) groups found. Run scripts/215 first.', cnt;
  END IF;
END $$;

ALTER TABLE public.students
  ADD CONSTRAINT students_canonical_unique
  UNIQUE (university_code, student_id);

COMMENT ON CONSTRAINT students_canonical_unique ON public.students IS
  'ADR-004 Phase B-2-a: 大学 + 学籍番号で 1 学生 = 1 行 (canonical)。同一学生は assignments テーブルで複数 test_session に紐づく。';

-- 検証
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_constraint
  WHERE conrelid = 'public.students'::regclass
    AND conname  = 'students_canonical_unique';
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'Migration failed: students_canonical_unique not present';
  END IF;
  RAISE NOTICE 'OK: students_canonical_unique added';
END $$;
