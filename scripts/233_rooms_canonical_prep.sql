-- scripts/233: rooms canonical 移行の準備 (ADR-007 C-7 第一段)
--
-- 背景:
--   ADR-007 C-7 で rooms を完全 canonical (1 大学 + 1 部屋番号 = 1 行) にする
--   方針だが、現状以下の制約が残っている:
--     1. rooms.test_session_id が NOT NULL → session を持たない部屋を作れない
--     2. rooms_unique_per_session (room_number, university_code, subject_code,
--        test_session_id) が rooms_canonical_unique (university_code, room_number)
--        と重複しており、より弱い側として無意味
--   この PR では物理的な DROP COLUMN は行わず、NULL 化と redundant UNIQUE の
--   除去のみ実施。実際の DROP COLUMN は本番安定 1〜2 週後の C-7 後段で。
--
-- 影響:
--   - room-management.tsx で session 未選択でも部屋を作れる(POST /api/rooms が
--     test_session_id: null で受け取れる)
--   - 既存行 (test_session_id を持つ) は変更されない
--   - rooms_canonical_unique のみが UNIQUE 制約として機能
--
-- ロールバック:
--   ALTER TABLE rooms ALTER COLUMN test_session_id SET NOT NULL;
--     -- 既存に NULL があれば事前 backfill が必要
--   ALTER TABLE rooms ADD CONSTRAINT rooms_unique_per_session
--     UNIQUE (room_number, university_code, subject_code, test_session_id);

-- 1) rooms.test_session_id を NULLABLE に
ALTER TABLE rooms ALTER COLUMN test_session_id DROP NOT NULL;

-- 2) redundant な rooms_unique_per_session を DROP
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_unique_per_session;

-- 動作確認 (rooms_canonical_unique のみ残り、test_session_id は YES が出る想定):
SELECT con.conname, pg_get_constraintdef(con.oid) AS def
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'rooms' AND con.contype = 'u';

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'test_session_id';
