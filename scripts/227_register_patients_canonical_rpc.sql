-- ADR-007 Phase C-3 (script 227): register_patients_bulk を canonical 化
--
-- scripts/226 (teachers) と同じパターンを patients に適用する。
--
-- ロールバック:
--   scripts/207 の register_patients_bulk 関数定義を再 apply で巻き戻し可能。

CREATE OR REPLACE FUNCTION public.register_patients_bulk(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec jsonb;
  cnt integer := 0;
  v_patient_id uuid;
  v_test_session_id uuid;
  v_assigned_room text;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'array' THEN
    RAISE EXCEPTION 'p_data must be a JSONB array';
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
    v_test_session_id := NULLIF(rec->>'test_session_id', '')::uuid;
    v_assigned_room   := NULLIF(rec->>'assigned_room_number', '');

    -- 1. canonical upsert (univ + email)
    INSERT INTO public.patients (
      name, email, password, role,
      assigned_room_number, subject_code, university_code,
      account_type, test_session_id
    )
    VALUES (
      rec->>'name',
      rec->>'email',
      public.hash_password_if_plain(rec->>'password'),
      rec->>'role',
      v_assigned_room,
      NULLIF(rec->>'subject_code', ''),
      COALESCE(NULLIF(rec->>'university_code', ''), 'dentshowa'),
      NULLIF(rec->>'account_type', ''),
      v_test_session_id
    )
    ON CONFLICT (university_code, email) DO UPDATE SET
      name         = EXCLUDED.name,
      password     = public.hash_password_if_plain(EXCLUDED.password),
      role         = EXCLUDED.role,
      subject_code = COALESCE(EXCLUDED.subject_code, public.patients.subject_code),
      account_type = COALESCE(EXCLUDED.account_type, public.patients.account_type),
      updated_at   = now()
    RETURNING id INTO v_patient_id;

    -- 2. assignment upsert
    IF v_test_session_id IS NOT NULL THEN
      INSERT INTO public.patient_test_session_assignments (
        patient_id, test_session_id, assigned_room_number
      ) VALUES (
        v_patient_id, v_test_session_id, v_assigned_room
      )
      ON CONFLICT (patient_id, test_session_id) DO UPDATE SET
        assigned_room_number = EXCLUDED.assigned_room_number,
        updated_at           = now();
    END IF;

    cnt := cnt + 1;
  END LOOP;

  RETURN jsonb_build_object('upserted', cnt);
END $$;
