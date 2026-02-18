-- テストセッション（テストコード）管理テーブルを作成
CREATE TABLE IF NOT EXISTS test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code TEXT NOT NULL UNIQUE,
  test_date DATE NOT NULL,
  description TEXT,
  university_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- testsテーブルにtest_session_idカラムを追加
ALTER TABLE tests ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE;

-- 既存のtestsデータに対してデフォルトのtest_sessionを作成
DO $$
DECLARE
  test_record RECORD;
  session_id UUID;
BEGIN
  FOR test_record IN SELECT id, title, university_code, created_at FROM tests WHERE test_session_id IS NULL
  LOOP
    -- 各testに対してデフォルトのtest_sessionを作成
    INSERT INTO test_sessions (test_code, test_date, description, university_code, created_at, updated_at)
    VALUES (
      'TEST-' || EXTRACT(YEAR FROM test_record.created_at) || '-' || LPAD(EXTRACT(MONTH FROM test_record.created_at)::TEXT, 2, '0') || '-' || SUBSTRING(test_record.id::TEXT, 1, 8),
      test_record.created_at::DATE,
      '既存テストから自動生成',
      test_record.university_code,
      test_record.created_at,
      test_record.created_at
    )
    RETURNING id INTO session_id;
    
    -- testをsessionに紐づける
    UPDATE tests SET test_session_id = session_id WHERE id = test_record.id;
  END LOOP;
END $$;

-- test_session_idをNOT NULLに変更
ALTER TABLE tests ALTER COLUMN test_session_id SET NOT NULL;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_tests_test_session_id ON tests(test_session_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_university_code ON test_sessions(university_code);
CREATE INDEX IF NOT EXISTS idx_test_sessions_test_code ON test_sessions(test_code);
