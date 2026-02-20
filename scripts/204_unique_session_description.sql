-- Add UNIQUE constraint on test_sessions.description
ALTER TABLE test_sessions ADD CONSTRAINT test_sessions_description_unique UNIQUE (description);
