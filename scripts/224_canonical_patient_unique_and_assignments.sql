-- ADR-007 Phase C-1 (script 224): patients の canonical 化 + junction 新設 + backfill
--
-- scripts/223 (teachers) と同じパターンを patients に適用する。
--
-- 事前確認 (2026-05-04):
--   - (university_code, email) で重複する patients 行: 0 件
--   - email NULL/空: 0 件
--
-- ロールバック:
--   DROP TABLE public.patient_test_session_assignments;
--   ALTER TABLE public.patients DROP CONSTRAINT patients_canonical_unique;

-- 1. junction テーブル新設
CREATE TABLE IF NOT EXISTS public.patient_test_session_assignments (
  patient_id        uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  test_session_id   uuid NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,
  assigned_room_number text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, test_session_id)
);

CREATE INDEX IF NOT EXISTS idx_pts_assign_session
  ON public.patient_test_session_assignments(test_session_id);
CREATE INDEX IF NOT EXISTS idx_pts_assign_patient
  ON public.patient_test_session_assignments(patient_id);

-- 2. backfill
INSERT INTO public.patient_test_session_assignments (patient_id, test_session_id, assigned_room_number)
SELECT
  id,
  test_session_id,
  NULLIF(assigned_room_number, '')
FROM public.patients
WHERE test_session_id IS NOT NULL
ON CONFLICT (patient_id, test_session_id) DO NOTHING;

-- 3. canonical UNIQUE 制約
ALTER TABLE public.patients
  ADD CONSTRAINT patients_canonical_unique UNIQUE (university_code, email);
