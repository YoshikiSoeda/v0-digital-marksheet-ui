-- Phase 9 B-1: students に学年カラム追加(2026-05-02 適用)。
-- text にして "4年" "5年" など柔軟に保存できるようにする。
-- NULL = 学年未設定。
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS grade text;
COMMENT ON COLUMN public.students.grade IS
  '学年(例: "4年" "5年")。NULL は未設定。Phase 9 B-1 で追加。';
