-- 大学マスターテーブルの作成
CREATE TABLE IF NOT EXISTS universities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  university_code TEXT UNIQUE NOT NULL,
  university_name TEXT NOT NULL,
  department_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- デフォルト大学データを挿入
INSERT INTO universities (university_code, university_name, department_name)
VALUES ('dentshowa', '昭和医科大学', '歯学部')
ON CONFLICT (university_code) DO NOTHING;

-- 既存テーブルに university_code カラムを追加
ALTER TABLE students ADD COLUMN IF NOT EXISTS university_code TEXT DEFAULT 'dentshowa';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS university_code TEXT DEFAULT 'dentshowa';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS university_code TEXT DEFAULT 'dentshowa';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS university_code TEXT DEFAULT 'dentshowa';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS university_code TEXT DEFAULT 'dentshowa';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS university_code TEXT DEFAULT 'dentshowa';
ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS university_code TEXT DEFAULT 'dentshowa';

-- インデックスを作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_students_university_code ON students(university_code);
CREATE INDEX IF NOT EXISTS idx_teachers_university_code ON teachers(university_code);
CREATE INDEX IF NOT EXISTS idx_patients_university_code ON patients(university_code);
CREATE INDEX IF NOT EXISTS idx_rooms_university_code ON rooms(university_code);
CREATE INDEX IF NOT EXISTS idx_tests_university_code ON tests(university_code);
CREATE INDEX IF NOT EXISTS idx_attendance_university_code ON attendance_records(university_code);
CREATE INDEX IF NOT EXISTS idx_exam_results_university_code ON exam_results(university_code);

-- 管理者テーブルに university_codes カラムを追加（複数大学管理可能）
CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  university_codes TEXT[] DEFAULT ARRAY['dentshowa']::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 既存の管理者データがあれば移行（存在しない場合はスキップ）
-- この部分は実際の管理者テーブル構造に合わせて調整が必要
