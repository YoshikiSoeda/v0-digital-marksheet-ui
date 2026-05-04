-- ADR-007 Phase C-4 (script 228): teachers.test_session_id を NULLABLE 化
--
-- 背景:
--   ADR-007 Phase C-3 (scripts/226) で register_teachers_bulk RPC は canonical 化済。
--   session 紐付けは junction (teacher_test_session_assignments) で管理。
--   しかし teachers.test_session_id は NOT NULL のままなので、session 未指定で
--   教員を canonical 登録できない。
--
--   Phase C-4 で UI から「試験セッション選択」を削除するため、ここで NULLABLE 化する。
--   これは B-2-a (scripts/218) で students.test_session_id にやったのと同じ操作。
--
--   完全に DROP COLUMN するのは Phase C-7 (本番安定後)。
--
-- ロールバック:
--   ALTER TABLE public.teachers ALTER COLUMN test_session_id SET NOT NULL;
--   (ただし NULL 値が混じったら戻せないので注意)

ALTER TABLE public.teachers ALTER COLUMN test_session_id DROP NOT NULL;
