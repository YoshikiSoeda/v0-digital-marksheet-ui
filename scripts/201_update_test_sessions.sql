-- 1. Rename description for test_code '2025-12テスト実施'
UPDATE test_sessions
SET description = '202512 全身の医療面接評価'
WHERE test_code = '2025-12テスト実施'
  AND test_date = '2025-12-01';

-- 2. Delete test session with test_code starting with 'TEST-2025-11-bb26a6'
DELETE FROM test_sessions
WHERE test_code LIKE 'TEST-2025-11-bb26a6%';
