-- Fixed VALUES lists to have same length - added updated_at for all rows
INSERT INTO universities (id, university_code, university_name, department_name, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'dentshowa', '昭和医科大学', '歯学部', NOW(), NOW()),
  (gen_random_uuid(), 'kanagawadent', '神奈川歯科大学', '歯学部', NOW(), NOW())
ON CONFLICT (university_code) DO NOTHING;
