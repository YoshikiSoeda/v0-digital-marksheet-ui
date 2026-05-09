-- scripts/236: students.test_session_id / students.room_number を DROP COLUMN
-- (ADR-004 Phase B-2-c PR3 完結)
--
-- 背景:
--   ADR-004 で students を canonical 化(univ + student_id ON CONFLICT)し、
--   session 紐付け (test_session_id, room_number) は
--   student_test_session_assignments junction に移行済み。
--   - scripts/213: junction 新設
--   - scripts/215〜218: students canonical UNIQUE + backfill + NULLABLE
--   - scripts/219: register_student_canonical RPC
--   - scripts/220: RPC から legacy 列の書き込みを除去
--
--   本スクリプトは最終段の物理 DROP。
--
-- 安全性 (本番 DB で 2026-05-08 に確認):
--   - register_student_canonical は既に legacy 列を書いていない
--   - application 層 (app/api/students/, lib/api/students.ts) も読まない
--   - legacy 値が残る 3 行 (E001/E002/E003) は junction と完全一致 → 情報損失なし
--   - View / Trigger / 他 Function に依存なし
--   - DROP のドライラン (BEGIN..ROLLBACK) でエラーなく 2 列削除を確認
--
-- ロールバック:
--   ALTER TABLE students ADD COLUMN test_session_id uuid;
--   ALTER TABLE students ADD COLUMN room_number text;
--   -- backfill が必要なら junction から:
--   UPDATE students s SET
--     test_session_id = a.test_session_id,
--     room_number     = a.room_number
--   FROM student_test_session_assignments a
--   WHERE a.student_id = s.id;

ALTER TABLE students DROP COLUMN IF EXISTS test_session_id;
ALTER TABLE students DROP COLUMN IF EXISTS room_number;

-- 動作確認 (10 列残る想定: id / student_id / name / email / department /
-- created_at / updated_at / university_code / subject_code / grade):
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='students'
ORDER BY ordinal_position;
