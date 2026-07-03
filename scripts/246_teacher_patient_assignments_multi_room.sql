-- ADR-007 拡張 (2026-07-02 熊木先生指摘 / 副田さん判断):
--   同一セッション内で 1 教員/1 患者役が複数部屋を担当できるようにする。
--
-- 背景:
--   熊木先生の CSV 取込で「教員①②が入れ替わる/入らない、患者役も入らない」現象。
--   原因は teacher_test_session_assignments の PK が (teacher_id, test_session_id) で、
--   1 教員は 1 セッション内で 1 部屋しか担当できない制約。
--   熊木先生の 11/5 と 11/6 の 2 日運用で「同じ教員が両日担当」する CSV を後書きで
--   上書きしてしまい、前日側の割当が消えていた。
--
-- 変更:
--   PK を (teacher_id, test_session_id) → (teacher_id, test_session_id, assigned_room_number)
--   patient_test_session_assignments も同様に PK 変更。
--
-- 既存データ:
--   現在は既に 1 教員 = 1 部屋なので、単純に PK を拡張するだけで backfill 不要。
--
-- ロールバック:
--   PK を旧仕様に戻すには複数部屋担当のデータを削除する必要がある。
--   Supabase PITR で復元するのが確実。

BEGIN;

-- ---- teacher_test_session_assignments ----
ALTER TABLE public.teacher_test_session_assignments
  DROP CONSTRAINT teacher_test_session_assignments_pkey;

-- assigned_room_number が NULL だと PK 制約でエラーになるので NOT NULL 化
-- (既存データで NULL が無いことを事前確認済)
UPDATE public.teacher_test_session_assignments
   SET assigned_room_number = ''
 WHERE assigned_room_number IS NULL;

ALTER TABLE public.teacher_test_session_assignments
  ALTER COLUMN assigned_room_number SET NOT NULL;

ALTER TABLE public.teacher_test_session_assignments
  ADD CONSTRAINT teacher_test_session_assignments_pkey
  PRIMARY KEY (teacher_id, test_session_id, assigned_room_number);

-- ---- patient_test_session_assignments ----
ALTER TABLE public.patient_test_session_assignments
  DROP CONSTRAINT patient_test_session_assignments_pkey;

UPDATE public.patient_test_session_assignments
   SET assigned_room_number = ''
 WHERE assigned_room_number IS NULL;

ALTER TABLE public.patient_test_session_assignments
  ALTER COLUMN assigned_room_number SET NOT NULL;

ALTER TABLE public.patient_test_session_assignments
  ADD CONSTRAINT patient_test_session_assignments_pkey
  PRIMARY KEY (patient_id, test_session_id, assigned_room_number);

COMMIT;
