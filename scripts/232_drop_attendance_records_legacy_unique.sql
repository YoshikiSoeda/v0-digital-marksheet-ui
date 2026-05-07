-- scripts/232: attendance_records の旧 UNIQUE (student_id, room_number) を削除
--
-- 背景:
--   scripts/200 で `unique_student_room` という名前で旧 UNIQUE を DROP IF EXISTS したが、
--   本番では auto-generated 名 `attendance_records_student_id_room_number_key` で
--   作成されていたため空振りし、test_session_id を含まない UNIQUE 制約が残っていた。
--   この結果、同じ (student, room) に対して別の test_session で出席記録を保存しようとすると
--   23505 duplicate key で失敗し、教員側 UI ではサイレント失敗。サマリー画面で出席=0 / 完了=0
--   になるユーザー報告 (2026-05-07) の根本原因。
--
-- 修正:
--   レガシー UNIQUE を DROP し、scripts/200 で追加した
--   `attendance_unique_per_session (student_id, room_number, test_session_id)` のみを残す。
--
-- 影響範囲:
--   POST /api/attendance-records の upsert(onConflict: student_id,room_number,test_session_id)
--   が正しく動作するようになる。1 学生が複数 test_session で同じ部屋に居る場合の出席記録が
--   それぞれ独立に保存されるようになる。
--
-- ロールバック (推奨されない):
--   ALTER TABLE attendance_records
--     ADD CONSTRAINT attendance_records_student_id_room_number_key
--     UNIQUE (student_id, room_number);
--   ※ 既存の複数セッション分データがあると重複で失敗するので、ロールバックは慎重に。

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_student_id_room_number_key;

-- 動作確認 (出力に attendance_unique_per_session のみ残る想定):
SELECT con.conname, pg_get_constraintdef(con.oid) AS def
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'attendance_records' AND con.contype = 'u';
