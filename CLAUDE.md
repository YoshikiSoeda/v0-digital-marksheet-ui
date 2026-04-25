# CLAUDE.md — OSCEシステム (Digital Marksheet UI) 開発ガイド

このファイルは Claude が本リポジトリで作業する際の最重要コンテキストです。新しいセッションを始めるたびに最初に読み込んでください。

## プロジェクト概要

**Digital Marksheet Exam System** — 大学医学部・歯学部の OSCE(客観的臨床能力試験)を運用するための Web アプリ。元は v0.app で生成され、Vercel にホスト、GitHub と自動同期されている。Claude (Cowork) で継続開発する移植作業を 2026-04-25 に開始。

- **GitHub**: https://github.com/YoshikiSoeda/v0-digital-marksheet-ui
- **本番**: Vercel (`yoshikis-projects-25d1c165/v0-digital-marksheet-ui`)
- **作業フォルダ**: `C:\Users\yoshi\Documents\Claude\Projects\OSCEシステム`
- **想定利用機関**: 昭和医科大学 歯学部 (`dentshowa`)、神奈川歯科大学 (`kanagawadent`) ほか

## 技術スタック

| 項目 | 内容 |
| --- | --- |
| フレームワーク | **Next.js 16.0.10** (App Router) |
| ランタイム | React 19.2.0, TypeScript 5 |
| スタイル | Tailwind CSS 4.1.9 + tailwindcss-animate + `tw-animate-css` |
| UI | shadcn/ui (Radix UI ベース) + lucide-react |
| BaaS | **Supabase** (PostgreSQL + Auth は未使用) — `@supabase/ssr` 0.8.0, `@supabase/supabase-js` 2.86.0 |
| フォーム | react-hook-form + zod |
| グラフ | recharts |
| アナリティクス | `@vercel/analytics` |
| パッケージマネージャ | **pnpm** (`pnpm-lock.yaml` あり) |

## 開発コマンド

```bash
pnpm install           # 依存インストール
pnpm dev               # ローカル起動 (http://localhost:3000)
pnpm build             # 本番ビルド
pnpm start             # 本番ビルド起動
pnpm lint              # ESLint
```

## 環境変数

`.env.local`(未コミット)に以下を設定する。`.env*` は `.gitignore` 済み。

| 変数名 | 用途 | スコープ |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon キー | client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | service role キー(API ルートからの管理操作) | **server only** |
| `SUPABASE_URL` | 一部 API ルートで参照(基本は `NEXT_PUBLIC_SUPABASE_URL` と同値) | server |

> Supabase 接続は `lib/supabase/client.ts`(ブラウザ)、`lib/supabase/server.ts`(SSR/RSC)、各 `app/api/*/route.ts`(service role)に分かれている。

## ディレクトリ構成

```
.
├── app/                       # Next.js App Router
│   ├── page.tsx               # ランディング(3ロールへの導線)
│   ├── layout.tsx             # ルートレイアウト + Vercel Analytics
│   ├── globals.css
│   ├── privacy/, terms/, reset-password/
│   ├── admin/                 # 試験管理者(special_master / university_master / admin)
│   │   ├── login/
│   │   ├── dashboard/         # 部屋別の進捗・点数集計
│   │   ├── account-management/, master-management/
│   │   ├── university-management/, subject-management/, room-management/
│   │   ├── question-management/{create,edit/[id]}/
│   │   ├── students/, students-list/, students-detail/
│   │   ├── teachers-list/, patients-list/
│   │   ├── register-students/, register-teachers/, register-patients/
│   │   └── settings/
│   ├── teacher/               # 教員(general / subject_admin / university_admin / master_admin)
│   │   ├── login/, exam-info/, exam/, results/
│   ├── patient/               # 患者役(general / admin)
│   │   ├── login/, exam-info/, exam/, results/
│   └── api/                   # サーバーサイド API(service role 利用)
│       ├── universities/{[id],bulk}/
│       ├── subjects/[id]/
│       └── test-sessions/[id]/
├── components/                # ドメインコンポーネント
│   ├── admin-*.tsx            # 管理画面
│   ├── teacher-*.tsx, patient-*.tsx, student-*.tsx
│   ├── exam-*.tsx             # 試験・採点・結果画面
│   ├── question-*.tsx         # 問題・テスト管理
│   ├── room-management.tsx, subject-management.tsx, university-management.tsx
│   └── ui/                    # shadcn/ui プリミティブ(Radix ラッパー)
├── lib/
│   ├── data-storage.ts        # ★ 全 Supabase 読み書きを集約(923行)
│   ├── supabase/{client,server}.ts
│   └── utils.ts               # cn() ヘルパー
├── hooks/use-toast.ts
├── scripts/                   # Supabase SQL マイグレーション(連番管理)
│   ├── 001-005_*.sql          # 初期スキーマ + 大学・アカウント
│   ├── 100-105_*.sql          # 大学・管理者・教員・部屋・学生 import
│   ├── 110-111_*.sql          # 教科(subject)管理
│   ├── 200-204_*.sql          # test_session 関連リファクタ
│   └── add-test-session-status.sql
├── public/                    # 静的アセット(ロゴ・アイコン)
├── styles/globals.css
├── package.json, pnpm-lock.yaml, tsconfig.json
└── next.config.mjs            # ⚠ typescript.ignoreBuildErrors: true
```

