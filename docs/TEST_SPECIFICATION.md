# OSCEシステム テスト仕様書

## 1. 概要

### 1.1 ドキュメント情報
| 項目 | 内容 |
|------|------|
| システム名 | Digital Marksheet Exam System (OSCEシステム) |
| バージョン | 0.1.0 |
| 作成日 | 2026-04-26 |
| 対象環境 | Next.js 16 / React 19 / Supabase |

### 1.2 システム概要
大学医学部・歯学部のOSCE（客観的臨床能力試験）を運用するためのWebアプリケーション。
試験官（教員）・患者役・管理者の3ロールを持ち、試験部屋ごとの進行管理と評価入力、結果集計までをカバーする。

### 1.3 テスト対象機能一覧
| # | 機能カテゴリ | 主要機能 | 対応コンポーネント |
|---|-------------|---------|------------------|
| 1 | 認証機能 | 管理者ログイン、教員ログイン、患者役ログイン | admin-login-form, teacher-login-form, patient-login-form |
| 2 | 試験管理 | テストセッション作成・管理、問題管理 | admin-dashboard, question-management |
| 3 | マスタ管理 | 大学管理、教科管理、部屋管理、ユーザー管理 | *-management pages |
| 4 | 試験実施 | 出席確認、評価入力、採点 | teacher-exam-tabs, patient-exam-tabs |
| 5 | 結果管理 | ダッシュボード表示、結果集計、レポート | admin-dashboard, exam-results |

### 1.4 データベーススキーマ概要
| テーブル名 | 説明 | 主要カラム |
|-----------|------|-----------|
| universities | 大学マスタ | id, university_code, university_name, department_name |
| subjects | 教科マスタ | id, subject_code, subject_name, university_code |
| test_sessions | テストセッション | id, test_date, status, university_code, subject_code, passing_score |
| rooms | 部屋マスタ | id, room_number, room_name, test_session_id |
| teachers | 教員マスタ | id, email, password, role, assigned_room_number, test_session_id |
| patients | 患者役マスタ | id, email, password, assigned_room_number, test_session_id |
| students | 学生マスタ | id, student_id, name, room_number, test_session_id |
| admins | 管理者マスタ | id, email, password, role, university_codes |
| tests | テスト定義 | id, title, test_session_id, role_type |
| sheets | シート定義 | id, title, test_id |
| categories | カテゴリ定義 | id, title, number, sheet_id |
| questions | 問題定義 | id, text, category_id, is_alert_target, alert_options, option1-5 |
| attendance_records | 出席記録 | id, student_id, room_number, status, test_session_id |
| exam_results | 試験結果 | id, student_id, evaluator_type, evaluator_email, evaluations, total_score, is_completed, has_alert |

---

## 2. 認証機能テスト

### 2.1 管理者ログイン (TC-AUTH-001)

#### 2.1.1 対象画面・コンポーネント
- 画面URL: `/admin/login`
- コンポーネント: `components/admin-login-form.tsx`
- 関連テーブル: `admins`, `teachers`（subject_admin権限）

#### 2.1.2 ロール別認証フロー

| ロール | account_type | 認証テーブル | アクセス可能範囲 |
|-------|-------------|------------|----------------|
| マスター管理者 | special_master | admins | 全大学・全教科 |
| 大学管理者 | university_master | admins | 指定university_codes内の全教科 |
| 教科管理者 | subject_admin | teachers | 指定subject_code内のみ |

#### 2.1.3 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | 確認ポイント |
|----------|-----------|---------|---------|-----------|---------|-------------|
| TC-AUTH-001-01 | マスター管理者ログイン（デフォルト） | adminsテーブルにデフォルトマスター管理者が存在 | 1. `/admin/login`にアクセス<br>2. IDフィールドに`admin`を入力<br>3. PWフィールドに`admin`を入力<br>4. 「ログイン」ボタンをクリック | ID: `admin`<br>PW: `admin` | 1. ローディング状態「ログイン中...」が表示される<br>2. セッション選択画面が表示される<br>3. 全大学のセッションが表示される | - ボタンが無効化されている<br>- sessionStorageに`adminEmail`, `adminRole`, `adminId`が保存される |
| TC-AUTH-001-02 | マスター管理者ログイン（メールアドレス） | adminsテーブルにspecial_masterロールのユーザーが存在 | 1. `/admin/login`にアクセス<br>2. 登録済みメールアドレスを入力<br>3. パスワードを入力<br>4. ログインボタンをクリック | Email: `master@example.com`<br>PW: `password123` | セッション選択画面が表示され、全大学のセッションが一覧表示される | adminRoleが`special_master`として保存される |
| TC-AUTH-001-03 | 大学管理者ログイン | adminsテーブルにuniversity_masterロールのユーザーが存在<br>university_codesに`["dentshowa"]`が設定 | 1. `/admin/login`にアクセス<br>2. 大学管理者のメール・パスワードを入力<br>3. ログインボタンをクリック | Email: `univ-admin@dentshowa.ac.jp`<br>PW: `univpass` | 1. セッション選択画面が表示される<br>2. dentshowaのセッションのみ表示される<br>3. 他大学のセッションは表示されない | - university_codesフィルタが正しく適用されている<br>- sessionStorageにuniversityCodesが保存される |
| TC-AUTH-001-04 | 教科管理者ログイン | teachersテーブルにsubject_adminロールのユーザーが存在<br>subject_codeが設定済み | 1. `/admin/login`にアクセス<br>2. 教科管理者のメール・パスワードを入力<br>3. ログインボタンをクリック | Email: `subject-admin@dentshowa.ac.jp`<br>PW: `subjectpass` | 1. セッション選択画面が表示される<br>2. 該当subject_codeのセッションのみ表示される | - subject_codeフィルタが正しく適用されている |
| TC-AUTH-001-05 | テストセッション選択 | 管理者ログイン済み<br>複数セッションが存在 | 1. セッション一覧から任意のセッションカードをクリック | - | 1. `/admin/dashboard`に遷移する<br>2. 選択したセッションの情報がダッシュボードに表示される | - sessionStorageに`testSessionId`が保存される<br>- URLが正しく遷移する |
| TC-AUTH-001-06 | 新規テストセッション作成 | マスター管理者または大学管理者でログイン済み | 1. 「新規テスト」ボタンをクリック<br>2. テスト名入力フィールドにテスト名を入力<br>3. 実施日を選択<br>4. 大学を選択<br>5. 「作成」ボタンをクリック | テスト名: `第1回OSCE試験`<br>実施日: `2026-05-01`<br>大学: `dentshowa` | 1. 成功メッセージが表示される<br>2. 作成したセッションが一覧に追加される<br>3. test_sessionsテーブルに新レコードが作成される | - status: `not_started`<br>- university_code: 選択した大学<br>- test_date: 入力した日付 |
| TC-AUTH-001-07 | 大学フィルタリング | マスター管理者でログイン済み<br>複数大学のセッションが存在 | 1. 大学フィルタドロップダウンをクリック<br>2. 特定の大学を選択 | 選択: `昭和大学歯学部` | 選択した大学のセッションのみが一覧に表示される | - フィルタが即座に適用される<br>- 他大学のセッションが非表示になる |
| TC-AUTH-001-08 | 教科フィルタリング | 管理者でログイン済み<br>複数教科のセッションが存在 | 1. 教科フィルタドロップダウンをクリック<br>2. 特定の教科を選択 | 選択: `歯科` | 選択した教科のセッションのみが一覧に表示される | - subject_codeでフィルタされている |
| TC-AUTH-001-09 | ステータスフィルタリング | 管理者でログイン済み<br>各ステータスのセッションが存在 | 1. ステータスフィルタをクリック<br>2. 「実施中」を選択 | 選択: `in_progress` | statusが`in_progress`のセッションのみ表示される | - ステータスバッジの色が正しい（黄色） |
| TC-AUTH-001-10 | セッションステータス表示確認 | 各ステータスのセッションが存在 | セッション一覧を目視確認 | - | 各ステータスが以下のように表示される：<br>- `not_started` → 「未実施」（グレー）<br>- `in_progress` → 「実施中」（黄色）<br>- `completed` → 「テスト終了」（緑） | - バッジの色とテキストが正しい |

#### 2.1.4 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | エラーメッセージ |
|----------|-----------|---------|---------|-----------|---------|----------------|
| TC-AUTH-001-E01 | ID空入力エラー | - | 1. `/admin/login`にアクセス<br>2. IDフィールドを空のまま<br>3. PWに任意の値を入力<br>4. ログインボタンをクリック | ID: (空)<br>PW: `test` | エラーメッセージが表示され、ログインが実行されない | 「管理者IDとパスワードを入力してください」 |
| TC-AUTH-001-E02 | パスワード空入力エラー | - | 1. `/admin/login`にアクセス<br>2. IDに任意の値を入力<br>3. PWフィールドを空のまま<br>4. ログインボタンをクリック | ID: `admin`<br>PW: (空) | エラーメッセージが表示され、ログインが実行されない | 「管理者IDとパスワードを入力してください」 |
| TC-AUTH-001-E03 | 両方空入力エラー | - | 1. `/admin/login`にアクセス<br>2. 両フィールドを空のまま<br>3. ログインボタンをクリック | ID: (空)<br>PW: (空) | エラーメッセージが表示され、ログインが実行されない | 「管理者IDとパスワードを入力してください」 |
| TC-AUTH-001-E04 | 存在しないID | - | 1. `/admin/login`にアクセス<br>2. 登録されていないIDを入力<br>3. ログインボタンをクリック | ID: `nonexistent`<br>PW: `password` | エラーメッセージが表示される | 「管理者IDまたはパスワードが正しくありません」 |
| TC-AUTH-001-E05 | パスワード不一致 | adminsテーブルにユーザーが存在 | 1. `/admin/login`にアクセス<br>2. 正しいIDを入力<br>3. 間違ったパスワードを入力<br>4. ログインボタンをクリック | ID: `admin`<br>PW: `wrongpassword` | エラーメッセージが表示される | 「管理者IDまたはパスワードが正しくありません」 |
| TC-AUTH-001-E06 | 一般教員での管理画面ログイン試行 | teachersテーブルにrole=`general`のユーザーが存在 | 1. `/admin/login`にアクセス<br>2. 一般教員のID/PWを入力<br>3. ログインボタンをクリック | ID: `teacher@example.com`<br>PW: `teacherpass` | エラーメッセージが表示され、ログインが拒否される | 「管理者IDまたはパスワードが正しくありません」 |
| TC-AUTH-001-E07 | SQLインジェクション試行 | - | 1. IDフィールドに攻撃文字列を入力<br>2. ログインボタンをクリック | ID: `admin'; DROP TABLE admins;--`<br>PW: `test` | エラーメッセージが表示されるが、システムに影響なし | 「管理者IDまたはパスワードが正しくありません」 |

#### 2.1.5 境界値テスト

| テストID | テスト項目 | 入力データ | 期待結果 |
|----------|-----------|-----------|---------|
| TC-AUTH-001-B01 | ID最小長 | ID: `a` (1文字) | 認証処理が実行される（ユーザーが存在すればログイン成功） |
| TC-AUTH-001-B02 | ID最大長 | ID: 256文字の文字列 | 認証処理が実行される |
| TC-AUTH-001-B03 | 特殊文字を含むID | ID: `user+test@example.com` | 正常に認証処理が実行される |
| TC-AUTH-001-B04 | 日本語を含むID | ID: `管理者@example.com` | 正常に認証処理が実行される |

---

### 2.2 教員ログイン (TC-AUTH-002)

#### 2.2.1 対象画面・コンポーネント
- 画面URL: `/teacher/login`
- コンポーネント: `components/teacher-login-form.tsx`
- 関連テーブル: `teachers`, `test_sessions`

#### 2.2.2 教員ロール定義

| ロール | role値 | 説明 | アクセス権限 |
|-------|--------|------|------------|
| 一般教員 | general | 試験評価のみ | 担当部屋の学生評価のみ |
| 教科管理者 | subject_admin | 教科全体の管理 | 教科内の全データ閲覧・管理画面アクセス可 |
| 大学管理者 | university_admin | 大学全体の管理 | 大学内の全データ閲覧・管理画面アクセス可 |
| マスター管理者 | master_admin | 全体管理 | 全データ閲覧・全管理機能 |

