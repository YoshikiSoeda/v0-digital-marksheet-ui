-- Add subject management to the system
-- This migration adds subject (教科) fields to enable subject-based permission management

-- 1. Create subjects master table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_code VARCHAR(20) UNIQUE NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  university_code VARCHAR(20) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_subject_university FOREIGN KEY (university_code) REFERENCES universities(university_code)
);

-- 2. Add subject_code to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS subject_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS subject_role VARCHAR(20) DEFAULT 'general';

-- Add comment for subject_role values
COMMENT ON COLUMN teachers.subject_role IS 'subject_admin: 教科管理者, subject_general: 教科一般教員, subject_teacher: 教科担任（閲覧のみ）';

-- 3. Add subject_code to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS subject_code VARCHAR(20);

-- 4. Add subject_code to tests table
ALTER TABLE tests 
ADD COLUMN IF NOT EXISTS subject_code VARCHAR(20);

-- 5. Add subject_code to test_sessions table
ALTER TABLE test_sessions 
ADD COLUMN IF NOT EXISTS subject_code VARCHAR(20);

-- 6. Add subject_code to exam_results (for easier filtering)
ALTER TABLE exam_results 
ADD COLUMN IF NOT EXISTS subject_code VARCHAR(20);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_teachers_subject_code ON teachers(subject_code);
CREATE INDEX IF NOT EXISTS idx_students_subject_code ON students(subject_code);
CREATE INDEX IF NOT EXISTS idx_tests_subject_code ON tests(subject_code);
CREATE INDEX IF NOT EXISTS idx_test_sessions_subject_code ON test_sessions(subject_code);
CREATE INDEX IF NOT EXISTS idx_exam_results_subject_code ON exam_results(subject_code);

-- 8. Insert default subjects for existing universities
INSERT INTO subjects (subject_code, subject_name, university_code, description)
SELECT 
  'GENERAL', 
  '共通', 
  university_code,
  'デフォルト教科（既存データ用）'
FROM universities
ON CONFLICT (subject_code) DO NOTHING;

-- 9. Update existing data to use default subject
UPDATE teachers SET subject_code = 'GENERAL' WHERE subject_code IS NULL;
UPDATE students SET subject_code = 'GENERAL' WHERE subject_code IS NULL;
UPDATE tests SET subject_code = 'GENERAL' WHERE subject_code IS NULL;
UPDATE test_sessions SET subject_code = 'GENERAL' WHERE subject_code IS NULL;
UPDATE exam_results SET subject_code = 'GENERAL' WHERE subject_code IS NULL;

-- 10. Add foreign key constraints (after data update)
ALTER TABLE teachers 
ADD CONSTRAINT fk_teacher_subject FOREIGN KEY (subject_code) REFERENCES subjects(subject_code);

ALTER TABLE students 
ADD CONSTRAINT fk_student_subject FOREIGN KEY (subject_code) REFERENCES subjects(subject_code);

ALTER TABLE tests 
ADD CONSTRAINT fk_test_subject FOREIGN KEY (subject_code) REFERENCES subjects(subject_code);

ALTER TABLE test_sessions 
ADD CONSTRAINT fk_test_session_subject FOREIGN KEY (subject_code) REFERENCES subjects(subject_code);

-- Success message
SELECT 'Subject management tables and fields added successfully!' as status;