## 認証 / 認可モデル

**Supabase Auth は使っていない**。各ロールが個別ログインフォームから email + password を送り、`admins` / `teachers` / `patients` テーブルと突合する独自方式。ログイン情報は `sessionStorage` の `loginInfo`、`userType`、`role`、`universityCode`、`subjectCode`、`accountType` に保存され、各画面はそれを参照して権限分岐する。

### ロール体系

| 種別 | テーブル | role / account_type 値 | 権限の階層 |
| --- | --- | --- | --- |
| 管理者 | `admins` | `special_master`, `university_master`, `admin` | 全大学 / 単一大学 / 一般管理 |
| 教員 | `teachers` | `master_admin`, `university_admin`, `subject_admin`, `general` | 全権 / 大学内全権 / 教科管理 / 一般教員 |
| 患者役 | `patients` | `general`, `admin` | 一般 / 患者役管理 |

### データ階層

```
universities (university_code)
  └─ subjects (subject_code)        ← 教科。ロール権限の単位にもなる
       ├─ rooms (room_number)        ← 試験部屋。教員1名 + 患者役1名がアサイン
       ├─ teachers (assigned_room_number)
       ├─ patients (assigned_room_number)
       ├─ students (room_number)
       └─ tests (test_session_id, role_type='teacher'|'patient', passing_score)

test_sessions (id, description, test_date, status)
  status: not_started | in_progress | completed
```

## 主要機能の実装状況

| # | 機能 | 主要画面 / コンポーネント | API / DB | 状態 |
| --- | --- | --- | --- | --- |
| 1 | 試験課題・シナリオ管理 | `app/admin/question-management`, `subject-management`, `master-management`, `university-management`, `room-management`, `register-{students,teachers,patients}` / `components/question-{management,create,edit}.tsx` | `/api/test-sessions`, `/api/subjects`, `/api/universities` / `tests`, `test_sessions`, `subjects`, `universities`, `rooms` | ✅ 直近のコミットも集中。安定運用フェーズ |
| 2 | 受験者管理・進行制御 | `app/admin/{students,students-list,students-detail,patients-list,teachers-list}`, `app/{teacher,patient}/{login,exam-info,exam,results}` / `components/{exam-info-screen,exam-screen,test-selection-screen,patient-exam-tabs,teacher-exam-tabs}.tsx` | `students`, `attendance_records`, `test_sessions` | ✅ 教員側・患者役側の試験フロー実装済み(セッション選択 → 試験情報 → 採点) |
| 3 | 評価入力・採点 | `components/{patient-exam-tabs,teacher-exam-tabs}.tsx`(本番ルート)、`exam-screen.tsx`(後述・要確認) | `evaluation_results`, `attendance_records`, `tests.passing_score`, `tests.role_type` | ✅ 教員/患者役それぞれの評価項目を別管理。合否判定対応(script 203) |
| 4 | 結果集計・レポート | `app/admin/dashboard`, `app/{teacher,patient}/results` / `components/{admin-dashboard,exam-results-screen}.tsx` | `evaluation_results`, `attendance_records`, `test_sessions` | ✅ 部屋別ダッシュボード(出席・完了・アラート・平均点・教員/患者別平均・合格者数)実装済み |

### 既知の問題・要注意点

