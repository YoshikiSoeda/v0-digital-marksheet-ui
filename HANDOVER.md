# OSCEシステム — Claude セッション引継ぎ資料

| 項目 | 値 |
|---|---|
| 作成日 | 2026-05-02(初版) → **2026-05-03 更新**(Phase 9 closeout + Y-Phase + 登録スコープ修正) |
| 引継ぎ元 | Phase 7 / 8 / 8b / 9a / 9b / 9c / 9 RLS / 9d / Phase 9 closeout(B1, C3, AdminTopNav, 学年) / Y-Phase(subject_admin スコープ) / 登録スコープ修正 |
| 引継ぎ先 | 次セッションの Claude / ユーザー |
| プロジェクト | Digital Marksheet Exam System(OSCE) |

---

## 0. 最重要: 次セッション開始時にやること

**これだけ読めば再開できる**:

1. Cowork で接続するフォルダは **`C:\Users\yoshi\Documents\Project\OSCEシステム`** のみ。旧 `C:\Users\yoshi\Documents\Claude\Projects\OSCEシステム` は廃止
2. 開始したら最初に **`CLAUDE.md`** を読む(プロジェクト全体のコンテキスト)
3. 続けて **本 `HANDOVER.md`** を読む
4. memory の **`project_osce_migration.md`** / **`cowork_git_workaround.md`** / **`project_osce_login_model.md`** / **`feedback_pat_push_branch_tracking.md`** / **`feedback_old_folder_disconnect.md`** が自動で読み込まれる
5. ユーザーがトリガーフレーズ「**OSCEシステム作業を再開、git ラッパーをセットアップして**」と言ったら、確認なしで `/tmp/osce/git.sh`(または同等の wrapper)を再生成する(memory 参照)

### 0.1 直前セッション(2026-05-02 〜 05-03)の状態

**未マージ PR**(merge してから動作確認するのがユーザー方針):

| PR# | branch | 内容 | 状態 |
|---|---|---|---|
| #53 想定 | `claude/fix-registration-subject-scope` | subject_admin で教員/患者役/学生登録時に他教科レコードまで読まれて Y-2 で 403 になっていた問題の修正 + エラー alert 改善 | 2026-05-03 push 済み・merge 待ち |

**バッチ動作確認待ち**(ユーザー方針: 「全修正ポイントが終わってから一括検証」)。確認シナリオは §10 に記載。

### 0.2 動作確認シナリオ(次セッション初動)

merge 後ユーザーに動作確認してもらう想定の項目(§10 詳述):
1. kyouka(subject_admin)で教員登録 → 他教科の既存教員が出ない / 登録を確定 → 成功
2. 同上を患者役登録 / 学生登録でも確認
3. special_master / university_master ではこれまで通り全教科ロード可
4. 大学削除 / 部屋削除 / 問題保存 のバグ再発なし
5. C3 制限時間プログレスバーが残り時間に応じて減る
6. AdminTopNav の 5 タブ(subject_admin は 4 タブ)が正しく表示される

---

## 1. プロジェクト概要

- **Repo**: https://github.com/YoshikiSoeda/v0-digital-marksheet-ui
- **Production**: https://v0-digital-marksheet-ui.vercel.app
- **Tech**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Supabase + Tailwind 4 + shadcn/ui + pnpm
- **Supabase project**: `isvqqswuzpxyuciocozt`(`ediand-osce-system`、ap-northeast-1)
- **想定利用機関**: 昭和医科大学 歯学部 (`dentshowa`)、神奈川歯科大学 (`kanagawadent`) ほか
- **3 ロール構成**: 管理者 / 教員 / 患者役(2026-05-02 で patient_admin 廃止、患者役は general 1 種)
- **権限階層**: master_admin / university_admin / subject_admin / general

## 2. テストアカウント(production)

| ロール | ID | Pass | login 後の遷移 |
|---|---|---|---|
| マスター管理者 | `admin` | `admin` | `/admin/dashboard` |
| 大学管理者 | `uni` | `uni` | `/admin/dashboard` |
| 教科管理者 | `kyouka` | `kyouka` | `/admin/dashboard` |
| 一般教員 | `ippan` | `ippan` | `/teacher/exam-info` |
| 患者役 | `kanjya` | `kanjya` | `/patient/exam-info` |

> 全パスワードは bcrypt ハッシュ化済み(Phase 8、2026-04-26)。
> ログイン入口は **`/login` 1 つだけ**(2026-05-02、Phase 9d-1+2)。

