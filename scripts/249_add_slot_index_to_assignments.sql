-- ADR-007 追補: 教員/患者役の割当に slot_index(部屋内の①②…順)を保存する。
-- 背景: これまで「教員①/教員②」は部屋内メールアドレス昇順で導出していたため、
--   CSV の教員①/②列の意図と逆転することがあった(例: choku < y.takahashi なので
--   CSV で教員①=y.takahashi でも画面上は choku が教員①になっていた)。
-- slot_index を明示保存し、表示・出席・採点・集計の①②判定をこの列基準に切り替える。
-- 既存データは現行のメール昇順で backfill するため、再取込まで挙動は不変。
--
-- 本番適用: 2026-07-13 Supabase MCP apply_migration (add_slot_index_to_assignments) で実施済。
--
-- ロールバック手順:
--   ALTER TABLE teacher_test_session_assignments DROP COLUMN IF EXISTS slot_index;
--   ALTER TABLE patient_test_session_assignments DROP COLUMN IF EXISTS slot_index;

ALTER TABLE teacher_test_session_assignments ADD COLUMN IF NOT EXISTS slot_index int;
ALTER TABLE patient_test_session_assignments ADD COLUMN IF NOT EXISTS slot_index int;

-- 教員: 部屋内メール昇順で 0-based backfill
WITH ranked AS (
  SELECT a.teacher_id, a.test_session_id, a.assigned_room_number,
         (row_number() OVER (
            PARTITION BY a.test_session_id, a.assigned_room_number
            ORDER BY lower(t.email)
          ) - 1) AS idx
  FROM teacher_test_session_assignments a
  JOIN teachers t ON t.id = a.teacher_id
)
UPDATE teacher_test_session_assignments a
SET slot_index = r.idx
FROM ranked r
WHERE a.teacher_id = r.teacher_id
  AND a.test_session_id = r.test_session_id
  AND a.assigned_room_number = r.assigned_room_number;

-- 患者役: 同様
WITH ranked AS (
  SELECT a.patient_id, a.test_session_id, a.assigned_room_number,
         (row_number() OVER (
            PARTITION BY a.test_session_id, a.assigned_room_number
            ORDER BY lower(p.email)
          ) - 1) AS idx
  FROM patient_test_session_assignments a
  JOIN patients p ON p.id = a.patient_id
)
UPDATE patient_test_session_assignments a
SET slot_index = r.idx
FROM ranked r
WHERE a.patient_id = r.patient_id
  AND a.test_session_id = r.test_session_id
  AND a.assigned_room_number = r.assigned_room_number;
