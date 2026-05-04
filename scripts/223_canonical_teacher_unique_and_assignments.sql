-- ADR-007 Phase C-1 (script 223): teachers の canonical 化 + junction 新設 + backfill
--
-- 背景:
--   ADR-007 で合意した通り、teachers を canonical 化し、試験セッションへの紐付けを
--   junction テーブル (teacher_test_session_assignments) に分離する。
--
--   ADR-004 + B-2-c で students は同じパターンを完了済。
--
-- 事前確認 (2026-05-04):
--   - (university_code, email) で重複する teachers 行: 0 件
--   - email NULL/空 / university_code NULL/空 の行: 0 件
--   → 重複統合不要、UNIQUE 制約をそのまま追加できる
--
-- 本スクリプトは Supabase MCP の execute_sql で本番適用 + Git 履歴用にコミット。
--
-- Phase 内訳:
--   1. teacher_test_session_assignments テーブル新設 (junction)
--   2. 既存 teachers.{test_session_id, assigned_room_number} から junction に backfill
--   3. teachers に (university_code, email) UNIQUE 制約追加
--
-- 注意:
--   - teachers.test_session_id / assigned_room_number 列はまだ DROP しない (C-7 で実施)
--   - register_teachers_bulk RPC は ON CONFLICT (email, test_session_id) を使っているが、
--     この時点では UNIQUE 制約と矛盾しない (test_session_id がまだ存在するため)
--   - C-3 で RPC を canonical 版に置き換え、C-7 で legacy 列を DROP
--
-- ロールバック:
--   DROP TABLE public.teacher_test_session_assignments;
--   ALTER TABLE public.teachers DROP CONSTRAINT teachers_canonical_unique;

-- 1. junction テーブル新設
CREATE TABLE IF NOT EXISTS public.teacher_test_session_assignments (
  teacher_id        uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  test_session_id   uuid NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,
  assigned_room_number text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, test_session_id)
);

CREATE INDEX IF NOT EXISTS idx_tts_assign_session
  ON public.teacher_test_session_assignments(test_session_id);
CREATE INDEX IF NOT EXISTS idx_tts_assign_teacher
  ON public.teacher_test_session_assignments(teacher_id);

-- 2. backfill: 既存 teachers から junction にデータ移行
INSERT INTO public.teacher_test_session_assignments (teacher_id, test_session_id, assigned_room_number)
SELECT
  id,
  test_session_id,
  NULLIF(assigned_room_number, '')
FROM public.teachers
WHERE test_session_id IS NOT NULL
ON CONFLICT (teacher_id, test_session_id) DO NOTHING;

-- 3. canonical UNIQUE 制約
ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_canonical_unique UNIQUE (university_code, email);
