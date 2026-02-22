-- Add status column to test_sessions table
-- Values: 'not_started', 'in_progress', 'completed'
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started';
