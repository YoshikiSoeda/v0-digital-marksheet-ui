-- ============================================================
-- Migration: Add test_session_id to rooms, students, teachers,
-- patients, attendance_records, exam_results
-- ============================================================

-- 1. Add test_session_id column (nullable initially) to all 6 tables
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id);
ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id);

-- 2. Migrate existing data: set all to "2025-12テスト実施" session
UPDATE rooms SET test_session_id = 'e141b09e-21a6-4a8d-a650-db12da1d081a' WHERE test_session_id IS NULL;
UPDATE students SET test_session_id = 'e141b09e-21a6-4a8d-a650-db12da1d081a' WHERE test_session_id IS NULL;
UPDATE teachers SET test_session_id = 'e141b09e-21a6-4a8d-a650-db12da1d081a' WHERE test_session_id IS NULL;
UPDATE patients SET test_session_id = 'e141b09e-21a6-4a8d-a650-db12da1d081a' WHERE test_session_id IS NULL;
UPDATE attendance_records SET test_session_id = 'e141b09e-21a6-4a8d-a650-db12da1d081a' WHERE test_session_id IS NULL;
UPDATE exam_results SET test_session_id = 'e141b09e-21a6-4a8d-a650-db12da1d081a' WHERE test_session_id IS NULL;

-- 3. Set NOT NULL after data migration
ALTER TABLE rooms ALTER COLUMN test_session_id SET NOT NULL;
ALTER TABLE students ALTER COLUMN test_session_id SET NOT NULL;
ALTER TABLE teachers ALTER COLUMN test_session_id SET NOT NULL;
ALTER TABLE patients ALTER COLUMN test_session_id SET NOT NULL;
ALTER TABLE attendance_records ALTER COLUMN test_session_id SET NOT NULL;
ALTER TABLE exam_results ALTER COLUMN test_session_id SET NOT NULL;

-- 4. Drop old UNIQUE constraints and create new ones with test_session_id

-- rooms: (room_number, university_code, subject_code) -> add test_session_id
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_number_university_code_subject_code_key;
ALTER TABLE rooms ADD CONSTRAINT rooms_unique_per_session 
  UNIQUE (room_number, university_code, subject_code, test_session_id);

-- students: (student_id) -> (student_id, test_session_id)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_student_id_key;
ALTER TABLE students ADD CONSTRAINT students_unique_per_session 
  UNIQUE (student_id, test_session_id);

-- teachers: (email) -> (email, test_session_id)
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_email_key;
ALTER TABLE teachers ADD CONSTRAINT teachers_unique_per_session 
  UNIQUE (email, test_session_id);

-- patients: (email) -> (email, test_session_id)
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_email_key;
ALTER TABLE patients ADD CONSTRAINT patients_unique_per_session 
  UNIQUE (email, test_session_id);

-- attendance_records: (student_id, room_number) -> add test_session_id
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS unique_student_room;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_unique_per_session 
  UNIQUE (student_id, room_number, test_session_id);

-- exam_results: (student_id, evaluator_email, evaluator_type, room_number) -> add test_session_id
ALTER TABLE exam_results DROP CONSTRAINT IF EXISTS exam_results_unique_evaluation;
ALTER TABLE exam_results ADD CONSTRAINT exam_results_unique_per_session 
  UNIQUE (student_id, evaluator_email, evaluator_type, room_number, test_session_id);

-- 5. Add index for fast lookups by test_session_id
CREATE INDEX IF NOT EXISTS idx_rooms_test_session ON rooms(test_session_id);
CREATE INDEX IF NOT EXISTS idx_students_test_session ON students(test_session_id);
CREATE INDEX IF NOT EXISTS idx_teachers_test_session ON teachers(test_session_id);
CREATE INDEX IF NOT EXISTS idx_patients_test_session ON patients(test_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_test_session ON attendance_records(test_session_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_test_session ON exam_results(test_session_id);