#### 2.2.3 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | 確認ポイント |
|----------|-----------|---------|---------|-----------|---------|-------------|
| TC-AUTH-002-01 | 一般教員ログイン（単一セッション） | teachersテーブルにユーザーが存在<br>1つのtest_session_idのみに紐づく | 1. `/teacher/login`にアクセス<br>2. 登録済みメールアドレスを入力<br>3. パスワードを入力<br>4. ログインボタンをクリック | Email: `teacher1@dentshowa.ac.jp`<br>PW: `teacherpass` | 1. ローディング表示<br>2. `/teacher/exam-info`に直接遷移<br>3. 試験情報が表示される | sessionStorageに以下が保存される：<br>- teacherId<br>- teacherName<br>- teacherEmail<br>- teacherRole<br>- teacherRoom<br>- universityCode<br>- testSessionId |
| TC-AUTH-002-02 | 一般教員ログイン（複数セッション） | 同一教員が複数のtest_session_idに紐づく | 1. `/teacher/login`にアクセス<br>2. メール・パスワードを入力<br>3. ログインボタンをクリック | Email: `multi-session-teacher@example.com`<br>PW: `password` | 1. セッション選択画面が表示される<br>2. 紐づく全セッションが一覧表示される | - 各セッションの情報（日付、ステータス）が正しく表示される |
| TC-AUTH-002-03 | セッション選択後の遷移 | TC-AUTH-002-02の状態 | 1. 表示されたセッション一覧から任意のセッションをクリック | - | 1. `/teacher/exam-info`に遷移<br>2. 選択したセッションの試験情報が表示される | - testSessionIdが正しく保存される<br>- 担当部屋情報が正しく取得される |
| TC-AUTH-002-04 | sessionStorage保存内容確認 | TC-AUTH-002-01でログイン成功 | 1. ブラウザの開発者ツールを開く<br>2. Application → Session Storage → 対象ドメインを選択<br>3. 保存されているキーと値を確認 | - | 以下のキーが存在し、正しい値が設定されている：<br>- `teacherId`: UUID形式<br>- `teacherName`: 教員名<br>- `teacherEmail`: メールアドレス<br>- `teacherRole`: ロール値<br>- `teacherRoom`: 担当部屋番号<br>- `universityCode`: 大学コード<br>- `testSessionId`: セッションID | 全キーがnullでないこと |
| TC-AUTH-002-05 | パスワード表示/非表示トグル | `/teacher/login`画面表示 | 1. パスワードフィールドに文字を入力<br>2. 目のアイコンをクリック<br>3. 再度クリック | PW: `testpassword` | 1. 初期状態はマスク表示（●●●）<br>2. アイコンクリックで平文表示<br>3. 再クリックでマスク表示に戻る | - input type属性がpassword⇔textで切り替わる |
| TC-AUTH-002-06 | Enterキーでのログイン | `/teacher/login`画面表示 | 1. メール・パスワードを入力<br>2. パスワードフィールドでEnterキーを押下 | Email: `teacher@example.com`<br>PW: `password` | ログインボタンクリックと同じ動作（認証処理が実行される） | - フォームsubmitが正しく動作する |

#### 2.2.4 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | エラーメッセージ |
|----------|-----------|---------|---------|-----------|---------|----------------|
| TC-AUTH-002-E01 | メールアドレス空入力 | - | 1. メールフィールドを空のまま<br>2. パスワードを入力<br>3. ログインボタンをクリック | Email: (空)<br>PW: `test` | エラーメッセージ表示、ログイン不可 | 「IDとパスワードを入力してください」 |
| TC-AUTH-002-E02 | パスワード空入力 | - | 1. メールを入力<br>2. パスワードフィールドを空のまま<br>3. ログインボタンをクリック | Email: `test@example.com`<br>PW: (空) | エラーメッセージ表示、ログイン不可 | 「IDとパスワードを入力してください」 |
| TC-AUTH-002-E03 | 未登録メールアドレス | - | 1. 未登録のメールアドレスを入力<br>2. ログインボタンをクリック | Email: `notexist@example.com`<br>PW: `password` | エラーメッセージ表示 | 「IDまたはパスワードが正しくありません」 |
| TC-AUTH-002-E04 | パスワード不一致 | teachersテーブルにユーザーが存在 | 1. 正しいメールを入力<br>2. 間違ったパスワードを入力<br>3. ログインボタンをクリック | Email: `teacher@example.com`<br>PW: `wrongpass` | エラーメッセージ表示 | 「IDまたはパスワードが正しくありません」 |
| TC-AUTH-002-E05 | セッション未割当教員 | teachersテーブルにユーザー存在<br>test_session_idがnull | 1. セッション未割当の教員でログイン | Email: `unassigned@example.com`<br>PW: `password` | 適切なエラーまたはセッション選択画面で「該当するセッションがありません」と表示 | - |
| TC-AUTH-002-E06 | 部屋未割当教員 | teachersテーブルにユーザー存在<br>assigned_room_numberがnull | 1. 部屋未割当の教員でログイン<br>2. セッションを選択 | Email: `noroom@example.com`<br>PW: `password` | 試験情報画面で「担当部屋が割り当てられていません」と表示される | - |

#### 2.2.5 画面遷移テスト

| テストID | テスト項目 | 開始状態 | 操作 | 期待される遷移先 |
|----------|-----------|---------|------|----------------|
| TC-AUTH-002-N01 | ログイン成功→試験情報画面 | `/teacher/login` | ログイン成功（単一セッション） | `/teacher/exam-info` |
| TC-AUTH-002-N02 | ログイン成功→セッション選択 | `/teacher/login` | ログイン成功（複数セッション） | セッション選択画面（同一URL内） |
| TC-AUTH-002-N03 | トップページリンク | `/teacher/login` | ロゴまたはタイトルをクリック | `/` |
| TC-AUTH-002-N04 | 戻るボタン | `/teacher/exam-info` | ブラウザの戻るボタン | `/teacher/login`（sessionStorageがクリアされていない場合は再ログインが必要な場合あり） |

---

### 2.3 患者役ログイン (TC-AUTH-003)

#### 2.3.1 対象画面・コンポーネント
- 画面URL: `/patient/login`
- コンポーネント: `components/patient-login-form.tsx`
- 関連テーブル: `patients`, `test_sessions`

#### 2.3.2 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | 確認ポイント |
|----------|-----------|---------|---------|-----------|---------|-------------|
| TC-AUTH-003-01 | 患者役ログイン（単一セッション） | patientsテーブルにユーザーが存在<br>1つのtest_session_idに紐づく | 1. `/patient/login`にアクセス<br>2. 登録済みメールアドレスを入力<br>3. パスワードを入力<br>4. ログインボタンをクリック | Email: `patient1@dentshowa.ac.jp`<br>PW: `patientpass` | 1. ローディング表示<br>2. `/patient/exam-info`に直接遷移 | sessionStorageに以下が保存される：<br>- patientId<br>- patientName<br>- patientEmail<br>- patientRoom<br>- universityCode<br>- testSessionId |
| TC-AUTH-003-02 | 患者役ログイン（複数セッション） | 同一患者役が複数のtest_session_idに紐づく | 1. `/patient/login`にアクセス<br>2. メール・パスワードを入力<br>3. ログインボタンをクリック | Email: `multi-patient@example.com`<br>PW: `password` | 1. セッション選択画面が表示される<br>2. 紐づく全セッションが一覧表示される | - 各セッションの日付、大学名が正しく表示される |
| TC-AUTH-003-03 | セッション選択後の遷移 | TC-AUTH-003-02の状態 | 1. 表示されたセッション一覧から任意のセッションをクリック | - | 1. `/patient/exam-info`に遷移<br>2. 選択したセッションの試験情報が表示される | - testSessionIdが正しく保存される |
| TC-AUTH-003-04 | sessionStorage保存内容確認 | TC-AUTH-003-01でログイン成功 | 開発者ツールでsessionStorageを確認 | - | 以下のキーが存在：<br>- `patientId`<br>- `patientName`<br>- `patientEmail`<br>- `patientRoom`<br>- `universityCode`<br>- `testSessionId` | 全キーがnullでないこと |
| TC-AUTH-003-05 | パスワード表示/非表示トグル | `/patient/login`画面表示 | 1. パスワードを入力<br>2. 目のアイコンをクリック | PW: `testpass` | パスワードの表示/非表示が切り替わる | - |

#### 2.3.3 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | エラーメッセージ |
|----------|-----------|---------|---------|-----------|---------|----------------|
| TC-AUTH-003-E01 | ID空入力 | - | 1. IDを空のままログイン | ID: (空)<br>PW: `test` | エラーメッセージ表示 | 「患者担当者IDとパスワードを入力してください」 |
| TC-AUTH-003-E02 | パスワード空入力 | - | 1. パスワードを空のままログイン | ID: `patient@example.com`<br>PW: (空) | エラーメッセージ表示 | 「患者担当者IDとパスワードを入力してください」 |
| TC-AUTH-003-E03 | 認証エラー | - | 1. 不正なID/PWでログイン | ID: `wrong@example.com`<br>PW: `wrongpass` | エラーメッセージ表示 | 「患者担当者IDまたはパスワードが正しくありません」 |
| TC-AUTH-003-E04 | 教員IDで患者役ログイン試行 | teachersテーブルにユーザー存在 | 1. 教員のID/PWで患者役ログイン試行 | ID: `teacher@example.com`<br>PW: `teacherpass` | 認証エラー | 「患者担当者IDまたはパスワードが正しくありません」 |

---

## 3. 試験管理機能テスト

### 3.1 テストセッション管理 (TC-SESSION-001)

#### 3.1.1 対象画面・コンポーネント
- セッション選択: `components/admin-login-form.tsx`（ログイン後画面）
- ダッシュボード: `/admin/dashboard`, `components/admin-dashboard.tsx`
- 関連テーブル: `test_sessions`, `universities`, `subjects`

#### 3.1.2 test_sessionsテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| test_date | date | 試験実施日 | NOT NULL |
| description | text | テスト名・説明 | - |
| status | text | ステータス | `not_started`, `in_progress`, `completed` |
| university_code | text | 大学コード | FK → universities |
| subject_code | varchar | 教科コード | FK → subjects |
| passing_score | integer | 合格基準点 | - |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

#### 3.1.3 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-SESSION-001-01 | セッション一覧表示 | マスター管理者でログイン済み<br>複数セッションが登録済み | 1. ログイン後の画面を確認 | - | 1. 全セッションがカード形式で表示される<br>2. 各カードに日付、大学名、教科名、ステータスが表示される | - |
| TC-SESSION-001-02 | 大学フィルタ適用 | マスター管理者でログイン<br>複数大学のセッションが存在 | 1. 大学フィルタをクリック<br>2. `昭和大学歯学部`を選択 | フィルタ: `dentshowa` | dentshowaの付いたセッションのみ表示される | - |
| TC-SESSION-001-03 | 教科フィルタ適用 | 複数教科のセッションが存在 | 1. 教科フィルタをクリック<br>2. 特定教科を選択 | フィルタ: `歯科` | 選択した教科のセッションのみ表示される | - |
| TC-SESSION-001-04 | ステータスフィルタ：未実施 | 各ステータスのセッションが存在 | 1. ステータスフィルタで`未実施`を選択 | フィルタ: `not_started` | statusが`not_started`のセッションのみ表示 | - |
| TC-SESSION-001-05 | ステータスフィルタ：実施中 | 各ステータスのセッションが存在 | 1. ステータスフィルタで`実施中`を選択 | フィルタ: `in_progress` | statusが`in_progress`のセッションのみ表示 | - |
| TC-SESSION-001-06 | ステータスフィルタ：テスト終了 | 各ステータスのセッションが存在 | 1. ステータスフィルタで`テスト終了`を選択 | フィルタ: `completed` | statusが`completed`のセッションのみ表示 | - |
| TC-SESSION-001-07 | 複合フィルタ適用 | 複数条件に該当するセッションが存在 | 1. 大学フィルタを選択<br>2. 教科フィルタを選択<br>3. ステータスフィルタを選択 | 大学: `dentshowa`<br>教科: `歯科`<br>ステータス: `in_progress` | 全条件を満たすセッションのみ表示される | - |
| TC-SESSION-001-08 | フィルタリセット | フィルタが適用された状態 | 1. 「リセット」ボタンをクリック | - | 全フィルタがクリアされ、全セッションが表示される | - |
| TC-SESSION-001-09 | セッション新規作成 | マスター管理者でログイン済み | 1. 「新規テスト」ボタンをクリック<br>2. 必要情報を入力<br>3. 「作成」ボタンをクリック | テスト名: `第2回試験`<br>日付: `2026-06-01`<br>大学: `dentshowa`<br>教科: `歯科` | 1. 成功メッセージが表示される<br>2. 新しいセッションが一覧に追加される | test_sessionsテーブルに新レコードが追加される<br>status: `not_started` |
| TC-SESSION-001-10 | セッション詳細表示 | セッションが存在 | 1. セッションカードをクリック | - | `/admin/dashboard`に遷移し、選択したセッションの詳細が表示される | - |

