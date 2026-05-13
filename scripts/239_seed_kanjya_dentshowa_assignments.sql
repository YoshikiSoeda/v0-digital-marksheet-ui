-- scripts/239: 共通テストアカウント kanjya を dentshowa の 2 セッションに assign
-- (2026-05-13 副田さんから「患者役でセッションを開けない」報告を受けて適用済み)
--
-- 背景:
--   verify_patient_login は PR #90 (scripts/234) で junction LEFT JOIN ベース
--   になり、patient_test_session_assignments に行がない患者役は
--   assigned_room_number=NULL で返るようになった。
--   kanjya は scripts/231 で seed されたが、assignment 行が無かったため
--   ログイン後 Cookie の assignedRoomNumber が空になり、/patient/exam の
--   useExamPageGuard で「セッション情報が不完全です」エラーになっていた。
--
-- 修正:
--   kanjya を dentshowa の 2 セッションに S101 で assign する seed。
--
-- 同 PR で構造的修正(test-selection-screen で session 切替時に Cookie の
-- assignedRoomNumber を refresh する /api/auth/select-session エンドポイント追加)
-- も行ったため、複数 session に assign された他テストアカウント (showa-p1 等)
-- でも session 切替が正しく機能する。

INSERT INTO patient_test_session_assignments (
  patient_id, test_session_id, assigned_room_number
)
SELECT
  p.id,
  ts.id,
  'S101'
FROM patients p
CROSS JOIN test_sessions ts
WHERE p.email = 'kanjya'
  AND ts.university_code = 'dentshowa'
  AND ts.id IN (
    '437ddbf1-1187-4f08-b001-7a0d9e9b9525'::uuid, -- 2026年度デモOSCE
    '772c4d86-871c-456e-9541-665bae83f6c0'::uuid  -- 20260505_全身テスト
  )
ON CONFLICT (patient_id, test_session_id) DO UPDATE SET
  assigned_room_number = EXCLUDED.assigned_room_number;

-- 動作確認 (2 行返る想定)
SELECT * FROM verify_patient_login('kanjya', 'kanjya');
