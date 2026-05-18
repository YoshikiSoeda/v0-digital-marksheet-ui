-- scripts/242: universities.branding (jsonb) 列追加
--
-- 副田さん依頼: ブランド設定 (アイコン + タイトル) を大学ごとに変更可能にする。
-- NULL の大学はデフォルト「医療面接評価システム」/「🏥」で表示。
--
-- value 形式:
--   { "title": "...", "icon": "..." }
--
-- 旧 PR #119 で導入した app_settings.branding は global 1 件構成だったため
-- 本機能では参照しなくなる(テーブルは残置、別用途で後日活用可)。
--
-- ロールバック:
--   ALTER TABLE universities DROP COLUMN branding;

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS branding jsonb;

-- 確認
SELECT university_code, university_name, branding FROM universities;
