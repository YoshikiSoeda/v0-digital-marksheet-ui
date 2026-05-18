-- scripts/243: branding 用 Storage バケット作成
--
-- 副田さん依頼: ブランドアイコンを画像アップロードできるようにする。
--
-- バケット: branding-icons
--   - public read (HTML <img> から直接参照するため)
--   - file_size_limit: 1 MB
--   - 許可 MIME: image/png, image/jpeg, image/svg+xml, image/webp
--   - write は service role 経由のみ (API ルートが代行)
--
-- ロールバック:
--   DELETE FROM storage.objects WHERE bucket_id='branding-icons';
--   DELETE FROM storage.buckets WHERE id='branding-icons';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding-icons',
  'branding-icons',
  true,
  1048576,
  ARRAY['image/png','image/jpeg','image/svg+xml','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
