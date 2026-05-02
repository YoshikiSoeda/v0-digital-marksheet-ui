# OSCEシステム — Claude セッション引継ぎ資料

| 項目 | 値 |
|---|---|
| 作成日 | 2026-04-26 |
| 引継ぎ元 | 本日のセッション(Phase 7 / 8 / 8b 完了) |
| 引継ぎ先 | 次セッションの Claude / ユーザー |
| プロジェクト | Digital Marksheet Exam System(OSCE) |

---

## 0. 最重要: 次セッション開始時にやること

**これだけ読めば再開できる**:

1. このセッションで Cowork に接続するフォルダは **`C:\Users\yoshi\Documents\Project\OSCEシステム`** のみ。旧 `C:\Users\yoshi\Documents\Claude\Projects\OSCEシステム` は廃止
2. 開始したら最初に **`C:\Users\yoshi\Documents\Project\OSCEシステム\CLAUDE.md`** を読む(プロジェクト全体のコンテキスト)
3. 続けて **`C:\Users\yoshi\Documents\Project\OSCEシステム\HANDOVER.md`**(本ファイル)を読む
4. memory の **`project_osce_migration.md`** と **`cowork_git_workaround.md`** が自動で読み込まれる
5. ユーザーがトリガーフレーズ「**OSCEシステム作業を再開、git ラッパーをセットアップして**」と言ったら、確認なしで /tmp/git-osce.sh を再生成する(memory 参照)

---

## 1. プロジェクト概要

- **Repo**: https://github.com/YoshikiSoeda/v0-digital-marksheet-ui
- **Production**: https://v0-digital-marksheet-ui.vercel.app
- **Tech**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Supabase + Tailwind 4 + shadcn/ui + pnpm
- **Supabase project**: `isvqqswuzpxyuciocozt`(`ediand-osce-system`、ap-northeast-1)
- **想定利用機関**: 昭和医科大学 歯学部 (`dentshowa`)、神奈川歯科大学 (`kanagawadent`) ほか
- **3 ロール構成**: 管理者(admin)/ 教員(teacher)/ 患者役(patient)
- **権限階層**: master_admin / university_admin / subject_admin / general

## 2. テストアカウント(production)

| ロール | ID | Pass |
|---|---|---|
| マスター管理者 | `admin` | `admin` |
| 大学管理者 | `uni` | `uni` |
| 教科管理者 | `kyouka` | `kyouka` |
| 一般教員 | `ippan` | `ippan` |
| 患者役 | `kanjya` | `kanjya` |

> 全パスワードは bcrypt ハッシュ化済み(Phase 8、2026-04-26)。

## 3. 完了済み Phase

| Phase | 内容 | 結果 |
|---|---|---|
| **1〜4** | 型エラー 66 → 0 | 100% 削減、副次バグ 5+件同時修正 |
| **6** | `next.config.mjs` の `ignoreBuildErrors: false` 化 | ビルド時型保証 |
| **7** | `middleware.ts` で API + 画面ガード(Cookie ベース) | API 401・画面リダイレクト |
| **7-fix** | cookie 発行を showSessionStep に移動 | 試験一覧表示の回帰修正 |
| **8** | bcrypt パスワードハッシュ化 + サーバー認証 API + HttpOnly Cookie | 平文 0 件達成 |
| **8b** | reset-password の API 化 + 旧 cookie helper 削除 + WARN 修正 | クリーンアップ完了 |

詳細は memory `project_osce_migration.md` 参照。

## 4. 現在の production 健全性

**直近の動作確認済み内容**:

```
GET /api/universities                                          -> 401 (middleware)
GET /api/test-sessions                                         -> 401
DELETE /api/universities/<bogus>                                -> 401
/teacher/exam-info, /patient/exam-info(未認証)                  -> ログインへリダイレクト

POST /api/auth/admin/login {adminId:"admin", password:"admin"}  -> 200 + HttpOnly cookie
POST /api/auth/admin/login {adminId:"uni", password:"uni"}      -> 200 (teachers fallback / university_admin)
POST /api/auth/admin/login {adminId:"kyouka", password:"kyouka"}-> 200 (subject_admin)
POST /api/auth/teacher/login {email:"ippan", password:"ippan"}  -> 200
POST /api/auth/patient/login {email:"kanjya", password:"kanjya"} -> 200
POST /api/auth/admin/login {adminId:"admin", password:"wrong"}  -> 401

DB 状態(Supabase MCP で直接確認):
  admins:    2 hashed / 0 plaintext
  teachers:  4 hashed / 0 plaintext
  patients: 52 hashed / 0 plaintext
```