#### 3.1.4 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-SESSION-001-E01 | セッション0件 | 該当条件のセッションが0件 | 1. 条件に一致しないフィルタを適用 | 「該当するセッションがありません」と表示される |
| TC-SESSION-001-E02 | 必須項目未入力で作成 | 新規作成ダイアログ表示中 | 1. テスト名を空のまま作成ボタンをクリック | バリデーションエラーが表示される |
| TC-SESSION-001-E03 | 過去日付でのセッション作成 | 新規作成ダイアログ表示中 | 1. 過去の日付を入力<br>2. 作成ボタンをクリック | 作成は許可される（過去日付でも作成可能な仕様の場合） |

---

### 3.2 問題管理 (TC-QUESTION-001)

#### 3.2.1 対象画面・コンポーネント
- 一覧画面: `/admin/question-management`
- 作成画面: `/admin/question-management/create`
- 編集画面: `/admin/question-management/edit/[id]`
- 関連テーブル: `tests`, `sheets`, `categories`, `questions`

#### 3.2.2 questionsテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| category_id | uuid | カテゴリID | FK → categories |
| number | integer | 問題番号 | NOT NULL |
| text | text | 問題文 | NOT NULL |
| option1 | text | 選択肢1 | - |
| option2 | text | 選択肢2 | - |
| option3 | text | 選択肢3 | - |
| option4 | text | 選択肢4 | - |
| option5 | text | 選択肢5 | - |
| is_alert_target | boolean | アラート対象フラグ | DEFAULT false |
| alert_options | array | アラート対象選択肢 | 例: `[1, 2]` |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

#### 3.2.3 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-QUESTION-001-01 | 問題一覧表示 | 管理者ログイン済み<br>問題が登録済み | 1. `/admin/question-management`にアクセス | - | 登録済みの問題が一覧表示される<br>テスト→シート→カテゴリ→問題の階層で表示 | - |
| TC-QUESTION-001-02 | テスト選択 | 複数のテストが存在 | 1. テスト選択ドロップダウンをクリック<br>2. 任意のテストを選択 | テスト: `教員用評価シート` | 選択したテストの問題のみ表示される | - |
| TC-QUESTION-001-03 | 問題新規作成 | 管理者ログイン済み | 1. `/admin/question-management/create`にアクセス<br>2. テストを選択<br>3. シートを選択<br>4. カテゴリを選択<br>5. 問題番号を入力<br>6. 問題文を入力<br>7. 選択肢1-5を入力<br>8. 「保存」ボタンをクリック | 問題番号: `1`<br>問題文: `患者への挨拶は適切でしたか？`<br>選択肢1: `まったくできていない`<br>選択肢2: `あまりできていない`<br>選択肢3: `どちらともいえない`<br>選択肢4: `ほぼできている`<br>選択肢5: `完全にできている` | 1. 成功メッセージが表示される<br>2. 一覧画面に遷移し、新しい問題が表示される | questionsテーブルに新レコードが追加される |
| TC-QUESTION-001-04 | 問題編集 | 問題が存在 | 1. 問題一覧から編集したい問題の編集ボタンをクリック<br>2. `/admin/question-management/edit/[id]`に遷移<br>3. 問題文を変更<br>4. 「保存」ボタンをクリック | 変更後問題文: `患者への初回挨拶は適切でしたか？` | 1. 成功メッセージが表示される<br>2. 一覧画面で変更が反映されている | questionsテーブルのtextカラムが更新される |
| TC-QUESTION-001-05 | アラート対象設定 | 問題編集画面表示中 | 1. 「アラート対象」チェックボックスをON<br>2. アラート対象選択肢で`1`と`2`を選択<br>3. 保存 | is_alert_target: `true`<br>alert_options: `[1, 2]` | 設定が保存され、評価時にこれらの選択肢を選ぶとアラートフラグが立つ | is_alert_target: true<br>alert_options: [1, 2] |
| TC-QUESTION-001-06 | アラート対象解除 | アラート対象設定済みの問題 | 1. 「アラート対象」チェックボックスをOFF<br>2. 保存 | is_alert_target: `false` | アラート対象が解除される | is_alert_target: false |
| TC-QUESTION-001-07 | 選択肢部分入力 | 問題作成画面 | 1. 選択肢1-3のみ入力<br>2. 選択肢4-5は空のまま<br>3. 保存 | option1-3のみ入力 | 問題が作成され、選択肢4-5は空として保存される | option4, option5がnullまたは空文字 |
| TC-QUESTION-001-08 | 問題削除 | 問題が存在 | 1. 削除したい問題の削除ボタンをクリック<br>2. 確認ダイアログで「削除」をクリック | - | 1. 成功メッセージが表示される<br>2. 一覧から問題が削除される | questionsテーブルから該当レコードが削除される |
| TC-QUESTION-001-09 | 問題番号順の表示 | 同一カテゴリに複数問題が存在 | 問題一覧を確認 | - | 問題がnumber順に昇順で表示される | - |
| TC-QUESTION-001-10 | カテゴリ順の表示 | 同一シートに複数カテゴリが存在 | 問題一覧を確認 | - | カテゴリがnumber順に表示され、その中で問題がnumber順に表示される | - |

#### 3.2.4 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-QUESTION-001-E01 | 必須項目未入力 | 問題作成画面 | 1. 問題文を空のまま保存 | バリデーションエラーが表示される |
| TC-QUESTION-001-E02 | カテゴリ未選択 | 問題作成画面 | 1. カテゴリを選択せずに保存 | カテゴリ選択が必須である旨のエラー |
| TC-QUESTION-001-E03 | 重複問題番号 | 同一カテゴリに問題番号1が存在 | 1. 同一カテゴリで問題番号1を入力<br>2. 保存 | 重複エラーまたは自動採番される |

---

## 4. マスタ管理機能テスト

### 4.1 大学管理 (TC-MASTER-001)

#### 4.1.1 対象画面・コンポーネント
- 画面URL: `/admin/university-management`
- 関連テーブル: `universities`

#### 4.1.2 universitiesテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| university_code | text | 大学コード | NOT NULL, UNIQUE |
| university_name | text | 大学名 | NOT NULL |
| department_name | text | 学部名 | - |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

#### 4.1.3 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-MASTER-001-01 | 大学一覧表示 | マスター管理者でログイン<br>大学が登録済み | 1. `/admin/university-management`にアクセス | - | 登録済み大学が一覧表示される<br>大学コード、大学名、学部名が表示される | - |
| TC-MASTER-001-02 | 大学新規登録 | マスター管理者でログイン | 1. 「新規登録」ボタンをクリック<br>2. 大学情報を入力<br>3. 「登録」ボタンをクリック | 大学コード: `tokyomed`<br>大学名: `東京医科大学`<br>学部名: `医学部` | 1. 成功メッセージが表示される<br>2. 一覧に新しい大学が追加される | universitiesテーブルに新レコードが追加される |
| TC-MASTER-001-03 | 大学情報編集 | 大学が登録済み | 1. 編集したい大学の編集ボタンをクリック<br>2. 大学名を変更<br>3. 「保存」ボタンをクリック | 変更後大学名: `東京医科大学（変更後）` | 変更が反映される | university_nameが更新される |
| TC-MASTER-001-04 | 大学削除 | 大学が登録済み<br>関連データなし | 1. 削除したい大学の削除ボタンをクリック<br>2. 確認ダイアログで「削除」をクリック | - | 1. 成功メッセージが表示される<br>2. 一覧から大学が削除される | universitiesテーブルから該当レコードが削除される |
| TC-MASTER-001-05 | 大学一括登録 | マスター管理者でログイン | 1. 「一括登録」ボタンをクリック<br>2. CSVファイルをアップロード<br>3. 「登録」ボタンをクリック | CSVファイル（複数大学データ） | 1. 成功メッセージが表示される<br>2. 全大学が一覧に追加される | 複数レコードが追加される |
| TC-MASTER-001-06 | 大学検索 | 複数大学が登録済み | 1. 検索フィールドに大学名の一部を入力 | 検索: `昭和` | 検索条件に一致する大学のみ表示される | - |

#### 4.1.4 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-MASTER-001-E01 | 大学コード重複 | university_code: `dentshowa`が存在 | 1. 同一大学コードで新規登録を試行 | 重複エラーが表示される |
| TC-MASTER-001-E02 | 必須項目未入力 | 新規登録ダイアログ表示中 | 1. 大学コードを空のまま登録 | バリデーションエラーが表示される |
| TC-MASTER-001-E03 | 関連データありの削除 | 大学に関連するセッションが存在 | 1. 大学を削除しようとする | 関連データがあるため削除できない旨のエラー、または確認ダイアログ |

---

### 4.2 教科管理 (TC-MASTER-002)

#### 4.2.1 対象画面・コンポーネント
- 画面URL: `/admin/subject-management`
- 関連テーブル: `subjects`

#### 4.2.2 subjectsテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| subject_code | varchar | 教科コード | NOT NULL, UNIQUE |
| subject_name | varchar | 教科名 | NOT NULL |
| university_code | varchar | 所属大学コード | FK → universities |
| description | text | 説明 | - |
| is_active | boolean | 有効フラグ | DEFAULT true |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

#### 4.2.3 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-MASTER-002-01 | 教科一覧表示 | 管理者ログイン済み<br>教科が登録済み | 1. `/admin/subject-management`にアクセス | - | 登録済み教科が一覧表示される | - |
| TC-MASTER-002-02 | 教科新規登録 | 管理者ログイン済み | 1. 「新規登録」ボタンをクリック<br>2. 教科情報を入力<br>3. 「登録」ボタンをクリック | 教科コード: `oral`<br>教科名: `口腔外科`<br>大学: `dentshowa` | 教科が登録される | subjectsテーブルに新レコードが追加される |
| TC-MASTER-002-03 | 教科編集 | 教科が登録済み | 1. 編集ボタンをクリック<br>2. 教科名を変更<br>3. 保存 | 変更後教科名: `口腔外科学` | 変更が反映される | subject_nameが更新される |
| TC-MASTER-002-04 | 教科無効化 | 教科が登録済み | 1. 対象教科の「無効化」ボタンをクリック | - | is_activeがfalseになり、一覧で無効表示される | is_active: false |
| TC-MASTER-002-05 | 教科有効化 | 無効化された教科が存在 | 1. 対象教科の「有効化」ボタンをクリック | - | is_activeがtrueになる | is_active: true |
| TC-MASTER-002-06 | 大学別フィルタ | 複数大学の教科が存在 | 1. 大学フィルタで特定大学を選択 | フィルタ: `dentshowa` | 選択した大学の教科のみ表示される | - |

#### 4.2.4 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-MASTER-002-E01 | 教科コード重複 | subject_code: `dent`が存在 | 1. 同一教科コードで新規登録 | 重複エラーが表示される |
| TC-MASTER-002-E02 | 必須項目未入力 | 新規登録画面 | 1. 教科名を空のまま登録 | バリデーションエラー |
| TC-MASTER-002-E03 | 存在しない大学コード | 新規登録画面 | 1. 存在しない大学コードを入力 | 外部キー制約エラーまたはバリデーションエラー |

---

### 4.3 部屋管理 (TC-MASTER-003)

#### 4.3.1 対象画面・コンポーネント
- 画面URL: `/admin/room-management`
- 関連テーブル: `rooms`

#### 4.3.2 roomsテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| room_number | text | 部屋番号 | NOT NULL |
| room_name | text | 部屋名 | - |
| university_code | text | 大学コード | FK → universities |
| subject_code | varchar | 教科コード | FK → subjects |
| test_session_id | uuid | テストセッションID | FK → test_sessions |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

#### 4.3.3 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-MASTER-003-01 | 部屋一覧表示 | 管理者ログイン済み<br>部屋が登録済み | 1. `/admin/room-management`にアクセス | - | 登録済み部屋が一覧表示される | - |
| TC-MASTER-003-02 | 部屋新規登録 | 管理者ログイン済み<br>テストセッションが選択済み | 1. 「新規登録」ボタンをクリック<br>2. 部屋情報を入力<br>3. 「登録」ボタンをクリック | 部屋番号: `101`<br>部屋名: `第1試験室` | 部屋が登録される | roomsテーブルに新レコードが追加される |
| TC-MASTER-003-03 | 部屋編集 | 部屋が登録済み | 1. 編集ボタンをクリック<br>2. 部屋名を変更<br>3. 保存 | 変更後部屋名: `第1試験室A` | 変更が反映される | room_nameが更新される |
| TC-MASTER-003-04 | 部屋削除 | 部屋が登録済み<br>関連データなし | 1. 削除ボタンをクリック<br>2. 確認で「削除」 | - | 部屋が削除される | roomsテーブルから該当レコードが削除される |
| TC-MASTER-003-05 | セッション別フィルタ | 複数セッションの部屋が存在 | 1. セッションフィルタで特定セッションを選択 | - | 選択したセッションの部屋のみ表示される | - |
| TC-MASTER-003-06 | 部屋番号でソート | 複数部屋が存在 | 1. 部屋番号ヘッダをクリック | - | 部屋番号で昇順/降順にソートされる | - |

