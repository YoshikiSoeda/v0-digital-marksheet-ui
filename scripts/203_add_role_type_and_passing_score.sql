-- Add role_type to tests table to distinguish teacher vs patient tests
ALTER TABLE tests ADD COLUMN IF NOT EXISTS role_type VARCHAR(10) DEFAULT 'teacher';

-- Set all existing tests to 'teacher' role_type
UPDATE tests SET role_type = 'teacher' WHERE role_type IS NULL;

-- Add passing_score to test_sessions for pass/fail threshold
ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS passing_score INTEGER DEFAULT NULL;