**主要 PR**: 全て main にマージ済み(Phase 1, 2, 4, 7, 7-fix, 8, 8-fix, 8b で計 7 PR)

## 5. 次セッションの優先課題(memory にも記録)

### 🔴 最優先 — Phase 9: RLS 有効化

Supabase advisor で **ERROR 16件** が残存:
- 13 テーブルすべてで Row Level Security 未有効
- admins / teachers / patients の `password` 列が anon key で読める(API 経由じゃなくても直接アクセス可能)

bcrypt 化したとはいえ、seed の弱パスワード(`a/b/c` 等)はオフライン解読される恐れ。

**実装の難所**:
- 単純に RLS を ON にすると、現行の `lib/data-storage.ts` の `loadTeachers/loadStudents/loadRooms/...` (anon key 直接 SELECT)が全て 0 件になる
- → 全データ取得を /api/* 経由(service role key)に書換える必要あり = **影響範囲が広い大規模変更**
- もしくは、anon に SELECT を許す permissive policy(警告は消えるが実質無効)で妥協する選択もある

**推奨アプローチ**: 次セッションは ADR(Architecture Decision Record)から始める。決め打ちで実装せず、設計を一旦固める。

### 🟡 中優先 — registration forms のハッシュ化

現状、`/admin/register-{students,teachers,patients}` で新規ユーザーを作成すると **平文パスワードが保存される**(既存 bcrypt 化が無効化されていく)。

Phase 9 と一緒に「全 write を /api 経由に集約する」流れで対応するのが効率的。

### 🟢 小さい確認課題

- admin ログイン UI が「ログイン中…」で停止する症状の実機再現確認(自動化テストで発生したが、人間操作で起きるかは未確認)

## 6. 重要な運用ノート

### 6.1 Cowork マウント FS の制約

memory `cowork_git_workaround.md` 詳述。要点:
- **マウント上に `.git` を置けない**(atomic write 不整合)→ `.git` は `/tmp/osce-git` に分離
- マウント上のファイルは bash から truncated に見えることがある → ビルド/型チェックは `/tmp/osce-work` で fresh clone してから実行
- `Edit` ツールでマウント上のファイルを変更すると NULL バイト padding が起きる場合あり → 既存ファイル変更は bash heredoc で全文上書き推奨

### 6.2 git ラッパー(セッション再開時に毎回必要)

`/tmp/git-osce.sh` は `/tmp` 揮発で毎セッション再生成。`CLAUDE.md` に雛形あり。トリガーフレーズで自動セットアップ可能。

### 6.3 PAT 運用ルール

push のたびに **ユーザーが PAT を発行 → Claude が使用 → ユーザーが revoke** の流れ。トークン名は `claude-cowork-osce-<phase>-YYYY-MM-DD` で管理。Permissions: `Contents: Read and write` のみ、Expiration 7 days、対象リポジトリ `YoshikiSoeda/v0-digital-marksheet-ui` のみ。

Claude 側は **使用直後に必ず remote URL クリーンアップ + env unset** を実施(PAT を git config やログに残さない)。

### 6.4 Supabase MCP は接続済み

- ツールプレフィックス: `mcp__0cce0195-825b-4699-9d38-3838e0d9c31d__*`
- 主要ツール: `execute_sql`, `apply_migration`, `list_tables`, `get_advisors`, `list_projects`
- プロジェクト ID: `isvqqswuzpxyuciocozt`
- **DB 変更はユーザーに SQL 貼り付けを依頼せず Claude が直接実行**できる(2026-04-26 から)

### 6.5 Vercel デプロイ

- **GitHub main ブランチへの merge で自動デプロイ**(2-5分)
- preview build は認証ウォール越しに見えるが、自動テストでは到達不可 → main マージ後に production で検証
- 環境変数(`NEXT_PUBLIC_SUPABASE_URL` 等)は Vercel ダッシュボード側で管理(コードには `.env.local` のみ参照)

### 6.6 V0 との関係

- v0.app チャット (`gdrBDtOcIEk`) からの自動 push が GitHub に流れる構成
- Claude で main 直接コミット → V0 自動生成と衝突リスク
- **必ず `claude/<topic>` ブランチを切る**(本日 7 PR 全てこのパターン)
- 完全 Claude 移行する場合は V0 連携を切る判断を要相談

## 7. ディレクトリ構成(主要のみ)

```
app/
  api/
    auth/                    ← Phase 8 で新設
      admin/login/route.ts
      teacher/login/route.ts
      patient/login/route.ts
      logout/route.ts
      reset-password/route.ts ← Phase 8b
    universities/[id]/route.ts  ← Phase 7 で requireAdmin 追加
    test-sessions/[id]/route.ts ← 同
    subjects/[id]/route.ts      ← 同
    {universities,subjects,test-sessions}/route.ts (一覧 GET, middleware 401)
  admin/{login,dashboard,master-management,...}
  teacher/{login,exam-info,exam,results}
  patient/{login,exam-info,exam,results}
components/
  admin-login-form.tsx     ← Phase 8 で /api/auth/admin/login 経由に
  teacher-login-form.tsx   ← 同 /api/auth/teacher/login
  patient-login-form.tsx   ← 同 /api/auth/patient/login
  reset-password-form.tsx  ← Phase 8b で /api/auth/reset-password 経由に
  admin-dashboard.tsx
  test-selection-screen.tsx
  ...
lib/
  data-storage.ts          ← 全 Supabase クライアント直接アクセス(Phase 9 で要検討)
  auth/
    api-guard.ts           ← Phase 7 で追加(requireAdmin)
    http-cookie.ts         ← Phase 8 で追加(HttpOnly cookie 発行)
  supabase/{client,server}.ts
middleware.ts              ← Phase 7 で追加(/api/* /admin/* /teacher/* /patient/* ガード)
scripts/
  205_enable_pgcrypto.sql        ← Phase 8(pgcrypto + verify_*_login RPC)
  206_hash_existing_passwords.sql ← Phase 8(平文 → bcrypt)
  207_password_reset_rpc.sql      ← Phase 8b(WARN 修正 + update_*_password_bulk RPC)
```

## 8. 次セッション開始時のチェックリスト

```
[ ] フォルダは C:\Users\yoshi\Documents\Project\OSCEシステム を選択(旧パス禁止)
[ ] CLAUDE.md を読む
[ ] HANDOVER.md(本ファイル)を読む
[ ] memory が自動ロードされる(project_osce_migration / cowork_git_workaround)
[ ] git ラッパー再生成(トリガーフレーズ or CLAUDE.md 雛形参照)
[ ] /tmp/osce-work が無ければ git clone --depth 30 で再取得
[ ] Supabase MCP の execute_sql で SELECT してまだ平文ゼロが維持されていることを確認
[ ] Vercel production が健全(GET /api/universities -> 401)
[ ] 上記 OK なら Phase 9 ADR から開始 or ユーザーが指示する別作業
```

---

## 9. 参考: 本セッションで作成した検証レポート

これらは Claude の一時 outputs フォルダにあり、次セッションでは見えません。必要に応じて Claude が再生成 or リポジトリ commit してください:

- `test-results-smoke.md`(スモークテスト 25件、PASS率 92%)
- `test-results-error-scenarios.md`(エラー系 23件、SEC-01/02 発見記録)
- `test-results-phase7-final.md`(Phase 7 デプロイ後検証)
- `type-error-report.md`(Phase 1〜4 着手前の型エラー分析)

これらの **要点は memory にすべて要約して記録済み**(`project_osce_migration.md`)なので、レポート本体が無くても文脈は引き継がれます。

---

おつかれさまでした。次セッション、Phase 9 から続きをお願いします。