#### 4.3.4 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-MASTER-003-E01 | 同一セッション内で部屋番号重複 | 同一セッションにroom_number: `101`が存在 | 1. 同一部屋番号で新規登録 | 重複エラーまたは警告 |
| TC-MASTER-003-E02 | 教員・学生が割当済みの部屋削除 | 部屋に教員・学生が割り当て済み | 1. 部屋を削除しようとする | 関連データがあるため削除できない旨のエラー |

---

### 4.4 ユーザー管理 (TC-MASTER-004)

#### 4.4.1 学生管理

##### 対象画面・コンポーネント
- 一覧画面: `/admin/students-list`
- 登録画面: `/admin/register-students`
- 詳細画面: `/admin/students-detail`
- 関連テーブル: `students`

##### studentsテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| student_id | text | 学籍番号 | NOT NULL |
| name | text | 氏名 | NOT NULL |
| email | text | メールアドレス | - |
| department | text | 学部 | - |
| university_code | text | 大学コード | FK → universities |
| subject_code | varchar | 教科コード | FK → subjects |
| room_number | text | 担当部屋番号 | - |
| test_session_id | uuid | テストセッションID | FK → test_sessions |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

##### 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-MASTER-004-01 | 学生一覧表示 | 管理者ログイン済み<br>学生が登録済み | 1. `/admin/students-list`にアクセス | - | 登録済み学生が一覧表示される<br>学籍番号、氏名、部屋番号が表示される | - |
| TC-MASTER-004-02 | 学生新規登録 | 管理者ログイン済み | 1. `/admin/register-students`にアクセス<br>2. 学生情報を入力<br>3. 「登録」ボタンをクリック | 学籍番号: `2026001`<br>氏名: `山田太郎`<br>メール: `yamada@example.com`<br>部屋: `101` | 学生が登録される | studentsテーブルに新レコードが追加される |
| TC-MASTER-004-03 | 学生一括登録 | 管理者ログイン済み | 1. 「CSV一括登録」ボタンをクリック<br>2. CSVファイルをアップロード<br>3. 「登録」ボタンをクリック | CSVファイル（複数学生データ） | 全学生が登録される | 複数レコードが追加される |
| TC-MASTER-004-04 | 学生詳細表示 | 学生が登録済み | 1. 一覧から学生をクリック<br>2. `/admin/students-detail`に遷移 | - | 学生の詳細情報、評価結果が表示される | - |
| TC-MASTER-004-05 | 学生検索 | 複数学生が登録済み | 1. 検索フィールドに学籍番号または氏名を入力 | 検索: `山田` | 検索条件に一致する学生のみ表示される | - |
| TC-MASTER-004-06 | 部屋別フィルタ | 複数部屋に学生が存在 | 1. 部屋フィルタで特定部屋を選択 | フィルタ: `101` | 選択した部屋の学生のみ表示される | - |

#### 4.4.2 教員管理

##### 対象画面・コンポーネント
- 一覧画面: `/admin/teachers-list`
- 登録画面: `/admin/register-teachers`
- 関連テーブル: `teachers`

##### teachersテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| name | text | 氏名 | NOT NULL |
| email | text | メールアドレス | NOT NULL, UNIQUE |
| password | text | パスワード | NOT NULL |
| role | text | 権限 | `general`, `subject_admin`, `university_admin`, `master_admin` |
| subject_role | varchar | 教科権限 | - |
| assigned_room_number | text | 担当部屋番号 | - |
| university_code | text | 大学コード | FK → universities |
| subject_code | varchar | 教科コード | FK → subjects |
| test_session_id | uuid | テストセッションID | FK → test_sessions |
| account_type | varchar | アカウント種別 | - |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

##### 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-MASTER-004-07 | 教員一覧表示 | 管理者ログイン済み<br>教員が登録済み | 1. `/admin/teachers-list`にアクセス | - | 登録済み教員が一覧表示される | - |
| TC-MASTER-004-08 | 教員新規登録 | 管理者ログイン済み | 1. `/admin/register-teachers`にアクセス<br>2. 教員情報を入力<br>3. 「登録」ボタンをクリック | 氏名: `佐藤教授`<br>メール: `sato@dentshowa.ac.jp`<br>パスワード: `teacherpass`<br>権限: `general`<br>部屋: `101` | 教員が登録される | teachersテーブルに新レコードが追加される |
| TC-MASTER-004-09 | 教員権限設定：一般 | 教員登録画面 | 1. 権限で「一般教員」を選択<br>2. 登録 | role: `general` | 一般教員として登録される | role: `general` |
| TC-MASTER-004-10 | 教員権限設定：教科管理者 | 教員登録画面 | 1. 権限で「教科管理者」を選択<br>2. 登録 | role: `subject_admin` | 教科管理者として登録される<br>管理画面へのアクセス権が付与される | role: `subject_admin` |
| TC-MASTER-004-11 | 教員権限設定：大学管理者 | 教員登録画面 | 1. 権限で「大学管理者」を選択<br>2. 登録 | role: `university_admin` | 大学管理者として登録される | role: `university_admin` |
| TC-MASTER-004-12 | 教員権限設定：マスター管理者 | 教員登録画面 | 1. 権限で「マスター管理者」を選択<br>2. 登録 | role: `master_admin` | マスター管理者として登録される | role: `master_admin` |
| TC-MASTER-004-13 | 教員部屋割当変更 | 教員が登録済み | 1. 教員の編集画面を開く<br>2. 担当部屋を変更<br>3. 保存 | 変更後部屋: `102` | 担当部屋が変更される | assigned_room_numberが更新される |

#### 4.4.3 患者役管理

##### 対象画面・コンポーネント
- 一覧画面: `/admin/patients-list`
- 登録画面: `/admin/register-patients`
- 関連テーブル: `patients`

##### patientsテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| name | text | 氏名 | NOT NULL |
| email | text | メールアドレス | NOT NULL, UNIQUE |
| password | text | パスワード | NOT NULL |
| role | text | 権限 | - |
| assigned_room_number | text | 担当部屋番号 | - |
| university_code | text | 大学コード | FK → universities |
| subject_code | varchar | 教科コード | FK → subjects |
| test_session_id | uuid | テストセッションID | FK → test_sessions |
| account_type | varchar | アカウント種別 | - |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

##### 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-MASTER-004-14 | 患者役一覧表示 | 管理者ログイン済み<br>患者役が登録済み | 1. `/admin/patients-list`にアクセス | - | 登録済み患者役が一覧表示される | - |
| TC-MASTER-004-15 | 患者役新規登録 | 管理者ログイン済み | 1. `/admin/register-patients`にアクセス<br>2. 患者役情報を入力<br>3. 「登録」ボタンをクリック | 氏名: `田中花子`<br>メール: `tanaka@example.com`<br>パスワード: `patientpass`<br>部屋: `101` | 患者役が登録される | patientsテーブルに新レコードが追加される |
| TC-MASTER-004-16 | 患者役一括登録 | 管理者ログイン済み | 1. 「CSV一括登録」ボタンをクリック<br>2. CSVファイルをアップロード<br>3. 「登録」 | CSVファイル | 全患者役が登録される | 複数レコードが追加される |
| TC-MASTER-004-17 | 患者役部屋割当変更 | 患者役が登録済み | 1. 患者役の編集画面を開く<br>2. 担当部屋を変更<br>3. 保存 | 変更後部屋: `102` | 担当部屋が変更される | assigned_room_numberが更新される |

---

## 5. 試験実施機能テスト

### 5.1 教員試験実施 (TC-EXAM-001)

#### 5.1.1 対象画面・コンポーネント
- 試験情報画面: `/teacher/exam-info`, `components/exam-info-screen.tsx`
- 試験画面: `/teacher/exam`, `components/teacher-exam-tabs.tsx`
- 結果画面: `/teacher/results`
- 関連テーブル: `attendance_records`, `exam_results`, `students`, `questions`

#### 5.1.2 attendance_recordsテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| student_id | text | 学籍番号 | NOT NULL |
| room_number | text | 部屋番号 | NOT NULL |
| status | text | 出席状態 | `present`, `absent`, `unknown` |
| university_code | text | 大学コード | - |
| subject_code | varchar | 教科コード | - |
| test_session_id | uuid | テストセッションID | FK → test_sessions |
| recorded_at | timestamp | 記録日時 | - |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

#### 5.1.3 exam_resultsテーブル詳細

| カラム | 型 | 説明 | 制約 |
|-------|---|------|------|
| id | uuid | 主キー | NOT NULL, PRIMARY KEY |
| student_id | text | 学籍番号 | NOT NULL |
| room_number | text | 部屋番号 | NOT NULL |
| evaluator_type | text | 評価者種別 | `teacher`, `patient` |
| evaluator_email | text | 評価者メール | NOT NULL |
| evaluations | jsonb | 評価データ | `{"q1": 4, "q2": 5, ...}` |
| total_score | integer | 合計点 | - |
| is_completed | boolean | 入力完了フラグ | DEFAULT false |
| has_alert | boolean | アラートフラグ | DEFAULT false |
| test_id | uuid | テストID | FK → tests |
| test_session_id | uuid | テストセッションID | FK → test_sessions |
| university_code | text | 大学コード | - |
| subject_code | varchar | 教科コード | - |
| created_at | timestamp | 作成日時 | NOT NULL |
| updated_at | timestamp | 更新日時 | NOT NULL |

#### 5.1.4 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-EXAM-001-01 | 試験情報画面表示 | 教員ログイン済み | 1. `/teacher/exam-info`にアクセス | - | 以下の情報が表示される：<br>- 試験名<br>- 実施日<br>- 担当部屋番号<br>- 問題数<br>- 注意事項 | - |
| TC-EXAM-001-02 | 試験開始 | 試験情報画面表示中 | 1. 「試験を開始する」ボタンをクリック | - | 1. `/teacher/exam`に遷移<br>2. 担当学生一覧が表示される | - |
| TC-EXAM-001-03 | 担当学生一覧表示 | 試験画面表示中 | 画面を確認 | - | 1. 担当部屋の学生がタブまたはリストで表示される<br>2. 各学生の学籍番号、氏名が表示される<br>3. 出席状態が表示される | - |
| TC-EXAM-001-04 | 出席登録 | 試験画面、学生選択 | 1. 学生タブを選択<br>2. 「出席」ボタンをクリック | - | 1. 出席状態が「出席」に変更される<br>2. ボタンが選択状態になる<br>3. 評価入力が有効になる | attendance_recordsテーブルにstatus: `present`で保存される |
| TC-EXAM-001-05 | 欠席登録 | 試験画面、学生選択 | 1. 学生タブを選択<br>2. 「欠席」ボタンをクリック | - | 1. 出席状態が「欠席」に変更される<br>2. 評価入力が無効になる | attendance_recordsテーブルにstatus: `absent`で保存される |
| TC-EXAM-001-06 | 出席状態変更（出席→欠席） | 学生が出席状態 | 1. 「欠席」ボタンをクリック | - | 1. 出席状態が「欠席」に変更される<br>2. 入力済み評価がクリアされるか確認ダイアログが表示される | attendance_recordsテーブルが更新される |
| TC-EXAM-001-07 | 評価入力（単一問題） | 学生が出席状態 | 1. 問題1の選択肢「4」をクリック | 選択: `4` | 1. 選択肢4がハイライトされる<br>2. 合計点が更新される | evaluationsに`{"q1": 4}`が保存される |
| TC-EXAM-001-08 | 評価入力（全問題） | 学生が出席状態 | 1. 全問題の選択肢を選択 | 各問題に1-5の選択 | 1. 全選択肢がハイライトされる<br>2. 合計点が正しく計算される | evaluationsに全回答が保存される |
| TC-EXAM-001-09 | 評価変更 | 評価入力済み | 1. 問題1の選択肢を「4」から「5」に変更 | 変更後: `5` | 1. 選択肢5がハイライトされる<br>2. 合計点が再計算される | evaluationsが更新される |
| TC-EXAM-001-10 | アラート発生 | アラート対象問題が存在<br>alert_options: [1, 2] | 1. アラート対象問題で選択肢「1」を選択 | 選択: `1` | 1. アラートアイコンが表示される<br>2. has_alertフラグがtrueになる | has_alert: true |
| TC-EXAM-001-11 | アラート解除 | アラート発生中 | 1. アラート対象問題で非アラート選択肢「4」を選択 | 選択: `4` | アラートアイコンが消える | has_alert: false（他にアラートがない場合） |
| TC-EXAM-001-12 | 入力完了 | 全問題回答済み、学生出席 | 1. 「入力完了」ボタンをクリック | - | 1. is_completedがtrueになる<br>2. 評価フィールドが読み取り専用になる<br>3. 「入力完了」ボタンが「編集」ボタンに変わる | is_completed: true |
| TC-EXAM-001-13 | 編集再開 | 入力完了状態 | 1. 「編集」ボタンをクリック | - | 1. is_completedがfalseになる<br>2. 評価フィールドが編集可能になる | is_completed: false |
| TC-EXAM-001-14 | 学生タブ切り替え | 複数学生が存在 | 1. 別の学生タブをクリック | - | 1. 選択した学生の情報が表示される<br>2. 前の学生のデータは保存される | - |
| TC-EXAM-001-15 | 評価完了 | 試験画面表示中 | 1. 「評価完了」ボタンをクリック | - | `/teacher/results`に遷移し、結果画面が表示される | - |
| TC-EXAM-001-16 | 合計点自動計算 | 評価入力中 | 1. 複数問題に回答 | q1: 4, q2: 5, q3: 3 | 合計点が「12」と表示される | total_score: 12 |
| TC-EXAM-001-17 | リアルタイム保存確認 | 評価入力中 | 1. 選択肢を選択<br>2. ページをリロード | - | 選択した回答が保持されている | DBに即座に保存される |

