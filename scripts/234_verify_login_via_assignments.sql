-- scripts/234: verify_teacher_login / verify_patient_login を junction LEFT JOIN ベースに更新
-- (ADR-007 C-6: 認証 RPC で legacy 列の参照を廃止し、assignments junction を真とする)
--
-- 背景:
--   ADR-007 C-1〜C-4 で teachers / patients は canonical (univ + email) UNIQUE
--   になり、assigned_room_number / test_session_id は junction
--   teacher_test_session_assignments / patient_test_session_assignments に
--   移行された。一方、verify_teacher_login / verify_patient_login は依然
--   teachers / patients テーブルの legacy 列 (test_session_id, assigned_room_number)
--   を返しており、以下の問題がある:
--     1. 同一教員/患者役が複数 test_session に assign されていても、RPC は 1 行
--        しか返さない → lib/auth/verify.ts の session_select 分岐が triggered
--        されず、legacy 列の古い test_session_id を default にしてしまう
--     2. legacy 列は ADR-007 C-7 で DROP COLUMN 予定。RPC が読み続けると C-7 で
--        ブロッカーになる
--
-- 変更:
--   teachers / patients を assignments junction で LEFT JOIN し、assignments
--   の行ごとに 1 row を返すように改める。0 assignments の行も LEFT JOIN で
--   1 row(test_session_id=NULL, assigned_room_number=NULL)が返る。
--
-- 影響:
--   - 認証成功 + 1 assignment → 従来どおり 1 row
--   - 認証成功 + 多 assignments → N rows → verify.ts で session_select に分岐
--     (ただし admin-like role はアプリ側で session_select をスキップ)
--   - 認証成功 + 0 assignments → 1 row, test_session_id=NULL
--   - admin-like role (master_admin / university_admin / subject_admin) は
--     dashboard 主体なので session_id 不要、空でも redirect は /admin/dashboard
--
-- ロールバック:
--   scripts/205_enable_pgcrypto.sql 末尾の verify_teacher_login / verify_patient_login
--   定義をそのまま再適用する。

-- teachers
CREATE OR REPLACE FUNCTION verify_teacher_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  assigned_room_number TEXT,
  university_code TEXT,
  subject_code TEXT,
  test_session_id UUID,
  account_type TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT t.id, t.email, t.name, t.role,
         a.assigned_room_number,
         t.university_code, t.subject_code,
         a.test_session_id,
         t.account_type
  FROM teachers t
  LEFT JOIN teacher_test_session_assignments a ON a.teacher_id = t.id
  WHERE t.email = p_email
    AND (
      (t.password ~ '^\$2[ab]\$' AND t.password = extensions.crypt(p_password, t.password))
      OR (t.password !~ '^\$2[ab]\$' AND t.password = p_password)
    );
$$;

-- patients
CREATE OR REPLACE FUNCTION verify_patient_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  assigned_room_number TEXT,
  university_code TEXT,
  subject_code TEXT,
  test_session_id UUID,
  account_type TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p.id, p.email, p.name, p.role,
         a.assigned_room_number,
         p.university_code, p.subject_code,
         a.test_session_id,
         p.account_type
  FROM patients p
  LEFT JOIN patient_test_session_assignments a ON a.patient_id = p.id
  WHERE p.email = p_email
    AND (
      (p.password ~ '^\$2[ab]\$' AND p.password = extensions.crypt(p_password, p.password))
      OR (p.password !~ '^\$2[ab]\$' AND p.password = p_password)
    );
$$;

-- 動作確認(コメントアウト、手動で SELECT して確認する用):
-- SELECT * FROM verify_teacher_login('showa-t1@example.com', 'showa-t1');  -- 2 行返る想定
-- SELECT * FROM verify_teacher_login('uni', 'uni');                         -- 2 行返る想定
-- SELECT * FROM verify_teacher_login('ediand-t1@example.com', 'ediand-t1'); -- 1 行返る想定
