-- 2026-07-10 副田さん要望 Phase 2: シート単位の N 段階配点仕様変更
-- ==============================================================
-- 変更点:
--   1. sheets.score_map (jsonb): シート単位の配点配列 (例 [1,3,5])
--   2. questions.score_map (jsonb): 問題ごとの個別上書き (Phase 3 で本格利用)
--   3. questions.alert_options: 「選択肢の値」→「選択肢の位置 (0-indexed)」に変換
--
-- 副田さん要望への対応:
--   #2 既存問題は 5 段階 / 1-5 点として自動移行 → 全 sheets に [1,2,3,4,5] を設定
--   #3 アラート対象は「選択肢の位置」で持つ → 既存 alert_options の値 V を V-1 に変換
--
-- ロールバック手順:
--   BEGIN;
--   UPDATE questions SET alert_options = (SELECT array_agg((elem+1)::int) FROM unnest(alert_options) elem WHERE elem >= 0)
--     WHERE alert_options IS NOT NULL AND cardinality(alert_options) > 0;
--   ALTER TABLE questions DROP COLUMN IF EXISTS score_map;
--   ALTER TABLE sheets DROP COLUMN IF EXISTS score_map;
--   COMMIT;

BEGIN;

-- 1. sheets.score_map 追加
ALTER TABLE public.sheets
  ADD COLUMN IF NOT EXISTS score_map jsonb;

-- 既存 sheets に 5 段階配点 [1,2,3,4,5] を自動設定
UPDATE public.sheets
SET score_map = '[1,2,3,4,5]'::jsonb
WHERE score_map IS NULL;

-- 2. questions.score_map 追加 (個別上書き、Phase 3 で活用)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS score_map jsonb;

-- 3. questions.alert_options を「値」から「位置」に変換
--    既存 [1,2,3,4,5] → [0,1,2,3,4]
UPDATE public.questions
SET alert_options = (
  SELECT array_agg((elem - 1)::int ORDER BY elem)
  FROM unnest(alert_options) elem
  WHERE elem >= 1
)
WHERE alert_options IS NOT NULL
  AND cardinality(alert_options) > 0;

COMMIT;