#### 5.1.5 異常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-EXAM-001-E01 | 未出席での評価試行 | 学生が未出席状態 | 1. 評価の選択肢をクリック | 評価入力が無効化されている、またはエラーメッセージ |
| TC-EXAM-001-E02 | 欠席での入力完了試行 | 学生が欠席状態 | 1. 「入力完了」ボタンをクリック | ボタンが無効化されている、または欠席は入力完了不可のメッセージ |
| TC-EXAM-001-E03 | 未回答での入力完了試行 | 一部問題が未回答 | 1. 「入力完了」ボタンをクリック | 全問題への回答を促すメッセージ、または警告後に完了可能 |
| TC-EXAM-001-E04 | セッション切れ | sessionStorageがクリア | 1. 評価入力を試みる | ログイン画面にリダイレクト |
| TC-EXAM-001-E05 | ネットワークエラー | API接続不可 | 1. 評価入力を試みる | エラーメッセージが表示される、リトライ可能 |

---

### 5.2 患者役試験実施 (TC-EXAM-002)

#### 5.2.1 対象画面・コンポーネント
- 試験情報画面: `/patient/exam-info`
- 試験画面: `/patient/exam`, `components/patient-exam-tabs.tsx`
- 結果画面: `/patient/results`
- 関連テーブル: `attendance_records`, `exam_results`

#### 5.2.2 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 入力データ | 期待結果 | DB確認 |
|----------|-----------|---------|---------|-----------|---------|--------|
| TC-EXAM-002-01 | 試験情報画面表示 | 患者役ログイン済み | 1. `/patient/exam-info`にアクセス | - | 試験情報が表示される | - |
| TC-EXAM-002-02 | 試験開始 | 試験情報画面表示中 | 1. 「試験を開始する」ボタンをクリック | - | `/patient/exam`に遷移 | - |
| TC-EXAM-002-03 | 担当学生一覧表示 | 試験画面表示中 | 画面を確認 | - | 担当部屋の学生が表示される | - |
| TC-EXAM-002-04 | 出席登録 | 試験画面、学生選択 | 1. 「出席」ボタンをクリック | - | 出席状態が更新される | status: `present` |
| TC-EXAM-002-05 | 評価入力 | 学生が出席状態 | 1. 各問題の選択肢を選択 | 各問題に1-5の選択 | 回答が記録される | evaluator_type: `patient` |
| TC-EXAM-002-06 | 入力完了 | 全問題回答済み | 1. 「入力完了」ボタンをクリック | - | is_completedがtrueになる | is_completed: true |
| TC-EXAM-002-07 | 評価完了 | 試験画面表示中 | 1. 「評価完了」ボタンをクリック | - | `/patient/results`に遷移 | - |
| TC-EXAM-002-08 | 評価者タイプ確認 | 患者役が評価入力 | DBを確認 | - | evaluator_typeが`patient`で保存される | evaluator_type: `patient` |

#### 5.2.3 教員・患者役の評価データ分離確認

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-EXAM-002-09 | 同一学生への教員・患者役評価 | 教員・患者役が同一学生を評価 | 1. 教員が学生Aを評価<br>2. 患者役が学生Aを評価 | exam_resultsテーブルに2レコード作成される<br>- evaluator_type: `teacher`<br>- evaluator_type: `patient` |
| TC-EXAM-002-10 | 評価者メール保存確認 | 教員・患者役が評価 | DBを確認 | evaluator_emailに各評価者のメールが保存される |

---

### 5.3 データ保存テスト (TC-EXAM-003)

#### 5.3.1 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 | DB確認 |
|----------|-----------|---------|---------|---------|--------|
| TC-EXAM-003-01 | 出席データ保存 | 出席ボタンクリック | 1. 出席ボタンをクリック<br>2. DBを確認 | attendance_recordsテーブルに正しく保存される | - student_id: 対象学籍番号<br>- room_number: 部屋番号<br>- status: `present`<br>- test_session_id: セッションID |
| TC-EXAM-003-02 | 欠席データ保存 | 欠席ボタンクリック | 1. 欠席ボタンをクリック<br>2. DBを確認 | attendance_recordsテーブルに正しく保存される | - status: `absent` |
| TC-EXAM-003-03 | 評価データ保存 | 回答入力 | 1. 各問題に回答<br>2. DBを確認 | exam_resultsテーブルに正しく保存される | - evaluations: JSONBで回答データ<br>- total_score: 合計点<br>- evaluator_type: 評価者種別<br>- evaluator_email: 評価者メール |
| TC-EXAM-003-04 | リアルタイム保存 | 回答入力 | 1. 回答入力<br>2. 即座にDBを確認 | 入力後即座にDBに保存される | - |
| TC-EXAM-003-05 | 評価者タイプ区別 | 教員・患者役両方が評価 | 1. DBを確認 | evaluator_typeで正しく区別される | - teacher/patientが正しく設定 |
| TC-EXAM-003-06 | UPSERTによる更新 | 既存評価データが存在 | 1. 同一学生を再評価 | 新規レコードではなく既存レコードが更新される | - created_atは変わらず<br>- updated_atが更新される |
| TC-EXAM-003-07 | evaluations JSONBフォーマット | 評価入力後 | DBを確認 | evaluationsが正しいJSON形式で保存される | `{"q1": 4, "q2": 5, "q3": 3, ...}` |
| TC-EXAM-003-08 | has_alertフラグ保存 | アラート発生 | 1. アラート対象選択肢を選択<br>2. DBを確認 | has_alertがtrueで保存される | has_alert: true |
| TC-EXAM-003-09 | is_completedフラグ保存 | 入力完了ボタンクリック | 1. 入力完了をクリック<br>2. DBを確認 | is_completedがtrueで保存される | is_completed: true |

#### 5.3.2 データ整合性テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-EXAM-003-10 | 出席データとの整合性 | 出席登録後に欠席に変更 | 1. 出席を登録<br>2. 評価を入力<br>3. 欠席に変更 | 出席データが更新され、評価データの扱いが適切に処理される |
| TC-EXAM-003-11 | セッションID整合性 | 評価入力 | DBを確認 | test_session_idが正しいセッションを指している |
| TC-EXAM-003-12 | 部屋番号整合性 | 評価入力 | DBを確認 | room_numberが正しい部屋番号で保存される |

---

## 6. 結果管理機能テスト

### 6.1 管理者ダッシュボード (TC-RESULT-001)

#### 6.1.1 対象画面・コンポーネント
- 画面URL: `/admin/dashboard`
- コンポーネント: `components/admin-dashboard.tsx`
- 関連テーブル: `rooms`, `students`, `teachers`, `patients`, `attendance_records`, `exam_results`

#### 6.1.2 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 確認ポイント |
|----------|-----------|---------|---------|---------|-------------|
| TC-RESULT-001-01 | ダッシュボード表示 | 管理者ログイン済み<br>セッション選択済み | 1. `/admin/dashboard`にアクセス | 部屋別カード一覧が表示される | - 全部屋がカード形式で表示<br>- 部屋番号順にソートされている |
| TC-RESULT-001-02 | 部屋カード情報表示 | 部屋・教員・患者役が登録済み | 各部屋カードを確認 | 以下の情報が表示される：<br>- 部屋番号<br>- 担当教員名<br>- 担当患者役名<br>- 学生数 | - 教員・患者役がnullの場合は「未割当」と表示 |
| TC-RESULT-001-03 | 出席状況表示 | 出席データが存在 | 部屋カードを確認 | 出席数、欠席数が正しく表示される | 例：「出席: 5 / 欠席: 2」 |
| TC-RESULT-001-04 | 完了状況表示 | 評価データが存在 | 部屋カードを確認 | 入力完了数が表示される | 例：「完了: 5 / 7」 |
| TC-RESULT-001-05 | アラート数表示 | アラートデータが存在 | 部屋カードを確認 | アラート数が正しく表示される | - 赤色でハイライト表示<br>- 0の場合は非表示または灰色 |
| TC-RESULT-001-06 | 平均点表示 | 評価データが存在 | 部屋カードを確認 | 平均点が正しく計算・表示される | - 小数点以下1桁まで表示<br>- 計算: Σ(total_score) / 完了数 |
| TC-RESULT-001-07 | 教員/患者別統計 | 両者の評価データが存在 | 部屋カードを確認 | 教員・患者役それぞれの統計が表示される | - 教員完了数<br>- 教員アラート数<br>- 教員平均点<br>- 患者役完了数<br>- 患者役アラート数<br>- 患者役平均点 |
| TC-RESULT-001-08 | 合格者数表示 | passing_scoreが設定済み<br>評価データが存在 | 部屋カードを確認 | 合格者数が正しく表示される | - 合格判定: total_score >= passing_score<br>- 例：「合格: 4 / 7」 |
| TC-RESULT-001-09 | データ更新 | ダッシュボード表示中 | 1. 「更新」ボタンをクリック | 1. ローディング表示<br>2. 最新データで再描画される | - データ取得中の視覚的フィードバック |
| TC-RESULT-001-10 | 自動更新（ポーリング） | ダッシュボード表示中 | 1. 別タブで評価を入力<br>2. ダッシュボードを確認 | 一定間隔で自動更新される（設定されている場合） | - 更新間隔の確認 |
| TC-RESULT-001-11 | 部屋詳細モーダル表示 | ダッシュボード表示中 | 1. 部屋カードをクリック | 部屋詳細モーダルが表示される | - 学生別評価一覧<br>- 各学生の出席状態<br>- 各学生の合計点<br>- 各学生のアラート状態 |
| TC-RESULT-001-12 | 学生別詳細表示 | 部屋詳細モーダル表示中 | 学生一覧を確認 | 各学生の詳細情報が表示される | - 学籍番号<br>- 氏名<br>- 出席状態<br>- 教員評価点<br>- 患者役評価点<br>- 合計点<br>- アラート有無 |
| TC-RESULT-001-13 | 全体統計サマリー表示 | ダッシュボード表示中 | 画面上部を確認 | 全体の統計サマリーが表示される | - 総学生数<br>- 総出席数<br>- 総完了数<br>- 全体平均点<br>- 全体合格率 |
| TC-RESULT-001-14 | 進捗バー表示 | ダッシュボード表示中 | 部屋カードを確認 | 進捗バーが表示される | - 完了率を視覚的に表示 |

#### 6.1.3 計算ロジックテスト

| テストID | テスト項目 | テストデータ | 期待結果 |
|----------|-----------|-------------|---------|
| TC-RESULT-001-15 | 平均点計算（正常） | 学生A: 80点, 学生B: 90点, 学生C: 70点 | 平均点: 80.0 |
| TC-RESULT-001-16 | 平均点計算（未完了含む） | 学生A: 80点(完了), 学生B: 0点(未完了), 学生C: 70点(完了) | 平均点: 75.0（完了分のみで計算） |
| TC-RESULT-001-17 | 合格率計算 | passing_score: 60, 学生A: 80, 学生B: 50, 学生C: 70 | 合格率: 66.7%（2/3） |
| TC-RESULT-001-18 | アラート集計 | 学生A: has_alert=true, 学生B: has_alert=false, 学生C: has_alert=true | アラート数: 2 |

