-- Phase 9 C3: test_sessions に制限時間(分)カラムを追加(2026-05-02 適用)。
-- NULL = 制限時間未設定(プログレスバー非表示、elapsed のみ)。
ALTER TABLE public.test_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes integer;
COMMENT ON COLUMN public.test_sessions.duration_minutes IS
  'OSCE 試験の制限時間(分)。NULL の場合は無制限/未設定。ExamSessionBanner で残り時間プログレスバーに使用。';
