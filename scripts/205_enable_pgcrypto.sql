-- Phase 8: 平文パスワード解消の前段
-- pgcrypto 拡張を有効化 + パスワード検証 RPC 関数を作成
-- Supabase は pgcrypto をデフォルト利用可。冪等。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ロールごとの認証 RPC。bcrypt ハッシュと平文の両方を許容(後方互換)。
-- ハッシュ済み行: crypt(plaintext, stored_hash) が stored_hash と一致するか
-- 平文行(移行前): stored_password === plaintext

-- admins (email または name で検索 — 既存ロジックと同じ)
CREATE OR REPLACE FUNCTION verify_admin_login(p_identifier TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  university_codes TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.email, a.name, a.role, a.university_codes
  FROM admins a
  WHERE (a.email = p_identifier OR a.name = p_identifier)
    AND (
      (a.password ~ '^\$2[ab]\$' AND a.password = crypt(p_password, a.password))
      OR (a.password !~ '^\$2[ab]\$' AND a.password = p_password)
    )
  LIMIT 1;
$$;

-- teachers (email で検索)
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
SET search_path = public
AS $$
  SELECT t.id, t.email, t.name, t.role, t.assigned_room_number,
         t.university_code, t.subject_code, t.test_session_id, t.account_type
  FROM teachers t
  WHERE t.email = p_email
    AND (
      (t.password ~ '^\$2[ab]\$' AND t.password = crypt(p_password, t.password))
      OR (t.password !~ '^\$2[ab]\$' AND t.password = p_password)
    );
$$;

-- patients (email で検索)
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
SET search_path = public
AS $$
  SELECT p.id, p.email, p.name, p.role, p.assigned_room_number,
         p.university_code, p.subject_code, p.test_session_id, p.account_type
  FROM patients p
  WHERE p.email = p_email
    AND (
      (p.password ~ '^\$2[ab]\$' AND p.password = crypt(p_password, p.password))
      OR (p.password !~ '^\$2[ab]\$' AND p.password = p_password)
    );
$$;

-- 動作確認(エラー出ない=OK)
SELECT
  crypt('test', gen_salt('bf', 10)) AS sample_bcrypt_hash,
  '$2a$' = LEFT(crypt('test', gen_salt('bf', 10)), 4) AS is_bcrypt;
