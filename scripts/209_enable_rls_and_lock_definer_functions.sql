-- ADR-003 §5: Phase 9 RLS 有効化 + SECURITY DEFINER 関数のロックダウン + search_path 固定。
-- 全データアクセスは /api/* (service role) 経由に集約済み(Phase 9c-1〜9c-5 で完了)のため、
-- anon/authenticated 用 policy を一切定義せず deny-by-default にする。
-- 本番には Supabase MCP apply_migration 経由で 2026-05-02 に適用済み。

-- 1) RLS ENABLE(13 テーブル)
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- 2) SECURITY DEFINER 関数の EXECUTE をロックダウン
DO $$
DECLARE
  fn_signatures text[] := ARRAY[
    'verify_admin_login(text, text)',
    'verify_teacher_login(text, text)',
    'verify_patient_login(text, text)',
    'register_teachers_bulk(jsonb)',
    'register_patients_bulk(jsonb)',
    'update_user_password(text, text)',
    'update_teacher_password_bulk(uuid[], text)',
    'update_patient_password_bulk(uuid[], text)',
    'hash_password_if_plain(text)'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY fn_signatures LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, public', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', sig);
  END LOOP;
END $$;

-- 3) 関数の search_path 固定(WARN 解消)
ALTER FUNCTION public.hash_password_if_plain(text) SET search_path = public, extensions;
ALTER FUNCTION public.update_user_password(text, text) SET search_path = public, extensions;
ALTER FUNCTION public.register_teachers_bulk(jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.register_patients_bulk(jsonb) SET search_path = public, extensions;
