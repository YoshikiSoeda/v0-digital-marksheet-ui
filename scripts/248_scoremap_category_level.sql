-- 2026-07-11 副田さん要望: 配点設定をカテゴリー単位に移動
-- ==============================================================
-- 背景:
--   Phase 2/3 では sheet 単位 → 問題単位と配点 UI を移してきたが、副田さんの
--   正しい仕様は「カテゴリー単位で設定し、カテゴリー全体に反映。問題ごとは右端
--   ボタンで個別上書き」だった。
--
-- 変更点:
--   1. categories.score_map (jsonb): カテゴリー単位の配点配列 (例 [1,3,5])
--   2. 既存カテゴリーには親シートの score_map をコピー (実質すべて [1,2,3,4,5])
--
-- resolution 優先順位 (application 側):
--   question.score_map > category.score_map > [1,2,3,4,5]
--
-- ロールバック手順:
--   ALTER TABLE public.categories DROP COLUMN IF EXISTS score_map;

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS score_map jsonb;

-- 既存カテゴリーに親シートの score_map をコピー (無ければ [1,2,3,4,5])
UPDATE public.categories c
SET score_map = COALESCE(s.score_map, '[1,2,3,4,5]'::jsonb)
FROM public.sheets s
WHERE c.sheet_id = s.id
  AND c.score_map IS NULL;

-- 親シートが取れなかった残り (念のため) にもデフォルトを設定
UPDATE public.categories
SET score_map = '[1,2,3,4,5]'::jsonb
WHERE score_map IS NULL;

COMMIT;
