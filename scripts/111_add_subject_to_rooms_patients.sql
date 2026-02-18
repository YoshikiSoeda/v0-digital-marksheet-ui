-- Phase 1: Add subject_code to rooms, patients, attendance_records
-- This links rooms, patients, and attendance under subjects in the hierarchy:
-- university -> subject -> rooms/teachers/students/tests

-- 1. rooms テーブルに subject_code 追加
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS subject_code VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_rooms_subject_code ON rooms(subject_code);

-- 2. patients テーブルに subject_code 追加
ALTER TABLE patients ADD COLUMN IF NOT EXISTS subject_code VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_patients_subject_code ON patients(subject_code);

-- 3. attendance_records テーブルに subject_code 追加
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS subject_code VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_attendance_subject_code ON attendance_records(subject_code);

-- 4. 既存データにデフォルト教科コードを設定
-- rooms: university_code を元にデフォルト教科を割り当て
UPDATE rooms r
SET subject_code = CONCAT(r.university_code, '_GENERAL')
WHERE r.subject_code IS NULL AND r.university_code IS NOT NULL;

-- patients: university_code を元にデフォルト教科を割り当て
UPDATE patients p
SET subject_code = CONCAT(p.university_code, '_GENERAL')
WHERE p.subject_code IS NULL AND p.university_code IS NOT NULL;

-- attendance_records: 関連するテストセッションのsubject_codeを割り当て
UPDATE attendance_records ar
SET subject_code = ts.subject_code
FROM test_sessions ts
WHERE ar.test_session_id = ts.id
AND ar.subject_code IS NULL
AND ts.subject_code IS NOT NULL;

SELECT 'Migration 111 completed: subject_code added to rooms, patients, attendance_records' as status;