## 3. 完了済み Phase 一覧

| Phase | 内容 | 完了日 |
|---|---|---|
| 1〜4 | 型エラー 66 → 0 | 2026-04-25 |
| 6 | `next.config.mjs` の `ignoreBuildErrors: false` 化 | 2026-04-25 |
| 7 / 7-fix | middleware 認証ガード(API + 画面) | 2026-04-25/26 |
| 8 / 8b / 8c | bcrypt パスワード化 + サーバー認証 API + reset-password 移行 + register-* /api 化 | 2026-04-26 |
| **9a** | クリーンアップ(V0 デッドコード、`[v0]` console.log、stub ルート、ADR-001) | 2026-05-02 |
| **9b-α** | 統合 `/api/auth/login` + `/api/auth/me` + lib/auth/{session,use-session,verify}.ts | 2026-05-02 |
| **9b-β1** | 3 login form を `/api/auth/login` に切替 | 2026-05-02 |
| **9b-β2a-e** | sessionStorage 認可キーを useSession() に置換(全 consumer 移行) | 2026-05-02 |
| **9b-β2f1-3** | 移行漏れ回収 + login form sessionStorage write 削除 + 旧 /api/auth/{admin,teacher,patient}/login 削除 + patient_admin 廃止 | 2026-05-02 |
| **9b-γ** | AppShell 骨格(role-aware ヘッダー) | 2026-05-02 |
| **9c-1** | read API 第1弾(/api/teachers /patients /students) | 2026-05-02 |
| **9c-2** | read API 第2弾(rooms / tests / attendance-records / evaluation-results / test-sessions / subjects)+ ADR-002 | 2026-05-02 |
| **9c-4** | write API 全リソース + lib/data-storage.ts の anon UPSERT/DELETE 撲滅 | 2026-05-02 |
| **9c-5** | 型を lib/types.ts に切り出し + lib/data-storage.ts を deprecated shim 化 | 2026-05-02 |
| **9 RLS** | 13 テーブル ENABLE ROW LEVEL SECURITY + SECURITY DEFINER 関数 EXECUTE REVOKE + search_path 固定 + ADR-003 | 2026-05-02 |
| **9d-1+2** | 共通 `/login` 画面新設 + 旧 URL を 308 redirect | 2026-05-02 |
| **9d-3** | 全画面 AppShell 適用(admin/teacher/patient layout.tsx) | 2026-05-02 |
| **9d-4a** | `/admin/users/new` 統合単一ユーザー登録(役割ドロップダウン) | 2026-05-02 |
| **9d cleanup-1** | 旧ロール別 login 画面/フォーム削除 | 2026-05-02 |
| **9d-exam-banner** | 試験中ヘッダー強化(ExamSessionBanner)+ admin → /teacher/exam-info リンク | 2026-05-02 |
| **HOTFIX-1** | /api/test-sessions を service role に切替(RLS regression) | 2026-05-02 |
| **HOTFIX-2** | /teacher/exam, /patient/exam の useSession キャッシュ race による redirect ループ修正 | 2026-05-02 |
| **AppShell back** | 全画面に履歴戻りボタン追加(初版・左 ghost) | 2026-05-02 |
| **AppShell back v2** | 戻るボタンを右側 outline でプロミネント化 | 2026-05-02 |
| **A1+A2** | reset-password 戻り先整理 + HANDOVER.md 初版作成 | 2026-05-02 |
| **B1** | `/admin/users` 一覧統合(教員 + 患者役タブ) | 2026-05-02 |
| **C3** | 試験セッション制限時間 + 残り時間プログレスバー(`scripts/210` で `test_sessions.duration_minutes` 追加、`exam-session-banner` で残り表示) | 2026-05-02 |
| **複数バグ修正** | 大学削除 / 部屋削除 / 問題保存 の silent failure 修正 + ヘッダーのログアウトボタン削除 | 2026-05-02 |
| **AdminTopNav** | 管理画面に水平 5 タブナビ(ダッシュボード/マスター管理/アカウント管理/問題管理/設定)+ ダッシュボード重複ボタン整理 | 2026-05-02 |
| **学年カラム** | `scripts/211` で `students.grade` 追加 + 登録/一覧 UI 反映 | 2026-05-02 |
| **ADR-004 起票** | 学生 canonical 化 + 試験セッション junction 設計記録(B-2 実装は未着手) | 2026-05-02 |
| **Y-1+Y-3** | subject_admin にアカウント管理 + 設定 を解放(自教科スコープ、`SUBJECT_ADMIN_ACCOUNTS` set + AdminTopNav から「マスター管理」を除外、admin-settings の合格ライン/制限時間カードを subject フィルタ) | 2026-05-02 |
| **Y-2** | API ガードに `getSubjectScope` / `rejectIfOutsideSubjectScope` 追加 → `register-teachers` / `register-patients` 等の write API で他教科操作を 403 で弾く | 2026-05-02 |
| **登録スコープ修正** | Y-2 適用後、subject_admin が登録画面で全教科の既存レコードをロードして Y-2 で一括 403 になる問題を修正(`loadTeachers/loadPatients/loadStudents` の subjectCode 引数に scope を渡す)+ 保存失敗 alert に `error.message` 表示 | 2026-05-03(未マージ) |

