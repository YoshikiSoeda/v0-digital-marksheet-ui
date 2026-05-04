-- ADR-007 Phase C-4 (script 229): patients.test_session_id を NULLABLE 化
--
-- scripts/228 (teachers) と同じ操作を patients に適用。
-- B-2-a for students (scripts/218) と同じパターン。

ALTER TABLE public.patients ALTER COLUMN test_session_id DROP NOT NULL;
