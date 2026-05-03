-- ADR-004 Phase B-2-1(part 1 of 5): student_test_session_assignments junction テーブルを新設
--
-- 背景:
--   現状の students.test_session_id NOT NULL は「同じ学籍番号の人が試験セッションごとに別 row」
--   という設計を強制する。このため:
--     1) 新試験を作るたびに数百人を再登録する必要がある
--     2) 連絡先(email)などの単一情報源が成立しない
--     3) attendance_records / exam_results の整合性確認が複雑になる
--
--   本マイグレーションは ADR-004 §5 Phase B-2-1 の最初の一歩として、junction テーブルだけを
--   新設する(students テーブル本体・既存データは変更しない)。後続マイグレーション:
--     - scripts/214: students の重複統合(ユーザー要件確認後)
--     - scripts/215: (university_code, student_id) UNIQUE 制約追加
--     - scripts/216: 既存 students を assignments に展開
--     - scripts/217: students から test_session_id / room_number 列削除
--   は段階的に別 PR で実施する。
--
-- 適用後の影響:
--   なし(まだどの API も assignments を参照しない)。本テーブルは Phase B-2-2 で API 経由で
--   書き込まれ始める。
--
-- ロールバック:
--   DROP TABLE public.student_test_session_assignments CASCADE;

CREATE TABLE IF NOT EXISTS public.student_test_session_assignments (
  -- 主キー
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  test_session_id uuid NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,

  -- 割当時に決まる属性(同一学生でも試験ごとに変わりうる)
  room_number     text,

  -- 監査用
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (student_id, test_session_id)
);

-- 検索インデックス(test_session_id 単位で受験者を引くケースが多い)
CREATE INDEX IF NOT EXISTS idx_assignments_session
  ON public.student_test_session_assignments(test_session_id);

CREATE INDEX IF NOT EXISTS idx_assignments_session_room
  ON public.student_test_session_assignments(test_session_id, room_number);

-- updated_at の自動更新トリガ(他テーブルで使われているパターンに合わせる)
CREATE OR REPLACE FUNCTION public.tg_assignments_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assignments_set_updated_at ON public.student_test_session_assignments;
CREATE TRIGGER trg_assignments_set_updated_at
  BEFORE UPDATE ON public.student_test_session_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_assignments_set_updated_at();

-- ADR-003 の deny-by-default RLS ポリシーに沿って RLS を有効化(policy は定義しない)
ALTER TABLE public.student_test_session_assignments ENABLE ROW LEVEL SECURITY;

-- 検証
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'student_test_session_assignments';
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'Migration failed: student_test_session_assignments not created';
  END IF;

  -- RLS が有効化されているか
  SELECT count(*) INTO cnt
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = 'student_test_session_assignments'
    AND rowsecurity = true;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on student_test_session_assignments';
  END IF;

  RAISE NOTICE 'OK: student_test_session_assignments created with RLS enabled';
END $$;
