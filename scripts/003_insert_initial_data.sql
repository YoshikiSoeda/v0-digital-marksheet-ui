-- 大学マスターにデフォルトデータを挿入（既に存在する場合はスキップ）
INSERT INTO universities (university_code, university_name, department_name)
VALUES ('dentshowa', '昭和医科大学', '歯学部')
ON CONFLICT (university_code) DO UPDATE
SET 
  university_name = EXCLUDED.university_name,
  department_name = EXCLUDED.department_name,
  updated_at = NOW();

-- スペシャルマスターアカウントを作成（既に存在する場合はスキップ）
INSERT INTO admins (email, password, name, account_type, university_codes)
VALUES ('ediand@system.local', 'ediand', 'スペシャルマスター', 'special_master', ARRAY['ALL']::TEXT[])
ON CONFLICT (email) DO UPDATE
SET 
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  university_codes = EXCLUDED.university_codes,
  updated_at = NOW();

-- 既存データに大学コードを設定（NULLの場合のみ）
UPDATE students SET university_code = 'dentshowa' WHERE university_code IS NULL;
UPDATE teachers SET university_code = 'dentshowa' WHERE university_code IS NULL;
UPDATE patients SET university_code = 'dentshowa' WHERE university_code IS NULL;
UPDATE rooms SET university_code = 'dentshowa' WHERE university_code IS NULL;
UPDATE tests SET university_code = 'dentshowa' WHERE university_code IS NULL;
UPDATE attendance_records SET university_code = 'dentshowa' WHERE university_code IS NULL;
UPDATE exam_results SET university_code = 'dentshowa' WHERE university_code IS NULL;

-- 既存の管理者にアカウントタイプを設定（NULLの場合のみ）
UPDATE admins SET account_type = 'admin' WHERE account_type IS NULL;
UPDATE admins SET university_codes = ARRAY['dentshowa']::TEXT[] WHERE university_codes IS NULL OR cardinality(university_codes) = 0;
