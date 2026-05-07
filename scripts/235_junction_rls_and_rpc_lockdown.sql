-- scripts/235: junction tables の RLS 有効化 + register_student_canonical の lockdown
-- (ADR-003 deny-by-default の漏れ修正)
--
-- 背景:
--   Supabase advisor で 3 件の ERROR/WARN が検出された:
--     1. ERROR rls_disabled_in_public — public.teacher_test_session_assignments
--     2. ERROR rls_disabled_in_public — public.patient_test_session_assignments
--        (sensitive_columns_exposed: patient_id も同時 ERROR)
--     3. WARN  anon/authenticated_security_definer_function_executable —
--        public.register_student_canonical(...) が anon / authenticated から
--        /rest/v1/rpc/register_student_canonical 経由で実行可能
--
--   1, 2: ADR-007 C-1 の scripts/223, 224 で junction を新設したとき、
--          scripts/213 (student junction) と同じ ALTER TABLE ... ENABLE ROW LEVEL
--          SECURITY を付けるべきだったのに付け忘れていた。
--
--   3: scripts/219 で register_student_canonical を CREATE するときに
--      scripts/209 と同様の REVOKE EXECUTE FROM anon, authenticated, public が
--      抜けていた(GRANT EXECUTE TO service_role はあったが、PostgREST の default
--      で anon/authenticated にも EXECUTE が降りていた)。
--
--   全データアクセスは /api/* (service role) 経由に集約されているため、deny-by-default
--   に揃えるのが ADR-003 の方針。
--
-- 影響:
--   - service role からの SELECT/INSERT/UPDATE/DELETE は引き続き通る
--     (BYPASSRLS のため)
--   - register_teachers_bulk / register_patients_bulk / register_student_canonical は
--     SECURITY DEFINER (function owner = postgres) で動くため、ENABLE RLS でも
--     junction への INSERT/UPDATE は可能
--   - anon / authenticated からの直接 SELECT (PostgREST 経由) は遮断される
--   - anon / authenticated からの register_student_canonical RPC 呼び出しは遮断される
--
-- ロールバック:
--   ALTER TABLE public.teacher_test_session_assignments DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.patient_test_session_assignments DISABLE ROW LEVEL SECURITY;
--   GRANT EXECUTE ON FUNCTION public.register_student_canonical(...) TO anon, authenticated;

-- 1) junction tables の RLS 有効化(policy は定義しない = deny-by-default)
ALTER TABLE public.teacher_test_session_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_test_session_assignments ENABLE ROW LEVEL SECURITY;

-- 2) register_student_canonical の EXECUTE をロックダウン
REVOKE EXECUTE ON FUNCTION public.register_student_canonical(
  text, text, text, text, text, text, text, uuid, text
) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.register_student_canonical(
  text, text, text, text, text, text, text, uuid, text
) TO service_role;

-- 動作確認(コメントアウト):
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN
--   ('teacher_test_session_assignments', 'patient_test_session_assignments');
-- → 両方とも relrowsecurity = true 想定
--
-- SELECT has_function_privilege('anon', oid, 'EXECUTE') FROM pg_proc
--   WHERE proname = 'register_student_canonical';
-- → false 想定
