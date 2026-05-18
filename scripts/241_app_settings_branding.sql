-- scripts/241: app_settings テーブル新設 + branding 初期値 seed
--
-- 副田さん依頼: アイコン付タイトルを special_master が変更できる機能。
--
-- スキーマ:
--   key:        text (PRIMARY KEY)
--   value:      jsonb
--   updated_at: timestamptz
--   updated_by: text (special_master の email)
--
-- branding の value 形式:
--   { "title": "医療面接評価システム", "icon": "🏥" }
--
-- セキュリティ:
--   RLS 有効。anon/authenticated は read 不可、書き込み不可。
--   全アクセスは API ルート (service role) 経由。
--
-- ロールバック:
--   DROP TABLE app_settings;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 初期 branding seed (現状の値)
INSERT INTO app_settings (key, value, updated_by)
VALUES (
  'branding',
  '{"title": "医療面接評価システム", "icon": "🏥"}'::jsonb,
  'system'
)
ON CONFLICT (key) DO NOTHING;

-- 確認
SELECT * FROM app_settings;
