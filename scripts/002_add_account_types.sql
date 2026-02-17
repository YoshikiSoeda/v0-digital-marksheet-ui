-- アカウントタイプの追加とスペシャルマスターアカウントの作成

-- 1. adminsテーブルにaccount_typeカラムを追加
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'admin';

-- account_typeに制約を追加
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'admins_check_account_type'
  ) THEN
    ALTER TABLE admins
    ADD CONSTRAINT admins_check_account_type 
    CHECK (account_type IN ('special_master', 'university_master', 'admin'));
  END IF;
END $$;

-- 2. teachersテーブルにaccount_typeカラムを追加（将来的な拡張用）
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'teacher';

-- 3. patientsテーブルにaccount_typeカラムを追加（将来的な拡張用）
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'patient';

-- 4. スペシャルマスターアカウントの作成
INSERT INTO admins (
  id,
  name,
  email,
  password,
  account_type,
  university_codes,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'スペシャルマスター',
  'ediand@system.local',
  'ediand',
  'special_master',
  ARRAY['ALL']::text[],
  NOW(),
  NOW()
)
ON CONFLICT (email) 
DO UPDATE SET
  account_type = 'special_master',
  university_codes = ARRAY['ALL']::text[],
  password = 'ediand',
  updated_at = NOW();

-- 5. 既存の管理者アカウントに大学コードを設定（dentshowa）
UPDATE admins
SET 
  university_codes = ARRAY['dentshowa']::text[],
  account_type = 'admin',
  updated_at = NOW()
WHERE email != 'ediand@system.local'
  AND (university_codes IS NULL OR university_codes = '{}' OR 'dentshowa' != ALL(university_codes));

-- 6. インデックスの作成
CREATE INDEX IF NOT EXISTS idx_admins_account_type ON admins(account_type);
CREATE INDEX IF NOT EXISTS idx_admins_university_codes ON admins USING GIN(university_codes);

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'Account types added successfully to admins, teachers, and patients tables';
  RAISE NOTICE 'Special master account created: email=ediand@system.local, password=ediand';
  RAISE NOTICE 'Existing admin accounts updated with university code: dentshowa';
END $$;
