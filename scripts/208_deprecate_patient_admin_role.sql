-- ADR-001 §7-2(b): patient_admin ロール廃止
-- Phase 9b-β2f3 で適用済み(Supabase MCP apply_migration 経由)。
-- 患者役は role='general' のみ。既存の admin role(1 件)を general に降格し、
-- CHECK 制約も general のみ許可するように更新する。

BEGIN;

-- 1) 既存の admin role を general に降格
UPDATE patients SET role = 'general' WHERE role = 'admin';

-- 2) 旧 CHECK 制約を削除
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_role_check;

-- 3) 新 CHECK 制約: general のみ許可
ALTER TABLE patients ADD CONSTRAINT patients_role_check
  CHECK (role = 'general');

COMMIT;
