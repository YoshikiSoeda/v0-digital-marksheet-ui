-- Phase 8b: パスワードリセット用 RPC + WARN 解消
-- 既に production には apply_migration 経由で適用済(2026-04-26)
-- このファイルは新環境セットアップ時の再現性のためにコミット

-- 1) updated_at トリガー関数の search_path を固定(WARN 'function_search_path_mutable')
ALTER FUNCTION public.update_students_updated_at() SET search_path = public;
ALTER FUNCTION public.update_teachers_updated_at() SET search_path = public;
ALTER FUNCTION public.update_tests_updated_at() SET search_path = public;

-- 2) reset-password エンドポイント用の RPC
CREATE OR REPLACE FUNCTION update_teacher_password_bulk(p_ids UUID[], p_new_password TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE teachers
  SET password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10))
  WHERE id = ANY(p_ids);
$$;

CREATE OR REPLACE FUNCTION update_patient_password_bulk(p_ids UUID[], p_new_password TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE patients
  SET password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10))
  WHERE id = ANY(p_ids);
$$;
