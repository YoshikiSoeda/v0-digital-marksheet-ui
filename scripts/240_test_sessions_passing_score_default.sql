-- scripts/240: test_sessions.passing_score にデフォルト 70 を設定 + 既存 NULL を 70 で backfill
--
-- 背景:
--   2026-05-13 通しテストで、20260505_全身テスト の合格ライン (passing_score) が
--   NULL のまま運用されており、設定画面で空表示・dashboard 集計で合格判定がデフォルト
--   挙動になっていた。新規セッション作成時に入力忘れを防ぐため DEFAULT 70 を設定。
--
-- 影響:
--   - 既存 NULL 行 (20260505_全身テスト) は 70 に backfill
--   - 今後 INSERT INTO test_sessions (...) で passing_score を省略すると 70 が入る
--
-- ロールバック:
--   ALTER TABLE test_sessions ALTER COLUMN passing_score DROP DEFAULT;
--   UPDATE test_sessions SET passing_score=NULL WHERE id='772c4d86-871c-456e-9541-665bae83f6c0';

ALTER TABLE test_sessions
  ALTER COLUMN passing_score SET DEFAULT 70;

UPDATE test_sessions
SET passing_score = 70
WHERE passing_score IS NULL;

-- 確認
SELECT id, description, passing_score FROM test_sessions ORDER BY created_at;
