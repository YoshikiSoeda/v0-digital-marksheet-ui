-- Phase 8: 既存の平文パスワードを bcrypt ハッシュ化(冪等)
-- pgcrypto は extensions スキーマにあるため extensions.crypt / extensions.gen_salt を使う。
-- 既にハッシュ化済みの行はスキップ。

UPDATE admins
SET password = extensions.crypt(password, extensions.gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password !~ '^\$2[ab]\$';

UPDATE teachers
SET password = extensions.crypt(password, extensions.gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password !~ '^\$2[ab]\$';

UPDATE patients
SET password = extensions.crypt(password, extensions.gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password !~ '^\$2[ab]\$';

-- 確認
SELECT 'admins' AS table_name,
  COUNT(*) FILTER (WHERE password ~ '^\$2[ab]\$') AS hashed,
  COUNT(*) FILTER (WHERE password !~ '^\$2[ab]\$' AND password IS NOT NULL) AS plaintext_remaining,
  COUNT(*) FILTER (WHERE password IS NULL) AS null_password
FROM admins
UNION ALL
SELECT 'teachers',
  COUNT(*) FILTER (WHERE password ~ '^\$2[ab]\$'),
  COUNT(*) FILTER (WHERE password !~ '^\$2[ab]\$' AND password IS NOT NULL),
  COUNT(*) FILTER (WHERE password IS NULL)
FROM teachers
UNION ALL
SELECT 'patients',
  COUNT(*) FILTER (WHERE password ~ '^\$2[ab]\$'),
  COUNT(*) FILTER (WHERE password !~ '^\$2[ab]\$' AND password IS NOT NULL),
  COUNT(*) FILTER (WHERE password IS NULL)
FROM patients;
