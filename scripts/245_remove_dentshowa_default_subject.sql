-- ADR-? (2026-05-20 副田さん指示): dentshowa の「デフォルト教科名」(subject_code='dentshowa_OSCE') を撤去
--
-- 経緯:
--   元々 scripts/222 で subject_name='OSCE基本評価' として seed したが、いずれかの段階で
--   subject_name が「デフォルト教科名」に書き換わっていた(履歴不明)。副田さんから「ハードコード
--   された教科名は削除し、教科マスターから選ばせる」運用に変えたいとの指示。
--
-- 手順:
--   Phase 1: 参照テーブルの subject_code='dentshowa_OSCE' を NULL に UPDATE
--     - teachers       7 名 (ippan / kyouka / uni / showa-t1〜t5 等)
--     - students      25 名 (dentshowa デモ学生)
--     - tests          5 件
--     - test_sessions  3 件 (2026年度デモOSCE / 20260505_全身テスト / 20260629_テスト0615)
--   Phase 2: subjects から 'dentshowa_OSCE' を DELETE
--
-- 副作用 (副田さん了承済):
--   - kyouka (subject_admin) の subject_code が NULL → 自教科スコープが何もマッチせず使用不能になる
--     副田さんが UI で新教科 (dent_xxx など PR #123 で seed したもの) を割当て直す
--   - 既存試験セッション 3 件が教科未設定になる
--     副田さんが UI で教科を再選択
--
-- ロールバック:
--   subject レコードを再作成 + 各テーブルの NULL を 'dentshowa_OSCE' に戻す
--   ただし Supabase の PITR で復元する方が確実。

BEGIN;

-- Phase 1: 参照を NULL に
UPDATE public.teachers
   SET subject_code = NULL
 WHERE subject_code = 'dentshowa_OSCE';

UPDATE public.students
   SET subject_code = NULL
 WHERE subject_code = 'dentshowa_OSCE';

UPDATE public.tests
   SET subject_code = NULL
 WHERE subject_code = 'dentshowa_OSCE';

UPDATE public.test_sessions
   SET subject_code = NULL
 WHERE subject_code = 'dentshowa_OSCE';

-- Phase 2: subjects から削除
DELETE FROM public.subjects
 WHERE subject_code = 'dentshowa_OSCE';

COMMIT;
