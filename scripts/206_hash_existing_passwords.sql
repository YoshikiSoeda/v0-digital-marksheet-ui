-- Phase 8: 既存の平文パスワードを bcrypt ハッシュ化(冪等)
-- pgcrypto の crypt() が返すハッシュは "$2a$" もしくは "$2b$" で始まるため、
-- 既にハッシュ化済みの行はスキップして二重ハッシュを防ぐ。

-- admins
UPDATE admins
SET password = crypt(password, gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password !~ '^\$2[ab]\$';

-- teachers
UPDATE teachers
SET password = crypt(password, gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password !~ '^\$2[ab]\$';

-- patients
UPDATE patients
SET password = crypt(password, gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password !~ '^\$2[ab]\$';

-- 確認: 全行がハッシュ化されているか
SELECT
  'admins' AS table_name,
  COUNT(*) FILTER (WHERE password ~ '^\$2[ab]\$') AS hashed,
  COUNT(*) FILTER (WHERE password !~ '^\$2[ab]\$' AND password IS NOT NULL) AS plaintext_remaining,
  COUNT(*) FILTER (WHERE password IS NULL) AS null_password
FROM admins
UNION ALL
SELECT 'teachers', COUNT(*) FILTER (WHERE password ~ '^\$2[ab]\$'), COUNT(*) FILTER (WHERE password !~ '^\$2[ab]\$' AND password IS NOT NULL), COUNT(*) FILTER (WHERE password IS NULL) FROM teachers
UNION ALL
SELECT 'patients', COUNT(*) FILTER (WHERE password ~ '^\$2[ab]\$'), COUNT(*) FILTER (WHERE password !~ '^\$2[ab]\$' AND password IS NOT NULL), COUNT(*) FILTER (WHERE password IS NULL) FROM patients;