主要 ADR:
- `docs/adr/ADR-001-ui-ux-redesign.md`(Accepted)— UI/UX 全面再設計の上位 ADR
- `docs/adr/ADR-002-data-access-api-consolidation.md`(Accepted)— Phase 9c の API 集約方針
- `docs/adr/ADR-003-rls-enablement.md`(Accepted)— Phase 9 RLS の deny-by-default + service role 設計
- `docs/adr/ADR-004-student-canonical-and-session-assignment.md`(Proposed)— 学生 canonical 化 + 試験セッション junction(B-2 実装は別 PR で)

## 4. 現在のプロダクション健全性

- Supabase advisor: **ERROR 0 件 / WARN 0 件**(INFO 13 件は RLS deny-by-default の意図通り、無視可)
- 全データアクセスは `app/api/*` 経由(service role)。anon key の SELECT/UPSERT は DB 側でゼロ
- 認証は HttpOnly Cookie + middleware ガード(統一 `/api/auth/login`)
- UI:
  - `/login` 1 画面で 5 ロールすべてログイン可能
  - 全認証画面に AppShell(ロゴ + ロールバッジ + 戻るボタン右 outline)
  - **管理画面に AdminTopNav** 水平 5 タブ(subject_admin は 4 タブ。「マスター管理」だけ非表示)
  - 試験中画面に ExamSessionBanner(セッション名 + 部屋 + 教科 + 経過時間 + 合格ライン + **残り時間プログレスバー**)
  - `/admin/users/new` 統合単一ユーザー登録(役割ドロップダウン: 一般教員 / 教科責任者 / 患者役)
  - `/admin/users` で教員 + 患者役の一覧をタブ統合(B1)
  - `/admin/dashboard` から「試験選択画面を開く」で `/teacher/exam-info` 確認可
- 権限スコープ:
  - subject_admin は自教科の subjectCode のレコードしか read/write できない(Y-2)
  - api-guard.ts の `rejectIfOutsideSubjectScope` で write API がブロック
  - 登録画面側も `loadXxx` の subjectCode 引数で同期(未マージ PR、§0.1)

## 5. 残課題(優先度順)

### A. 即着手可能な小物

- [ ] **マウント側のオーファン削除**(Cowork mount 制約で git rm のみ実施、物理削除は Explorer 操作必要):
  - `app/admin/login/`、`app/teacher/login/`、`app/patient/login/`(Phase 9d cleanup-1 で消した旧 login 画面)
  - `components/admin-login-form.tsx`、`components/teacher-login-form.tsx`、`components/patient-login-form.tsx`(同)
  - `components/exam-info-screen.tsx`、`app/admin/students/`、`app/admin/questions/`(Phase 9a で消したスタブ)