---

### 6.2 教員結果画面 (TC-RESULT-002)

#### 6.2.1 対象画面・コンポーネント
- 画面URL: `/teacher/results`
- 関連テーブル: `exam_results`, `students`

#### 6.2.2 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-RESULT-002-01 | 結果画面表示 | 教員ログイン、評価完了 | 1. `/teacher/results`にアクセス | 担当学生の評価結果一覧が表示される |
| TC-RESULT-002-02 | 学生別結果表示 | 結果画面表示中 | 結果一覧を確認 | 各学生の学籍番号、氏名、出席状態、合計点、アラート状態が表示される |
| TC-RESULT-002-03 | 入力完了状態表示 | 完了・未完了の学生が存在 | 結果一覧を確認 | 完了/未完了が視覚的に区別される |
| TC-RESULT-002-04 | 試験画面への戻り | 結果画面表示中 | 1. 「戻る」または「試験画面」リンクをクリック | `/teacher/exam`に遷移 |
| TC-RESULT-002-05 | ログアウト | 結果画面表示中 | 1. 「ログアウト」ボタンをクリック | 1. sessionStorageがクリアされる<br>2. `/teacher/login`に遷移 |

---

### 6.3 患者役結果画面 (TC-RESULT-003)

#### 6.3.1 対象画面・コンポーネント
- 画面URL: `/patient/results`
- 関連テーブル: `exam_results`, `students`

#### 6.3.2 正常系テスト

| テストID | テスト項目 | 前提条件 | 操作手順 | 期待結果 |
|----------|-----------|---------|---------|---------|
| TC-RESULT-003-01 | 結果画面表示 | 患者役ログイン、評価完了 | 1. `/patient/results`にアクセス | 担当学生の評価結果一覧が表示される |
| TC-RESULT-003-02 | 学生別結果表示 | 結果画面表示中 | 結果一覧を確認 | 各学生の情報が表示される |
| TC-RESULT-003-03 | ログアウト | 結果画面表示中 | 1. 「ログアウト」ボタンをクリック | 1. sessionStorageがクリアされる<br>2. `/patient/login`に遷移 |

---

## 7. API テスト

### 7.1 大学API (TC-API-001)

#### 7.1.1 エンドポイント一覧

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/universities` | GET | 大学一覧取得 |
| `/api/universities` | POST | 大学新規作成 |
| `/api/universities/[id]` | GET | 大学詳細取得 |
| `/api/universities/[id]` | PUT | 大学更新 |
| `/api/universities/[id]` | DELETE | 大学削除 |
| `/api/universities/bulk` | POST | 大学一括登録 |

#### 7.1.2 正常系テスト

| テストID | エンドポイント | メソッド | リクエストボディ | 期待ステータス | 期待レスポンス |
|----------|---------------|---------|----------------|--------------|--------------|
| TC-API-001-01 | `/api/universities` | GET | - | 200 | `[{id, university_code, university_name, department_name, created_at, updated_at}, ...]` |
| TC-API-001-02 | `/api/universities` | POST | `{"university_code": "tokyomed", "university_name": "東京医科大学", "department_name": "医学部"}` | 201 | `{id, university_code, university_name, department_name, created_at, updated_at}` |
| TC-API-001-03 | `/api/universities/[id]` | GET | - | 200 | `{id, university_code, university_name, department_name, created_at, updated_at}` |
| TC-API-001-04 | `/api/universities/[id]` | PUT | `{"university_name": "東京医科大学（更新）"}` | 200 | `{id, university_code, university_name, department_name, created_at, updated_at}` |
| TC-API-001-05 | `/api/universities/[id]` | DELETE | - | 200 | `{success: true}` |
| TC-API-001-06 | `/api/universities/bulk` | POST | `{"universities": [{"university_code": "univ1", "university_name": "大学1"}, {"university_code": "univ2", "university_name": "大学2"}]}` | 201 | `{inserted: 2, errors: []}` |

#### 7.1.3 異常系テスト

| テストID | エンドポイント | メソッド | リクエスト | 期待ステータス | 期待レスポンス |
|----------|---------------|---------|-----------|--------------|--------------|
| TC-API-001-E01 | `/api/universities` | POST | `{"university_code": ""}` | 400 | `{error: "university_code is required"}` |
| TC-API-001-E02 | `/api/universities` | POST | `{"university_code": "dentshowa"}` (重複) | 409 | `{error: "university_code already exists"}` |
| TC-API-001-E03 | `/api/universities/[id]` | GET | id: 存在しないUUID | 404 | `{error: "University not found"}` |
| TC-API-001-E04 | `/api/universities/[id]` | DELETE | id: 関連データあり | 409 | `{error: "Cannot delete university with related data"}` |

---

### 7.2 教科API (TC-API-002)

#### 7.2.1 エンドポイント一覧

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/subjects` | GET | 教科一覧取得 |
| `/api/subjects` | POST | 教科新規作成 |
| `/api/subjects/[id]` | PUT | 教科更新 |
| `/api/subjects/[id]` | DELETE | 教科削除 |

#### 7.2.2 正常系テスト

| テストID | エンドポイント | メソッド | リクエストボディ | 期待ステータス | 期待レスポンス |
|----------|---------------|---------|----------------|--------------|--------------|
| TC-API-002-01 | `/api/subjects` | GET | - | 200 | `[{id, subject_code, subject_name, university_code, is_active, created_at, updated_at}, ...]` |
| TC-API-002-02 | `/api/subjects` | POST | `{"subject_code": "oral", "subject_name": "口腔外科", "university_code": "dentshowa"}` | 201 | `{id, subject_code, subject_name, university_code, is_active, created_at, updated_at}` |
| TC-API-002-03 | `/api/subjects/[id]` | PUT | `{"subject_name": "口腔外科学"}` | 200 | 更新された教科データ |
| TC-API-002-04 | `/api/subjects/[id]` | DELETE | - | 200 | `{success: true}` |

---

### 7.3 テストセッションAPI (TC-API-003)