1. **`components/exam-screen.tsx` は V0 由来のデッドコードの可能性が高い**
   - `generateMockQuestions()` で 100問のダミー問題を生成し、`router.push("/student/results")` へ遷移する。
   - だが `app/student/` というルートは存在しない(`app/teacher/`, `app/patient/` のみ)。
   - 実運用は `patient-exam-tabs.tsx` / `teacher-exam-tabs.tsx` 経由の模様。**変更前に呼び出し元を要確認**。

2. **平文パスワードが DB と SQL に書かれている**
   - `scripts/102_import_teachers.sql` などで `password = 'a'`, `'b'` など平文の seed が入っている。`scripts/105_update_admin_password.sql` も平文更新。
   - 本番運用までに Supabase Auth への移行 or pgcrypto によるハッシュ化が必要。

3. **`next.config.mjs` が `typescript.ignoreBuildErrors: true`**
   - V0 由来。型エラーがあってもビルドが通る状態。型チェックは `pnpm exec tsc --noEmit` で別途実行を推奨。

4. **不要な NPM パッケージが入っている**
   - `package.json` に `"crypto": "1.0.1"`, `"fs": "0.0.1-security"`, `"path": "0.12.7"` が含まれている。これらは Node 標準モジュールを偽装した stub パッケージで、削除すべき。

5. **README.md は V0 のテンプレート文言のまま**(本リポジトリ固有の説明はゼロ)。差し替え推奨。

## SQL マイグレーション運用

`scripts/` 配下に連番(`001_*`, `002_*`, ..., `200_*`, ...)で管理。Supabase ダッシュボードの SQL エディタから手動適用する想定。

- `001-005`: 初期スキーマ(大学・アカウントタイプ・初期データ・テストセッション)
- `100-105`: 本番データ import(大学2校・管理者・教員50名・部屋・学生350名・admin パスワード更新)
- `110-111`: 教科(subject)管理の追加
- `200-204`: test_session 主軸へのリファクタ(test_code 廃止、role_type 追加、UNIQUE 制約)
- `add-test-session-status.sql`: status カラム追加(命名が連番に乗っていないので次マイグレーションで揃えるとよい)

新しいマイグレーションを追加するときは `205_*.sql` から続ける。

## V0 との関係

- v0.app の chat (`https://v0.app/chat/gdrBDtOcIEk`) からの自動 push が GitHub に流れる構成。
- Claude 側で main へ直接コミットすると、V0 側の生成と衝突する可能性あり。**Claude で作業するときはブランチを切る**(例: `claude/<topic>`)。
- 完全に Claude 主軸へ移行する場合は、V0 連携を切るか、別リポジトリへフォークする判断を検討。

## ローカル `.git` について(2026-04-25 現在)

作業フォルダ `C:\Users\yoshi\Documents\Claude\Projects\OSCEシステム\.git` には**前回セッションで途中失敗した `git init` の残骸**(`config.lock` あり、`objects` なし)が残っている。Claude のサンドボックスからは権限不足で削除できないため、Windows エクスプローラから手動削除 → `git clone https://github.com/YoshikiSoeda/v0-digital-marksheet-ui.git .` で取り直すのが最短。

なお、ファイル本体(`app/`, `components/`, ...) は Cowork セッション内のクローン (`/tmp/osce-clone`) からコピー済みなので、コードは閲覧・編集できる状態。

## 開発時の注意

- **コメントや UI 文言は日本語**。コードに `// <CHANGE>` 等の V0 マーカーがあるが消しても害なし。
- 大量のファイルを書き換える際は、shadcn/ui プリミティブ (`components/ui/`) は触らない方が無難。
- データ取得は基本 `lib/data-storage.ts` のラッパー関数を使う(直接 Supabase クライアントを叩かない)。
- API ルート (`app/api/*`) は service role を使うため、ブラウザから呼ぶ際は権限チェックを呼び出し側で必ず行う。
- 多テナント(university_code)を必ず意識する。`load*` 関数の `universityCode` 引数を渡し忘れると他校データが混ざる。

## 参考リンク

- v0 chat: https://v0.app/chat/gdrBDtOcIEk
- Vercel: https://vercel.com/yoshikis-projects-25d1c165/v0-digital-marksheet-ui
- 会社: https://www.ediand.co.jp/
