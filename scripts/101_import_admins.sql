-- 管理者アカウントのインポート
INSERT INTO admins (id, email, password, name, account_type, university_codes, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'admin', 'admin', 'システム管理者', 'special_master', ARRAY['dentshowa', 'kanagawadent'], NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  university_codes = EXCLUDED.university_codes,
  updated_at = NOW();
