-- すべてのデータを昭和医科大学（dentshowa）に紐づける
-- テスト用に神奈川歯科大学のマスターデータも追加

-- faculty_name を department_name に修正し、created_at を追加
-- 神奈川歯科大学を大学マスターに追加
INSERT INTO universities (university_code, university_name, department_name, created_at, updated_at)
VALUES ('dentkanagawa', '神奈川歯科大学', '歯学部', NOW(), NOW())
ON CONFLICT (university_code) 
DO UPDATE SET 
  university_name = EXCLUDED.university_name,
  department_name = EXCLUDED.department_name,
  updated_at = NOW();

-- 昭和医科大学を確実に登録
INSERT INTO universities (university_code, university_name, department_name, created_at, updated_at)
VALUES ('dentshowa', '昭和医科大学', '歯学部', NOW(), NOW())
ON CONFLICT (university_code) 
DO UPDATE SET 
  university_name = EXCLUDED.university_name,
  department_name = EXCLUDED.department_name,
  updated_at = NOW();

-- admins の university_codes は配列型なので修正
-- すべてのadminsを昭和医科大学に紐づける
UPDATE admins 
SET university_codes = ARRAY['dentshowa']
WHERE university_codes IS NULL OR university_codes = '{}' OR 'dentshowa' != ALL(university_codes);

-- すべてのteachersを昭和医科大学に紐づける
UPDATE teachers 
SET university_code = 'dentshowa'
WHERE university_code IS NULL OR university_code != 'dentshowa';

-- すべてのpatientsを昭和医科大学に紐づける
UPDATE patients 
SET university_code = 'dentshowa'
WHERE university_code IS NULL OR university_code != 'dentshowa';

-- すべてのstudentsを昭和医科大学に紐づける
UPDATE students 
SET university_code = 'dentshowa'
WHERE university_code IS NULL OR university_code != 'dentshowa';

-- すべてのroomsを昭和医科大学に紐づける
UPDATE rooms 
SET university_code = 'dentshowa'
WHERE university_code IS NULL OR university_code != 'dentshowa';

-- すべてのtestsを昭和医科大学に紐づける
UPDATE tests 
SET university_code = 'dentshowa'
WHERE university_code IS NULL OR university_code != 'dentshowa';

-- test_sessions, attendance_records, exam_results も追加
-- すべてのtest_sessionsを昭和医科大学に紐づける
UPDATE test_sessions 
SET university_code = 'dentshowa'
WHERE university_code IS NULL OR university_code != 'dentshowa';

-- すべてのattendance_recordsを昭和医科大学に紐づける
UPDATE attendance_records 
SET university_code = 'dentshowa'
WHERE university_code IS NULL OR university_code != 'dentshowa';

-- すべてのexam_resultsを昭和医科大学に紐づける
UPDATE exam_results 
SET university_code = 'dentshowa'
WHERE university_code IS NULL OR university_code != 'dentshowa';
