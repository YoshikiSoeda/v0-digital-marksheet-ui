-- scripts/230: test_sessions に status 列を追加(以前は scripts/add-test-session-status.sql)
--
-- 旧名は連番外で命名規則から外れていたため、scripts/230_* に rename して整理。
-- DDL 内容は無変更(本番には適用済み、IF NOT EXISTS で再適用も安全)。
--
-- 値: 'not_started' | 'in_progress' | 'completed'
--
-- ロールバック:
--   ALTER TABLE test_sessions DROP COLUMN status;

ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started';
