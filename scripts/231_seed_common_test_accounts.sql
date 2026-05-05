-- scripts/231: CLAUDE.md §7.1 共通テストアカウント seed
--
-- 背景:
--   CLAUDE.md §7.1 に記載されている `kyouka` / `ippan` / `kanjya` の 3 アカウントが
--   過去のクリーンアップで本番 DB から消えていたため、通しテスト用に再 seed する。
--   docs と production の整合性を回復する目的。
--
-- 内容(全 dentshowa / dentshowa_OSCE スコープ):
--   - kyouka : teachers.role = subject_admin (教科管理者) — Y-1〜Y-3 検証用
--   - ippan  : teachers.role = general (一般教員、部屋 S101 担当)
--   - kanjya : patients.role = general (患者役、部屋 S101 担当)
--
-- パスワード:
--   bcrypt (gen_salt('bf', 10)) で email = password の 1:1 対応。
--   crypt() を SECURITY DEFINER 経由ではなく直接呼ぶため、scripts/205 の pgcrypto extension が
--   有効である前提。本番には既に有効化済み。
--
-- 冪等性:
--   teachers/patients は (university_code, email) UNIQUE (scripts/223, 224) があるため
--   ON CONFLICT DO NOTHING で多重実行に耐える。
--
-- ロールバック:
--   DELETE FROM teachers WHERE university_code = 'dentshowa' AND email IN ('kyouka', 'ippan');
--   DELETE FROM patients WHERE university_code = 'dentshowa' AND email = 'kanjya';

INSERT INTO public.teachers (
  id, name, email, password, role,
  university_code, subject_code, account_type
)
VALUES (
  gen_random_uuid(),
  '教科 太郎',
  'kyouka',
  crypt('kyouka', gen_salt('bf', 10)),
  'subject_admin',
  'dentshowa',
  'dentshowa_OSCE',
  'subject_admin'
)
ON CONFLICT (university_code, email) DO NOTHING;

INSERT INTO public.teachers (
  id, name, email, password, role,
  university_code, subject_code, assigned_room_number, account_type
)
VALUES (
  gen_random_uuid(),
  '一般 教員',
  'ippan',
  crypt('ippan', gen_salt('bf', 10)),
  'general',
  'dentshowa',
  'dentshowa_OSCE',
  'S101',
  'general'
)
ON CONFLICT (university_code, email) DO NOTHING;

INSERT INTO public.patients (
  id, name, email, password, role,
  university_code, subject_code, assigned_room_number, account_type
)
VALUES (
  gen_random_uuid(),
  '患者 役者',
  'kanjya',
  crypt('kanjya', gen_salt('bf', 10)),
  'general',
  'dentshowa',
  'dentshowa_OSCE',
  'S101',
  'admin'
)
ON CONFLICT (university_code, email) DO NOTHING;
