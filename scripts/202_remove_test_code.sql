-- Remove test_code column from test_sessions table
-- test_code is no longer needed; sessions are identified by id (UUID) + description

-- First, ensure all sessions have a description (copy test_code to description where missing)
UPDATE test_sessions
SET description = test_code
WHERE description IS NULL OR description = '';

-- Drop test_code column
ALTER TABLE test_sessions DROP COLUMN IF EXISTS test_code;