#### 7.3.1 エンドポイント一覧

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/test-sessions` | GET | セッション一覧取得 |
| `/api/test-sessions` | POST | セッション新規作成 |
| `/api/test-sessions/[id]` | GET | セッション詳細取得 |
| `/api/test-sessions/[id]` | PUT | セッション更新 |
| `/api/test-sessions/[id]` | DELETE | セッション削除 |

#### 7.3.2 正常系テスト

| テストID | エンドポイント | メソッド | リクエストボディ | 期待ステータス | 期待レスポンス |
|----------|---------------|---------|----------------|--------------|--------------|
| TC-API-003-01 | `/api/test-sessions` | GET | - | 200 | `[{id, test_date, description, status, university_code, subject_code, passing_score, created_at, updated_at}, ...]` |
| TC-API-003-02 | `/api/test-sessions` | POST | `{"test_date": "2026-05-01", "description": "第1回試験", "university_code": "dentshowa", "subject_code": "dent"}` | 201 | 作成されたセッションデータ（status: `not_started`） |
| TC-API-003-03 | `/api/test-sessions/[id]` | GET | - | 200 | セッション詳細データ |
| TC-API-003-04 | `/api/test-sessions/[id]` | PUT | `{"status": "in_progress"}` | 200 | 更新されたセッションデータ |
| TC-API-003-05 | `/api/test-sessions/[id]` | DELETE | - | 200 | `{success: true}` |

#### 7.3.3 クエリパラメータテスト

| テストID | エンドポイント | クエリパラメータ | 期待結果 |
|----------|---------------|----------------|---------|
| TC-API-003-06 | `/api/test-sessions` | `?university_code=dentshowa` | dentshowaのセッションのみ返却 |
| TC-API-003-07 | `/api/test-sessions` | `?subject_code=dent` | 歯科のセッションのみ返却 |
| TC-API-003-08 | `/api/test-sessions` | `?status=in_progress` | 実施中のセッションのみ返却 |
| TC-API-003-09 | `/api/test-sessions` | `?university_code=dentshowa&status=completed` | 複合条件で絞り込み |

---

## 8. 権限テスト

### 8.1 管理者権限マトリクス

| 機能 | special_master | university_master | subject_admin | general |
|------|---------------|-------------------|--------------|---------|
| 全大学データ閲覧 | ✓ | ✗ | ✗ | ✗ |
| 所属大学データ閲覧 | ✓ | ✓ | ✗ | ✗ |
| 所属教科データ閲覧 | ✓ | ✓ | ✓ | ✗ |
| 大学管理 | ✓ | ✗ | ✗ | ✗ |
| 教科管理 | ✓ | ✓ | ✓（参照のみ） | ✗ |
| ユーザー管理 | ✓ | ✓ | ✓ | ✗ |
| 管理画面アクセス | ✓ | ✓ | ✓ | ✗ |

### 8.2 管理者権限テスト (TC-PERM-001)

| テストID | テスト項目 | ユーザー種別 | 操作 | 期待結果 |
|----------|-----------|------------|------|---------|
| TC-PERM-001-01 | 全大学アクセス | special_master | 大学一覧表示 | 全大学が表示される |
| TC-PERM-001-02 | 単一大学アクセス | university_master (dentshowa) | 大学一覧表示 | dentshowaのみ表示される |
| TC-PERM-001-03 | 教科限定アクセス | subject_admin (歯科) | セッション一覧表示 | 歯科のセッションのみ表示される |
| TC-PERM-001-04 | 大学管理機能アクセス | special_master | `/admin/university-management`アクセス | アクセス可能 |
| TC-PERM-001-05 | 大学管理機能拒否 | university_master | `/admin/university-management`アクセス | アクセス不可またはread-only |
| TC-PERM-001-06 | 教科管理機能アクセス | university_master | `/admin/subject-management`アクセス | アクセス可能（所属大学の教科のみ） |
| TC-PERM-001-07 | ユーザー管理機能アクセス | subject_admin | `/admin/teachers-list`アクセス | 担当教科の教員のみ表示 |
| TC-PERM-001-08 | 他大学データへのAPI直接アクセス | university_master (dentshowa) | kanagawadentのデータをAPIで取得試行 | 403 Forbidden |

### 8.3 教員権限テスト (TC-PERM-002)

| テストID | テスト項目 | ユーザー種別 | 操作 | 期待結果 |
|----------|-----------|------------|------|---------|
| TC-PERM-002-01 | 担当部屋のみ評価可能 | general (部屋101担当) | 部屋102の学生評価を試行 | 担当部屋の学生のみ表示される（他部屋の学生は表示されない） |
| TC-PERM-002-02 | 管理画面アクセス拒否 | general | `/admin/dashboard`に直接アクセス | リダイレクトまたはアクセス拒否 |
| TC-PERM-002-03 | 管理画面アクセス許可 | university_admin | `/admin/dashboard`アクセス | アクセス可能 |
| TC-PERM-002-04 | 他教員の評価データ閲覧 | general | 他教員が入力した評価データの閲覧を試行 | 自分の評価データのみ閲覧可能 |
| TC-PERM-002-05 | sessionStorage改ざん | general | sessionStorageのteacherRoomを別の部屋番号に変更 | サーバー側で正しい部屋番号が使用される（改ざん無効） |

### 8.4 患者役権限テスト (TC-PERM-003)

| テストID | テスト項目 | 操作 | 期待結果 |
|----------|-----------|------|---------|
| TC-PERM-003-01 | 担当部屋のみ評価可能 | 他部屋の学生評価を試行 | 担当部屋の学生のみ表示される |
| TC-PERM-003-02 | 管理画面アクセス拒否 | `/admin/dashboard`に直接アクセス | リダイレクトまたはアクセス拒否 |
| TC-PERM-003-03 | 教員画面アクセス拒否 | `/teacher/exam`に直接アクセス | リダイレクトまたはアクセス拒否 |

---

## 9. データ整合性テスト

### 9.1 外部キー整合性テスト (TC-DATA-001)

| テストID | テスト項目 | 操作 | 確認内容 | 期待結果 |
|----------|-----------|------|---------|---------|
| TC-DATA-001-01 | 大学-教科関連 | 大学を削除 | 関連教科の状態 | 関連教科も削除（CASCADE）または参照整合性エラー |
| TC-DATA-001-02 | 教科-セッション関連 | 教科を削除 | 関連セッションの状態 | 関連セッションも削除または参照整合性エラー |
| TC-DATA-001-03 | セッション-学生関連 | セッションを削除 | 関連学生の状態 | 関連データの整合性が保たれる |
| TC-DATA-001-04 | セッション-評価関連 | セッションを削除 | 関連評価データの状態 | 関連データが適切に処理される |
| TC-DATA-001-05 | 部屋-教員関連 | 部屋を削除 | 関連教員の状態 | assigned_room_numberがnullになるまたはエラー |
| TC-DATA-001-06 | 教員-評価関連 | 評価データ登録 | evaluator_emailの値 | 教員のメールアドレスが正しく記録される |
| TC-DATA-001-07 | 重複登録防止 | 同一学生に対し同一評価者が再評価 | DBの状態 | UPSERTにより更新される（重複レコード作成なし） |
| TC-DATA-001-08 | カテゴリ-問題関連 | カテゴリを削除 | 関連問題の状態 | 関連問題も削除または参照整合性エラー |
| TC-DATA-001-09 | テスト-シート関連 | テストを削除 | 関連シートの状態 | 関連データが適切に処理される |

### 9.2 sessionStorage整合性テスト (TC-DATA-002)

| テストID | テスト項目 | 操作 | 確認内容 | 期待結果 |
|----------|-----------|------|---------|---------|
| TC-DATA-002-01 | セッション情報保持 | ログイン後ページ遷移 | sessionStorageの値 | 必要な認証情報が維持される |
| TC-DATA-002-02 | ログアウト時クリア | ログアウト操作 | sessionStorageの値 | 認証情報がクリアされる |
| TC-DATA-002-03 | ブラウザ再起動後 | ブラウザを閉じて再度開く | sessionStorageの値 | sessionStorageはクリアされている（再ログインが必要） |
| TC-DATA-002-04 | 複数タブでのセッション | 複数タブを開く | 各タブのsessionStorage | 同一セッション情報が共有される |
| TC-DATA-002-05 | 異なるロールでの同時ログイン | 教員と患者役を別タブでログイン | 各タブのsessionStorage | 各タブで独立したセッション情報が保持される |

### 9.3 データ計算整合性テスト (TC-DATA-003)

| テストID | テスト項目 | テストデータ | 確認内容 | 期待結果 |
|----------|-----------|-------------|---------|---------|
| TC-DATA-003-01 | total_score計算 | evaluations: {"q1": 4, "q2": 5, "q3": 3} | total_scoreの値 | 12（= 4 + 5 + 3） |
| TC-DATA-003-02 | has_alert計算 | 複数問題にアラート対象選択肢 | has_alertの値 | true（いずれかがアラートの場合） |
| TC-DATA-003-03 | has_alert計算（アラートなし） | 全問題で非アラート選択肢 | has_alertの値 | false |
| TC-DATA-003-04 | 平均点計算 | 複数学生の評価データ | ダッシュボードの平均点 | 正しく計算されている |
| TC-DATA-003-05 | 合格者数計算 | passing_score: 60, 各学生の点数 | ダッシュボードの合格者数 | passing_score以上の学生数 |

---

## 10. UIテスト

### 10.1 レスポンシブデザインテスト (TC-UI-001)

| テストID | テスト項目 | 画面サイズ | 確認対象画面 | 確認内容 | 期待結果 |
|----------|-----------|-----------|------------|---------|---------|
| TC-UI-001-01 | デスクトップ表示 | 1920x1080 | 全画面 | レイアウト崩れ、要素の重なり | 正常に表示される |
| TC-UI-001-02 | ラップトップ表示 | 1366x768 | 全画面 | レイアウト崩れ、スクロール | 正常に表示される |
| TC-UI-001-03 | タブレット横向き | 1024x768 | 全画面 | レイアウト調整 | レスポンシブに調整される |
| TC-UI-001-04 | タブレット縦向き | 768x1024 | 全画面 | レイアウト調整 | レスポンシブに調整される |
| TC-UI-001-05 | スマートフォン | 375x667 | 全画面 | モバイル向けレイアウト | モバイル向けレイアウトで表示 |
| TC-UI-001-06 | スマートフォン大型 | 414x896 | 全画面 | モバイル向けレイアウト | モバイル向けレイアウトで表示 |
| TC-UI-001-07 | ダッシュボード部屋カード | 各サイズ | `/admin/dashboard` | カードの配置 | 画面幅に応じてカード数が調整される |
| TC-UI-001-08 | 試験画面学生タブ | 各サイズ | `/teacher/exam` | タブの表示 | 画面幅に応じてタブがスクロール可能になる |
| TC-UI-001-09 | ログインフォーム | 各サイズ | 各ログイン画面 | フォームの幅 | 画面幅に応じて適切なサイズで表示 |

### 10.2 フォーム検証テスト (TC-UI-002)

| テストID | テスト項目 | 画面 | 操作 | 期待結果 |
|----------|-----------|------|------|---------|
| TC-UI-002-01 | 必須項目検証 | ログインフォーム | 空で送信 | エラーメッセージ表示、送信されない |
| TC-UI-002-02 | メール形式検証 | ユーザー登録フォーム | 不正なメール形式を入力 | 形式エラーが表示される |
| TC-UI-002-03 | 日付フォーマット | テスト作成フォーム | 日付ピッカーで選択 | 正しい日付形式で入力される |
| TC-UI-002-04 | 数値入力制限 | 問題番号入力 | 数値以外を入力 | 数値のみ受け付ける |
| TC-UI-002-05 | ボタン無効化 | 試験画面 | 未出席状態で入力完了ボタン | ボタンが無効化されている |
| TC-UI-002-06 | 文字数制限 | テキスト入力フィールド | 長文を入力 | 制限がある場合は入力制限される |
| TC-UI-002-07 | 選択必須 | ドロップダウン | 未選択で送信 | 選択を促すメッセージ |

### 10.3 ローディング状態テスト (TC-UI-003)

| テストID | テスト項目 | 画面 | 操作 | 期待結果 |
|----------|-----------|------|------|---------|
| TC-UI-003-01 | ページローディング | 学生一覧 | ページ読み込み | ローディングスケルトンまたはスピナー表示 |
| TC-UI-003-02 | ボタンローディング | ログインフォーム | ログインボタンクリック | 「ログイン中...」表示、ボタン無効化 |
| TC-UI-003-03 | データ更新中 | ダッシュボード | 更新ボタンクリック | 更新中の視覚的フィードバック |
| TC-UI-003-04 | 保存中表示 | 評価入力画面 | 回答選択 | 保存中のインジケーター（オートセーブの場合） |
| TC-UI-003-05 | 削除中表示 | 各管理画面 | 削除ボタンクリック | 削除処理中の表示 |
| TC-UI-003-06 | ローディング解除 | 各画面 | データ取得完了 | ローディング表示が消え、データが表示される |

### 10.4 モーダル・ダイアログテスト (TC-UI-004)

| テストID | テスト項目 | 画面 | 操作 | 期待結果 |
|----------|-----------|------|------|---------|
| TC-UI-004-01 | 確認ダイアログ表示 | 削除操作 | 削除ボタンクリック | 確認ダイアログが表示される |
| TC-UI-004-02 | 確認ダイアログキャンセル | 削除確認ダイアログ | キャンセルボタンクリック | ダイアログが閉じ、削除されない |
| TC-UI-004-03 | 確認ダイアログ確定 | 削除確認ダイアログ | 削除ボタンクリック | 削除が実行される |
| TC-UI-004-04 | モーダル外クリック | モーダル表示中 | モーダル外をクリック | モーダルが閉じる（設定による） |
| TC-UI-004-05 | Escキーでモーダルを閉じる | モーダル表示中 | Escキー押下 | モーダルが閉じる |
| TC-UI-004-06 | モーダルスクロール | 長いコンテンツのモーダル | スクロール | モーダル内でスクロール可能 |

---

## 11. エラーハンドリングテスト

### 11.1 ネットワークエラーテスト (TC-ERR-001)

| テストID | テスト項目 | 状況 | 操作 | 期待結果 |
|----------|-----------|------|------|---------|
| TC-ERR-001-01 | API接続エラー | Supabase接続不可 | データ読み込み | エラーメッセージ表示、クラッシュしない |
| TC-ERR-001-02 | 保存エラー | API応答なし | 評価データ保存 | リトライまたはエラー通知 |
| TC-ERR-001-03 | タイムアウト | 応答遅延 | データ取得 | タイムアウトエラーメッセージ |
| TC-ERR-001-04 | オフライン | ネットワーク切断 | 各種操作 | オフラインエラーメッセージ |
| TC-ERR-001-05 | 部分的なエラー | 一部APIが失敗 | ダッシュボード表示 | エラー部分のみエラー表示、他は正常表示 |

### 11.2 認証エラーテスト (TC-ERR-002)

| テストID | テスト項目 | 状況 | 操作 | 期待結果 |
|----------|-----------|------|------|---------|
| TC-ERR-002-01 | セッション切れ | sessionStorageクリア | 保護ページアクセス | ログインページにリダイレクト |
| TC-ERR-002-02 | 不正アクセス | 未ログイン | `/admin/dashboard`直接アクセス | ログインページにリダイレクト |
| TC-ERR-002-03 | トークン無効 | 不正なセッションデータ | APIアクセス | 認証エラー、ログインページにリダイレクト |
| TC-ERR-002-04 | 権限不足 | 一般教員が管理画面アクセス | `/admin/dashboard`アクセス | 権限エラーメッセージまたはリダイレクト |

### 11.3 入力エラーテスト (TC-ERR-003)

| テストID | テスト項目 | 状況 | 操作 | 期待結果 |
|----------|-----------|------|------|---------|
| TC-ERR-003-01 | 必須項目未入力 | フォーム送信時 | 必須項目を空で送信 | フィールド単位でエラーメッセージ |
| TC-ERR-003-02 | 形式エラー | メールアドレス入力 | 不正な形式で入力 | 形式エラーメッセージ |
| TC-ERR-003-03 | 重複エラー | 一意制約違反 | 既存の大学コードで登録 | 重複エラーメッセージ |
| TC-ERR-003-04 | 範囲外エラー | 数値入力 | 範囲外の値を入力 | 範囲エラーメッセージ |

### 11.4 サーバーエラーテスト (TC-ERR-004)

| テストID | テスト項目 | 状況 | 操作 | 期待結果 |
|----------|-----------|------|------|---------|
| TC-ERR-004-01 | 500エラー | サーバー内部エラー | API呼び出し | エラーメッセージ表示、ユーザーフレンドリーな説明 |
| TC-ERR-004-02 | 503エラー | サービス利用不可 | API呼び出し | メンテナンス中等のメッセージ |
| TC-ERR-004-03 | 404エラー | リソース不存在 | 存在しないIDでアクセス | リソースが見つからないメッセージ |

---

## 12. パフォーマンステスト

### 12.1 読み込み速度テスト (TC-PERF-001)

| テストID | テスト項目 | 条件 | 計測内容 | 目標値 | 計測方法 |
|----------|-----------|------|---------|-------|---------|
| TC-PERF-001-01 | 初期ページ読み込み | 通常ネットワーク | First Contentful Paint (FCP) | < 2秒 | Lighthouse |
| TC-PERF-001-02 | Time to Interactive | 通常ネットワーク | TTI | < 3秒 | Lighthouse |
| TC-PERF-001-03 | Largest Contentful Paint | 通常ネットワーク | LCP | < 2.5秒 | Lighthouse |
| TC-PERF-001-04 | ダッシュボード読み込み | 100部屋、1000学生 | データ表示完了 | < 5秒 | パフォーマンスタブ |
| TC-PERF-001-05 | 評価データ保存 | 通常ネットワーク | 保存完了 | < 1秒 | ネットワークタブ |
| TC-PERF-001-06 | ログイン処理 | 通常ネットワーク | 認証完了 | < 2秒 | ネットワークタブ |
| TC-PERF-001-07 | ページ遷移 | 通常ネットワーク | 遷移完了 | < 1秒 | パフォーマンスタブ |

### 12.2 大量データ処理テスト (TC-PERF-002)

| テストID | テスト項目 | 条件 | 計測内容 | 目標値 |
|----------|-----------|------|---------|-------|
| TC-PERF-002-01 | 学生一覧表示 | 1000件 | 一覧表示完了 | < 3秒 |
| TC-PERF-002-02 | 評価結果集計 | 5000件 | 集計完了 | < 5秒 |
| TC-PERF-002-03 | セッション一覧表示 | 500件 | 一覧表示完了 | < 2秒 |
| TC-PERF-002-04 | 検索結果表示 | 1000件から検索 | 検索完了 | < 1秒 |
| TC-PERF-002-05 | CSVエクスポート | 5000件 | ダウンロード開始 | < 5秒 |
| TC-PERF-002-06 | CSV一括インポート | 1000件 | インポート完了 | < 30秒 |

### 12.3 同時アクセステスト (TC-PERF-003)

| テストID | テスト項目 | 条件 | 計測内容 | 目標値 |
|----------|-----------|------|---------|-------|
| TC-PERF-003-01 | 同時ログイン | 100ユーザー | 全員ログイン完了 | < 10秒 |
| TC-PERF-003-02 | 同時評価入力 | 50教員が同時に評価 | 全評価保存完了 | < 5秒（各） |
| TC-PERF-003-03 | ダッシュボード同時アクセス | 10管理者が同時アクセス | 全員表示完了 | < 5秒（各） |

### 12.4 メモリ使用量テスト (TC-PERF-004)

| テストID | テスト項目 | 条件 | 計測内容 | 目標値 |
|----------|-----------|------|---------|-------|
| TC-PERF-004-01 | 長時間使用 | 1時間連続使用 | メモリ使用量 | リーク無し |
| TC-PERF-004-02 | 大量データ表示 | 1000件表示 | メモリ使用量 | < 500MB |
| TC-PERF-004-03 | タブ切り替え | 100回切り替え | メモリ使用量 | 増加が限定的 |

---

## 13. セキュリティテスト

### 13.1 認証セキュリティテスト (TC-SEC-001)

| テストID | テスト項目 | 操作 | 期待結果 |
|----------|-----------|------|---------|
| TC-SEC-001-01 | パスワードマスク表示 | ログインフォームのパスワード入力 | パスワードがマスク表示される（●●●） |
| TC-SEC-001-02 | パスワード表示トグル | 目のアイコンをクリック | パスワード表示/非表示が切り替わる |
| TC-SEC-001-03 | 認証バイパス試行 | URLパラメータでの認証回避試行 | 認証チェックが正しく機能する |
| TC-SEC-001-04 | セッション固定攻撃 | 固定セッションIDでアクセス | 新しいセッションが発行される |
| TC-SEC-001-05 | ブルートフォース対策 | 連続ログイン失敗 | レート制限またはアカウントロック |

### 13.2 入力バリデーションテスト (TC-SEC-002)

| テストID | テスト項目 | 確認内容 | 入力値 | 期待結果 |
|----------|-----------|---------|-------|---------|
| TC-SEC-002-01 | SQLインジェクション | 入力フィールドへの悪意あるSQL | `admin'; DROP TABLE admins;--` | エスケープされ、実行されない |
| TC-SEC-002-02 | XSS（反射型） | 入力フィールドへのスクリプト | `<script>alert('xss')</script>` | エスケープされ、実行されない |
| TC-SEC-002-03 | XSS（格納型） | 保存されるフィールドへのスクリプト | `<script>alert('xss')</script>` | エスケープされて保存・表示される |
| TC-SEC-002-04 | HTMLインジェクション | HTMLタグの挿入 | `<h1>test</h1>` | プレーンテキストとして表示 |
| TC-SEC-002-05 | パストラバーサル | ファイルパスの挿入 | `../../etc/passwd` | エラーまたは無効化 |