- [ ] **登録スコープ修正 PR(#53 想定)を merge** → §10 シナリオで動作確認

### B. ADR-001 で計画済み・未着手

- [x] ~~**9d-4b**: `/admin/users` 一覧画面(教員 + 患者役のタブ統合)~~ B1 で完了
- [ ] **9d-5**: URL 再編(`/sessions/[id]/evaluate` 等)— 内部整理メイン

### B-2. ADR-004(学生 canonical 化)実装

ADR-004 起票済み。実装はユーザー方針確認待ち(Open Questions §7 を埋める必要あり):
- [ ] §7-1 重複統合ルール(同一 university_code+student_id の複数 row → どの email/name を採用)
- [ ] §7-2 部屋割当ロジック(自動/手動/CSV)
- [ ] §7-3 過去 attendance/exam_results の student_id 引継ぎ
- [ ] §7-4 試験当日の参加者追加・除外 UX
- [ ] Phase B-2-1 (DB)→ B-2-2 (API)→ B-2-3 (UI)→ B-2-4 (cleanup) の段階実装

### C. ADR-001 §1.2 構造的問題で未対応

- [ ] **F4**: `teacher-exam-tabs.tsx` と `patient-exam-tabs.tsx` の本体ロジック重複(~500 行 × 2 ファイル)を `<ExamTabs role>` に統合
- [ ] **F7**: 一覧画面の共通 `<DataTable>` 抽出(teachers-list / patients-list / students-list / question-management)
- [x] ~~**C3**: 試験中の制限時間プログレスバー~~ 完了
- [ ] **C4**: アラート集計ロジック UI 強化

### D. ADR-001 §7 Open Questions 残り(方針確認のみで実装不要なもの)

- [ ] §3 `/login` 旧 URL の redirect 永続性(現状 permanent: true、永続)
- [ ] §4 Server Components シフトの範囲

### E. 長期(別 Phase で別 ADR 化推奨)

- [ ] **Phase 10 候補**: `password` 列を `admins` / `teachers` / `patients` から別テーブル(`user_credentials`)に分離(ADR-003 §6)
- [ ] **Phase 11 候補**: Supabase Auth 移行(独自 Cookie 認証 → JWT/MFA/メール認証)

## 6. 重要な運用ノート

### 6.1 Cowork マウント FS の制約

memory `cowork_git_workaround.md` 詳述。要点:
- マウント上に `.git` を置けない → `.git` は `/tmp/osce-git-<session-tag>` に分離
- マウント上のファイルは bash から truncated に見えることがある → ビルド/型チェックは `/tmp/osce-work-<tag>` で fresh clone
- マウント上の既存ファイル変更は `Edit` ツール **末尾 truncation リスク**(2026-05-03 セッションで teacher/patient/student-registration.tsx と HANDOVER.md の末尾が中途半端に切れた事象を確認)→ Edit を連発するときは適度に `python3 -c "data=open(p,'rb').read(); print(len(data), data[-30:])"` で末尾チェック、切れていたら**切れた箇所の続きだけ Python で append すれば復旧可能**
- マウント上の既存ファイル変更は `Edit` ツール NULL バイト padding リスク → bash heredoc / Python で全文上書き推奨
- ファイル削除はサンドボックスから不可 → `git rm --cached` で index 更新後、ユーザーに Explorer 削除依頼

### 6.2 git ラッパー(セッション再開時に毎回必要)

memory に保存された雛形。`/tmp` 揮発で毎セッション再生成。トリガーフレーズで自動セットアップ。

### 6.3 PAT 運用ルール

push のたびに **ユーザーが PAT を発行 → Claude が使用 → ユーザーが revoke** の流れ。
- トークン名: `claude-cowork-osce-<phase>-YYYY-MM-DD`
- Permissions: `Contents: Read and write` のみ
- Expiration: 7 days
- 対象リポジトリ: `YoshikiSoeda/v0-digital-marksheet-ui` のみ
- Claude 側は **使用直後に必ず remote URL クリーンアップ + env unset**(PAT を git config やログに残さない)
- `-u` を付けると branch.<name>.remote に PAT が永続化されるので付けない(memory `feedback_pat_push_branch_tracking.md`)

### 6.4 Supabase MCP 接続済み

- ツールプレフィックス: `mcp__0cce0195-825b-4699-9d38-3838e0d9c31d__*`
- 主要ツール: `execute_sql`、`apply_migration`、`list_tables`、`get_advisors`
- プロジェクト ID: `isvqqswuzpxyuciocozt`
- DB 変更は Claude が直接実行可能

### 6.5 Vercel デプロイ

- GitHub main ブランチへの merge で自動デプロイ(2-5分)
- 環境変数(`NEXT_PUBLIC_SUPABASE_URL` 等)は Vercel ダッシュボードで管理

### 6.6 V0 との関係

- v0.app チャット (`gdrBDtOcIEk`) からの自動 push が GitHub に流れる構成
- Claude で main 直接コミット → V0 自動生成と衝突リスク → **必ず `claude/<topic>` ブランチを切る**
- Phase 9 までは衝突なく進行

## 7. ディレクトリ構成(主要のみ、Phase 9 closeout 後)

```
app/
├── login/page.tsx              ← 共通ログイン(9d-1)
├── api/
│   ├── auth/{login,logout,me,reset-password}/  ← 統合認証(9b-α)
│   ├── admin/register-{teachers,patients}/     ← bulk 登録(8c)+ Y-2 スコープチェック
│   ├── teachers/{route.ts,[id]/}               ← read+write API
│   ├── patients/                               ← 同
│   ├── students/                               ← 同
│   ├── rooms/                                  ← read+write API
│   ├── tests/                                  ← 同
│   ├── attendance-records/                     ← 同
│   ├── evaluation-results/                     ← 同
│   ├── universities/{[id],bulk}/
│   ├── subjects/{[id]}                         ← 9c-4 で bulk upsert 拡張
│   └── test-sessions/{[id]}                    ← HOTFIX-1 で service role 化
├── admin/
│   ├── layout.tsx              ← AppShell wrapper + AdminTopNav
│   ├── dashboard/, master-management/, account-management/
│   ├── users/{new,page.tsx}    ← 統合登録 + 教員/患者役タブ一覧(B1)
│   ├── teachers-list/, patients-list/, students-list/, students-detail/
│   ├── register-{students,teachers,patients}/
│   ├── question-management/{create,edit/[id]}/
│   ├── room-management/, subject-management/, university-management/
│   └── settings/
├── teacher/
│   ├── layout.tsx              ← AppShell wrapper
│   └── exam-info/, exam/, results/
├── patient/
│   ├── layout.tsx              ← AppShell wrapper
│   └── exam-info/, exam/, results/
├── reset-password/, privacy/, terms/, page.tsx, layout.tsx
components/
├── app-shell.tsx               ← 共通シェル(右 outline 戻るボタン)
├── admin-top-nav.tsx           ← 5 タブ水平ナビ(subject_admin は 4 タブ)
├── unified-login-form.tsx
├── unified-user-registration-form.tsx
├── exam-session-banner.tsx     ← セッション名+部屋+教科+経過時間+残り時間プログレスバー
├── admin-dashboard.tsx, admin-settings.tsx, exam-results-screen.tsx
├── test-selection-screen.tsx, teacher-exam-tabs.tsx, patient-exam-tabs.tsx
├── question-{create,edit,management}.tsx, room-management.tsx, subject-management.tsx
├── {teacher,student,patient-role}-registration.tsx, university-management.tsx
└── reset-password-form.tsx
lib/
├── types.ts                    ← 全 型集約
├── data-storage.ts             ← deprecated shim(後方互換のみ)
├── api/
│   ├── _shared.ts              ← getServiceClient + requireAdmin
│   ├── teachers.ts, patients.ts, students.ts
│   ├── rooms.ts, tests.ts, attendance-records.ts, evaluation-results.ts
│   ├── test-sessions.ts, subjects.ts
│   └── README.md
├── auth/
│   ├── api-guard.ts            ← requireAdmin + getSubjectScope + rejectIfOutsideSubjectScope(Y-2)
│   ├── http-cookie.ts
│   ├── verify.ts
│   ├── session.ts
│   └── use-session.ts
├── supabase/{client,server}.ts ← 参照ほぼゼロ、最終削除候補
└── utils.ts
middleware.ts                   ← Cookie ベース 401 ガード
scripts/
├── 001-105_*.sql, 110-111_*.sql, 200-204_*.sql
├── 205-207_*.sql               ← Phase 8 の bcrypt + register/password RPC
├── 208_deprecate_patient_admin_role.sql
├── 209_enable_rls_and_lock_definer_functions.sql
├── 210_add_duration_minutes_to_test_sessions.sql  ← C3
└── 211_add_grade_to_students.sql                  ← B-1 学年カラム
docs/adr/
├── ADR-001-ui-ux-redesign.md
├── ADR-002-data-access-api-consolidation.md
├── ADR-003-rls-enablement.md
└── ADR-004-student-canonical-and-session-assignment.md  ← Proposed
```

## 8. 次セッション初動チェックリスト

```
[ ] Cowork で C:\Users\yoshi\Documents\Project\OSCEシステム を選択
[ ] CLAUDE.md と HANDOVER.md(本ファイル)を読む
[ ] memory が自動ロードされる(project_osce_migration / cowork_git_workaround / project_osce_login_model / feedback_*)
[ ] git ラッパー再生成(トリガーフレーズ)
[ ] /tmp/osce-work-<tag> が無ければ git clone --depth 30 で再取得
[ ] §0.1 の未マージ PR(#53 想定 claude/fix-registration-subject-scope)を確認・merge
[ ] §10 シナリオでユーザー検証
[ ] Supabase MCP の get_advisors(security) で ERROR/WARN 0 件、INFO 13 件のみ確認
[ ] Vercel production が緑(GET /api/auth/me を未認証で叩いて 401)
[ ] 上記 OK なら本ファイル §5 の優先順に着手
```

---

## 9. ユーザーから 2026-05-02 〜 05-03 セッションでもらったご質問・要望(参考)

- 「ログイン画面が修正された状態はいつ頃見れますか?」 → Phase 9d-1+2 で共通 `/login` をリリース、確認済み
- 「試験を選択する画面が見つからなかったのですが、こちらも修正対象でしょうか」 → /admin/dashboard に「試験選択画面を開く」リンクを追加(9d-exam-banner)、ippan/kanjya でログインすれば自動遷移する旨を共有
- 「全ての画面に一つ前の画面に戻るボタンを入れてください」→ AppShell に履歴戻りボタン追加 → 後で右側 outline にプロミネント化
- 「ヘッダーにログアウトボタンがあるので戻るボタンに変更をお願いします」→ ログアウトボタン削除、戻るボタンのみに
- 大学削除/部屋削除/問題保存のバグ報告 → Multi-fix PR で解消(silent failure → 明示的 alert + DELETE エンドポイント)
- 「学生登録機能で、学年という列を加えてください」→ B-1 で `students.grade` 追加
- 「試験を設定する際、再び一人ひとり学生を登録するのは大変なので、学年単位で設定ができるよう考えてください」→ ADR-004 で設計記録、実装は Open Questions 確定後に B-2 で着手
- 「教科責任者の権限では、アカウントの設定も可能だったかと思いますが仕様の確認をさせてください」→ 案 Y(自教科スコープでアカウント管理可)を採用 → Y-1+Y-3 で UI 解放、Y-2 で API スコープチェック追加
- 「登録を確定するとエラーになります」(kyouka で /admin/register-teachers)→ 登録スコープ修正 PR(#53 想定)を作成、push 済み・merge 待ち

---

## 10. 動作確認シナリオ(merge 後ユーザー検証)

ユーザー方針:「其々の動作確認と微調整はすべての修正ポイントが終わった後にします」(2026-05-02)。
以下を一括検証する想定。

### 10.1 subject_admin 登録スコープ(PR #53 想定)

1. `kyouka` / `kyouka` でログイン → `/admin/dashboard`
2. AdminTopNav から「アカウント管理」→「教員登録」
3. 既存一覧に **自教科(dentshowa_GENERAL)の教員のみ** が表示される(他大学の教員は出ない)
4. 1 名追加 → 「登録を確定」→ 成功 alert + `/admin/account-management` へ遷移
5. 患者役登録 / 学生登録でも同様
6. 失敗ケース確認: わざと email 重複などを起こして alert に `error.message` が出ることを確認

### 10.2 subject_admin の閲覧範囲(Y-1)

1. `kyouka` で AdminTopNav に「マスター管理」**タブが出ない**ことを確認
2. 「設定」→ 合格ライン / 制限時間カードに **自教科の試験セッションのみ** 表示
3. 「アカウント管理」→ 教員/患者役/学生一覧で他教科のレコードが見えない

### 10.3 master_admin の挙動が変わっていないこと

1. `admin` でログイン → 全 5 タブ表示
2. 全教科の教員/患者役/学生が一覧に出る
3. 大学/教科/部屋/問題管理 が従来通り操作可能

### 10.4 既存バグ修正(Multi-fix PR)の継続確認

1. `admin` で大学管理 → 教科を持つ大学を削除しようとして 409 エラー表示
2. `admin` で部屋管理 → 部屋削除ボタンで実際に消える
3. `admin` で問題管理 → 問題編集 → 保存で alert + 一覧に反映

### 10.5 試験中 UI(C3 + AppShell back v2)

1. `ippan` でログイン → `/teacher/exam-info` で試験選択 → `/teacher/exam`
2. ExamSessionBanner に **残り時間プログレスバー** が表示、時間経過で減る
3. AppShell 右に「戻る」outline ボタン

---

おつかれさまでした。次セッションは §0.1 で挙げた未マージ PR を merge → §10 で動作確認 → §5 の残課題優先順、の順に進めてください。
