-- ADR-006 Phase R-2-F6-0: exam_results に max_score (評価上限点) カラムを追加
--
-- 背景:
--   ADR-006 で合格判定を絶対点 → % へ移行する方針を決定。
--   そのためには各 evaluator の総取得点 (total_score) と上限 (max_score) が必要。
--   現状 total_score のみ保存されており、max は別経路で算出する必要があった。
--
--   本マイグレーションは max_score を NULL 許容で追加し、新規評価保存時 (POST/upsert) に
--   API 側で「当該 test_id の questions 数 × 5」を計算して保存するフローに切り替える。
--   既存行は max_score = NULL のまま残し、合格判定側でフォールバック (NULL は判定スキップ)
--   する設計とする。これは ADR-006 §6 の方針通り。
--
-- 適用後の影響:
--   なし (既存 column は変更しない、API 側修正前なら NULL のまま)。
--
-- ロールバック:
--   ALTER TABLE public.exam_results DROP COLUMN max_score;

ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS max_score integer;

COMMENT ON COLUMN public.exam_results.max_score IS
  'この評価結果の評価上限点。questions 数 × 5 (5段階評価固定の前提) を /api/evaluation-results POST 時に算出して保存。NULL の行は ADR-006 % 判定でフォールバック (判定スキップ)。';

-- 検証
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='exam_results' AND column_name='max_score';
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'Migration failed: max_score column not added';
  END IF;
  RAISE NOTICE 'OK: exam_results.max_score added';
END $$;