### 13.3 データ保護テスト (TC-SEC-003)

| テストID | テスト項目 | 確認内容 | 期待結果 |
|----------|-----------|---------|---------|
| TC-SEC-003-01 | HTTPS通信 | 通信の暗号化 | 全通信がHTTPS |
| TC-SEC-003-02 | パスワード保存 | DBでのパスワード保存方法 | ハッシュ化されて保存（※現在は平文で既知の問題） |
| TC-SEC-003-03 | セッションデータ | sessionStorageの内容 | 機密データが最小限 |
| TC-SEC-003-04 | APIレスポンス | 不要なデータの露出 | パスワード等の機密データがレスポンスに含まれない |
| TC-SEC-003-05 | エラーメッセージ | エラー時の情報露出 | 内部情報が露出しない |

### 13.4 CORS・CSRFテスト (TC-SEC-004)

| テストID | テスト項目 | 操作 | 期待結果 |
|----------|-----------|------|---------|
| TC-SEC-004-01 | CORS設定 | 異なるオリジンからのAPIアクセス | 許可されていないオリジンはブロック |
| TC-SEC-004-02 | CSRFトークン | フォーム送信時 | CSRFトークンが検証される（実装されている場合） |
| TC-SEC-004-03 | SameSite Cookie | Cookie設定確認 | SameSite属性が適切に設定 |

---

## 14. テスト環境

### 14.1 環境構成

| 環境 | URL | 用途 | DB |
|------|-----|------|---|
| 開発環境 | http://localhost:3000 | 開発・単体テスト | Supabase（開発用プロジェクト） |
| プレビュー環境 | Vercelプレビューデプロイ | 結合テスト | Supabase（ステージング用プロジェクト） |
| 本番環境 | Vercel本番URL | 受入テスト | Supabase（本番プロジェクト） |

### 14.2 テストデータ構成

| データ種別 | 件数 | 詳細 |
|-----------|------|------|
| 大学 | 2校 | dentshowa（昭和大学歯学部）, kanagawadent（神奈川歯科大学） |
| 教科 | 2教科 | 歯科、医科 |
| テストセッション | 3件 | 各ステータス（not_started, in_progress, completed） |
| 部屋 | 50室 | 各セッションに25室 |
| 教員 | 50名 | 各部屋1名 |
| 患者役 | 50名 | 各部屋1名 |
| 学生 | 350名 | 各部屋7名 |
| 管理者 | 5名 | special_master: 1, university_master: 2, subject_admin: 2 |

### 14.3 テストアカウント

| ロール | メールアドレス | パスワード | 備考 |
|-------|---------------|-----------|------|
| マスター管理者 | admin | admin | デフォルトアカウント |
| マスター管理者 | master@example.com | masterpass | テスト用 |
| 大学管理者 | univ@dentshowa.ac.jp | univpass | dentshowa所属 |
| 教科管理者 | subject@dentshowa.ac.jp | subjectpass | 歯科所属 |
| 一般教員 | teacher1@dentshowa.ac.jp | teacherpass | 部屋101担当 |
| 患者役 | patient1@dentshowa.ac.jp | patientpass | 部屋101担当 |

### 14.4 テストツール

| ツール | 用途 | バージョン |
|-------|------|-----------|
| Chrome DevTools | デバッグ、ネットワーク確認 | 最新 |
| Lighthouse | パフォーマンス計測 | Chrome内蔵 |
| Postman | API テスト | 最新 |
| Jest | 単体テスト（実装予定） | - |
| Playwright | E2Eテスト（実装予定） | - |

---

## 15. 既知の問題・制限事項

### 15.1 既知の問題

| # | 問題 | 影響度 | 影響範囲 | 対応状況 | 対応期限 |
|---|------|-------|---------|---------|---------|
| 1 | パスワードが平文で保存されている | 高 | セキュリティ | 本番運用前にハッシュ化が必要 | 本番デプロイ前 |
| 2 | `next.config.mjs`で`typescript.ignoreBuildErrors: true` | 中 | 開発品質 | 別途`tsc --noEmit`での確認が必要 | - |
| 3 | `components/exam-screen.tsx`がデッドコードの可能性 | 低 | 保守性 | 確認・削除検討 | - |
| 4 | RLSが無効 | 高 | セキュリティ | 本番運用前にRLS有効化が必要 | 本番デプロイ前 |

### 15.2 制限事項

| # | 制限事項 | 理由 | 影響 |
|---|---------|------|------|
| 1 | Supabase Authは未使用 | 独自認証方式を採用 | パスワード管理を独自実装で対応 |
| 2 | オフライン動作は未対応 | リアルタイムDB保存が必須 | ネットワーク接続が必須 |
| 3 | モバイルアプリなし | Webアプリのみ | タブレットでの使用を推奨 |
| 4 | 多言語対応なし | 日本語のみ | 海外展開時は対応が必要 |

---

## 16. テスト実施記録

### 16.1 テスト実施履歴

| 日付 | バージョン | テスト種別 | 実施者 | 結果概要 | 備考 |
|------|-----------|-----------|-------|---------|------|
| - | - | - | - | - | - |

### 16.2 不具合管理

| 不具合ID | 発見日 | 概要 | テストID | 重要度 | ステータス | 担当者 | 修正日 |
|----------|-------|------|---------|-------|-----------|-------|-------|
| - | - | - | - | - | - | - | - |

### 16.3 テストカバレッジ

| カテゴリ | 総テストケース数 | 実施済み | 成功 | 失敗 | 未実施 | カバレッジ率 |
|---------|-----------------|---------|------|------|-------|------------|
| 認証機能 | 42 | - | - | - | - | - |
| 試験管理 | 25 | - | - | - | - | - |
| マスタ管理 | 40 | - | - | - | - | - |
| 試験実施 | 35 | - | - | - | - | - |
| 結果管理 | 25 | - | - | - | - | - |
| API | 30 | - | - | - | - | - |
| 権限 | 15 | - | - | - | - | - |
| データ整合性 | 20 | - | - | - | - | - |
| UI | 40 | - | - | - | - | - |
| エラー | 20 | - | - | - | - | - |
| パフォーマンス | 20 | - | - | - | - | - |
| セキュリティ | 20 | - | - | - | - | - |
| **合計** | **332** | - | - | - | - | - |

---

## 付録

### A. 用語集

| 用語 | 説明 |
|------|------|
| OSCE | Objective Structured Clinical Examination（客観的臨床能力試験）。医学・歯学教育における臨床能力評価試験 |
| セッション | test_sessionsテーブルで管理される試験実施単位。1つの試験日程に対応 |
| 部屋 | 試験を実施する物理的な部屋。各部屋に教員1名+患者役1名がアサインされる |
| アラート | 特定の回答選択時に発生する警告フラグ。注意が必要な評価結果を示す |
| evaluations | 各問題への回答をJSONB形式で保存したデータ。例：`{"q1": 4, "q2": 5}` |
| is_completed | 評価入力が完了したかどうかを示すフラグ |
| has_alert | アラート対象の選択肢が選択されたかどうかを示すフラグ |
| passing_score | 合格基準点。この点数以上で合格とみなす |

### B. テストデータSQL

テストデータの作成・初期化は`scripts/`配下のSQLファイルを参照してください。

| ファイル名パターン | 内容 |
|------------------|------|
| `001_*.sql` | 初期スキーマ |
| `100-105_*.sql` | 本番データインポート |
| `110-111_*.sql` | 教科管理 |
| `200-204_*.sql` | test_session関連リファクタ |

### C. API エンドポイント一覧

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/universities` | GET, POST | 大学一覧取得、新規作成 |
| `/api/universities/[id]` | GET, PUT, DELETE | 大学詳細取得、更新、削除 |
| `/api/universities/bulk` | POST | 大学一括登録 |
| `/api/subjects` | GET, POST | 教科一覧取得、新規作成 |
| `/api/subjects/[id]` | PUT, DELETE | 教科更新、削除 |
| `/api/test-sessions` | GET, POST | セッション一覧取得、新規作成 |
| `/api/test-sessions/[id]` | GET, PUT, DELETE | セッション詳細取得、更新、削除 |

### D. 画面URL一覧

| URL | 説明 | 必要権限 |
|-----|------|---------|
| `/` | トップページ | なし |
| `/admin/login` | 管理者ログイン | なし |
| `/admin/dashboard` | 管理者ダッシュボード | 管理者 |
| `/admin/university-management` | 大学管理 | special_master |
| `/admin/subject-management` | 教科管理 | university_master以上 |
| `/admin/room-management` | 部屋管理 | subject_admin以上 |
| `/admin/students-list` | 学生一覧 | subject_admin以上 |
| `/admin/register-students` | 学生登録 | subject_admin以上 |
| `/admin/teachers-list` | 教員一覧 | subject_admin以上 |
| `/admin/register-teachers` | 教員登録 | subject_admin以上 |
| `/admin/patients-list` | 患者役一覧 | subject_admin以上 |
| `/admin/register-patients` | 患者役登録 | subject_admin以上 |
| `/admin/question-management` | 問題管理 | subject_admin以上 |
| `/admin/question-management/create` | 問題作成 | subject_admin以上 |
| `/admin/question-management/edit/[id]` | 問題編集 | subject_admin以上 |
| `/teacher/login` | 教員ログイン | なし |
| `/teacher/exam-info` | 教員試験情報 | 教員 |
| `/teacher/exam` | 教員試験画面 | 教員 |
| `/teacher/results` | 教員結果画面 | 教員 |
| `/patient/login` | 患者役ログイン | なし |
| `/patient/exam-info` | 患者役試験情報 | 患者役 |
| `/patient/exam` | 患者役試験画面 | 患者役 |
| `/patient/results` | 患者役結果画面 | 患者役 |

---

*本ドキュメントの更新履歴*

| 日付 | バージョン | 変更内容 | 更新者 |
|------|-----------|---------|-------|
| 2026-04-26 | 1.0 | 初版作成 | v0 |
| 2026-04-26 | 2.0 | 詳細化（各テストケースに入力データ、DB確認項目を追加） | v0 |
