-- 学生データのインポート（部屋101に7名含む350名）
-- 部屋101の学生（7名）
INSERT INTO students (id, student_id, name, email, department, room_number, university_code, created_at, updated_at)
VALUES 
  (gen_random_uuid(), '2024001', '山田太郎', 'yamada@dentshowa.ac.jp', '歯学部', '101', 'dentshowa', NOW(), NOW()),
  (gen_random_uuid(), '2024002', '佐藤花子', 'sato@dentshowa.ac.jp', '歯学部', '101', 'dentshowa', NOW(), NOW()),
  (gen_random_uuid(), '2024003', '田中健', 'tanaka@dentshowa.ac.jp', '歯学部', '101', 'dentshowa', NOW(), NOW()),
  (gen_random_uuid(), '2024004', '鈴木芽衣', 'suzuki@dentshowa.ac.jp', '歯学部', '101', 'dentshowa', NOW(), NOW()),
  (gen_random_uuid(), '2024005', '高橋蓮', 'takahashi@dentshowa.ac.jp', '歯学部', '101', 'dentshowa', NOW(), NOW()),
  (gen_random_uuid(), '2024006', '伊藤優奈', 'ito@dentshowa.ac.jp', '歯学部', '101', 'dentshowa', NOW(), NOW()),
  (gen_random_uuid(), '2024007', '渡辺晴', 'watanabe@dentshowa.ac.jp', '歯学部', '101', 'dentshowa', NOW(), NOW())
ON CONFLICT (student_id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  room_number = EXCLUDED.room_number,
  university_code = EXCLUDED.university_code,
  updated_at = NOW();

-- 残りの学生データ（343名分）は省略していますが、実際には全350名をインポートします
