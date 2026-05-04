-- ADR-007 Phase C-1 (script 225): rooms の canonical 化 (UNIQUE 制約のみ、junction なし)
--
-- ADR-007 採用案 B: rooms は junction を持たない。
-- 「この試験で使う部屋」は teacher/patient/student の各 assignment.assigned_room_number の集合で表現。
--
-- そのため rooms 側は UNIQUE 制約だけ追加し、junction テーブル作成は不要。
--
-- 事前確認 (2026-05-04):
--   - (university_code, room_number) で重複する rooms 行: 0 件
--   - room_number NULL/空: 0 件
--
-- 注意:
--   - rooms.{test_session_id, subject_code} 列はまだ DROP しない (C-7 で実施)
--   - 現状 rooms 11 行はそれぞれ test_session_id を持つが、application 層の切替後は
--     その列値は参照されない (ADR-007 §2.1 案 B)
--
-- ロールバック:
--   ALTER TABLE public.rooms DROP CONSTRAINT rooms_canonical_unique;

ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_canonical_unique UNIQUE (university_code, room_number);
