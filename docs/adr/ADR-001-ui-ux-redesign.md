# ADR-001: UI/UX・画面遷移の全面再設計

**Status:** Accepted
**Date:** 2026-05-02
**Decided:** 2026-05-02(soeda@ediand.co.jp による承認)
**Deciders:** soeda@ediand.co.jp(プロダクトオーナー)/ Claude(設計補助)
**関連:** Phase 9 (RLS) と密接 — データ取得層の見直しが UI 層に直撃する

---

## 1. Context

### 1.1 なぜ今これを議論するか

Phase 1〜8b で型エラー・middleware・bcrypt パスワード化までは仕上がった一方、**UI 側は V0 自動生成から大きく変わっておらず**、画面遷移・状態管理・コンポーネント分割に複数の構造的問題が残っている。Phase 9(RLS 有効化)に着手すると `lib/data-storage.ts` の anon 直接 SELECT を全面的に `/api/*` 経由に置き換える必要があり、その影響が UI コードに広く波及する。**先に UI/UX の方針を決めておかないと、Phase 9 の作業がリファクタとデータ層書き換えに二重の手戻りを生む。**

ユーザーから「全体的に設計を見直したい」との要望(2026-05-02)。スコープは UI/UX・画面遷移、アウトプットは ADR、破壊的変更(URL・API・DB スキーマの非互換変更)は許容(運用ユーザーまだ少数)。

### 1.2 現状調査で確認できた事実(根拠付き)

#### F1. ルート構成にロールと権限の不整合がある

| 観察 | 根拠 |
|---|---|
| 教員ログインの非 general(subject_admin / university_admin / master_admin)が `/admin/dashboard` へ流入 | `components/test-selection-screen.tsx` L209-216 で「教員 + 非 general → 管理画面ボタン」表示 |
| `/admin/login` と `/teacher/login` の両方から admin ダッシュボードに到達できる | `components/admin-dashboard.tsx` L141-152 で `teacherRole` と `accountType` を併用判定 |
| 不要・スタブのルートが残存 | `app/admin/students/page.tsx`(5行)、`app/admin/questions/page.tsx`(5行)。両方 `students-list` / `question-management` と機能重複 |
| URL の `/admin/*` 在不在と sessionStorage の `accountType` / `teacherRole` の二重管理 | 上記 + `app/admin/master-management/page.tsx` L13-20 等 |

#### F2. レイアウト/共通シェルが存在しない

- `app/layout.tsx`(47行)は `<html><body>{children}</body></html>` 相当 + Vercel Analytics のみ。ヘッダー、サイドナビ、フッター、パンくず、ロール切替 UI は全て無い。
- 各ページが独自に「戻る」「ダッシュボードへ」ボタンを実装し、アイコンも `<Home />` / `<ArrowLeft />` でバラバラ(`app/admin/account-management/page.tsx` L15-20、`app/admin/master-management/page.tsx` L29-32)。
- フッター(利用規約 / プライバシー / 会社 HP)は `app/page.tsx` のランディングだけにある。

#### F3. デッドコード・V0 残骸の残存

| 対象 | 状態 |
|---|---|
| `components/exam-info-screen.tsx`(70行) | `examPath = "/student/exam"` が default、import 元ゼロ(`grep -rn "ExamInfoScreen"` で本体定義 1 箇所のみ)。HANDOVER 既知の `exam-screen.tsx` と同種の死語コンポーネント |
| `app/admin/students/page.tsx` / `app/admin/questions/page.tsx` | 5 行の wrapper、機能は `students-list` / `question-management` と重複 |
| `[v0] ` プレフィックスの `console.log` | 本番コードに 200 件以上残置(`grep '\[v0\]\|console.log' app/ components/ \| wc -l` = 206) |

#### F4. 試験フロー(exam page wrapper / Tabs)の重複実装

- `app/teacher/exam/page.tsx`(80行)と `app/patient/exam/page.tsx`(56行) は **sessionStorage 読込・JSON parse・バリデーション・ログイン redirect・loading UI** が文字通り並行実装。違いは変数名と一部キー(`teacher_selected_test` vs `patient_selected_test`)。
- `components/teacher-exam-tabs.tsx`(512行)と `components/patient-exam-tabs.tsx`(555行) も **同じ「学生選択 + 評価入力 + 集計保存」フロー**を別実装。型定義(`Question`, `QuestionWithMeta`, `Answer`)は patient 側のみ。`saveAttendanceRecords` の呼び出しは teacher 側のみ。
- 既に「片方だけ修正されて差分が広がっている」状態。

#### F5. sessionStorage の flat な散在 + 認証/認可の二重管理

- 確認できたキー(13種): `loginInfo`, `accountType`, `role`, `teacherRole`, `teacherId`, `universityCode`, `subjectCode`, `testSessionId`, `userType`, `examStartTime`, `patient_selected_test`, `teacher_selected_test`, `filterSubjectCode`(全 110 箇所のアクセス)
- 命名規約なし: `teacher_selected_test` だけ snake_case、他 camelCase。スキーマ・型定義なし。
- Phase 8 で **HttpOnly Cookie + bcrypt によるサーバー認証は導入済み**だが、UI 側の権限分岐は依然 sessionStorage 値で判定 → **「真実の出所」が二重化**(改竄リスク + リロードで欠落リスク)
- middleware(Cookie ベース)と UI(sessionStorage ベース)の不一致が発生しうる

#### F6. データ取得層の二重実装

- `lib/data-storage.ts` の `loadTests`/`loadStudents`/`loadTeachers`/`loadRooms`/`loadAttendanceRecords`/`loadEvaluationResults`/`loadSubjects` は **anon key で直接 Supabase SELECT**
- 一方 `/api/universities`、`/api/test-sessions`、`/api/subjects` は **service role + middleware ガードの API 経由**
- 同じ画面で混在: `admin-dashboard.tsx`(L171-243 で fetch、L248-267 で loadXxx)、`test-selection-screen.tsx`(L58 fetch、L70/77 loadXxx)、`teachers-list/page.tsx`(L45 fetch、L66 loadXxx)
- snake_case → camelCase 変換は各画面で都度実装(`admin-dashboard.tsx` L177-180, L201-208 等)

#### F7. インライン実装とコンポーネント抽出の混在

- `app/admin/teachers-list/page.tsx`(507行)、`students-list`(398行)、`students-detail`(354行)、`patients-list`(419行)は page.tsx 内に Client Component が肥大化
- `app/admin/dashboard/page.tsx`(5行)は `<AdminDashboard />` だけ呼ぶ薄い wrapper — パターンが揃っていない
- 一覧系画面に共通の「DataTable + フィルタ + CSV 出力 + 編集 Dialog」UI が **4-5 画面にコピー**されている

#### F8. ロール別 UX の認知負荷

- 同じ「教員ログイン」で同じ ID/PW なのに、ロールによって遷移先が変わる(general → exam-info、それ以外 → exam-info にボタン追加で admin 経路)
- ホーム `app/page.tsx` のロール選択は「患者担当者 / 教員 / 管理者」の 3 ロールだが、実体は 4 種(管理者 + 教員 admin) → ユーザーから見るとどれを選ぶべきか曖昧
- 患者役の `general` / `admin` の差は UI 上ほぼ不可視

#### F9. 試験中 UX の情報不足

- 経過時間(`elapsedTime`)は表示されるが、**制限時間は無い**(`exam-info-screen.tsx` の「90分」はデッドコード上の表記で、実際の試験画面には反映されていない)
- 合否判定(`passing_score`)は admin-dashboard 側だけで表示 → **試験官(teacher/patient)には見えない**
- 現在実施中のテストセッション名・日付・教科がヘッダーに表示されない → 部屋誤り・日付ズレに気づきにくい
- アラート機能(`hasAlert`)の発火・集計フローが UI から推測しづらい

---

## 2. Decision(提案)

### 2.1 結論

**Option B(ロール統合 + URL リファクタ + 共通シェル)** を採用することを提案する。Option A は手戻りが大きく、Option C はスコープ過多。

ただしこの ADR は「方針の合意形成」が目的で、**最終決定はユーザー判断**。実装は Phase 単位に分割して段階リリース(下記 §6 Action Items)。

### 2.2 採用に至る一次原則

1. **真実の出所(source of truth)は 1 つに**: 認証・認可は HttpOnly Cookie + middleware に集約、UI から sessionStorage 認可ロジックを撤廃
2. **画面シェルは 1 つに**: ロールごとに `app/(role)/layout.tsx` を持ち、ヘッダー・パンくず・ロール表示・現在セッション表示・ログアウトを共通化
3. **データ取得経路は 1 つに**: `/api/*` に一本化(Phase 9 の RLS 有効化と同期)、UI 側は `lib/api/<resource>.ts` の薄い fetch wrapper のみ参照
4. **ロール別 UI は components で分岐、URL では分けない**: 試験フローは `/sessions/[id]/evaluate` 1 経路、role は claim から判定

---

## 3. Options Considered

### Option A: 段階的整流(最小破壊・現状寄り)

| Dimension | Assessment |
|---|---|
| 複雑度 | Low |
| 工数 | 1〜2 PR(数日) |
| 破壊的変更 | URL 変更なし、API 変更なし、DB 変更なし |
| Phase 9 との親和性 | 低(Phase 9 でほぼ全画面再修正) |
| ロールアウトリスク | 最小 |

**内容**:
- `components/exam-info-screen.tsx`、`app/admin/students/page.tsx`、`app/admin/questions/page.tsx` を削除
- `[v0]` console.log を全消去
- `lib/session-storage.ts` を作って sessionStorage アクセスを型付き API に集約
- exam page wrapper を共通フックに(`useExamSessionGuard`)
- `teacher-exam-tabs` / `patient-exam-tabs` の共通部分を `<ExamTabs role={...}>` に抽出

**Pros**:
- 即実施可能、リスク最小
- 既存の運用フローを壊さない

**Cons**:
- 構造的な問題(ロール × URL の二重管理、sessionStorage 認可、データ取得二重実装、共通シェル不在)は **すべて温存**
- Phase 9 で `lib/data-storage.ts` を `/api/*` に置換する際、各画面の fetch ロジックを再度書き直すことになる
- レイアウト共通化を後回しにすると、各画面のヘッダー・ナビ修正が膨大になる

---

### Option B: ロール統合 + URL リファクタ + 共通シェル(推奨)

| Dimension | Assessment |
|---|---|
| 複雑度 | Medium |
| 工数 | 4〜6 PR(2〜3 週間想定、Phase ごとに段階リリース) |
| 破壊的変更 | URL 変更あり(redirect で旧URL→新URL の互換期間を設ける)、sessionStorage 廃止、API 集約 |
| Phase 9 との親和性 | 高(データ取得を `/api/*` 集約 → そのまま RLS 有効化に進める) |
| ロールアウトリスク | 中(段階移行で抑制可能) |

**内容**:

#### B-1. URL 構造の再編
```
旧                                       新
/admin/login                          → /login(ロール pickerは廃止 or タブ)
/teacher/login                        → /login
/patient/login                        → /login
/teacher/exam-info                    → /sessions(ロール claim で見える項目自動切替)
/patient/exam-info                    → /sessions
/teacher/exam?testId=xxx              → /sessions/[sessionId]/evaluate(role 自動)
/patient/exam?testId=xxx              → /sessions/[sessionId]/evaluate
/admin/dashboard                      → /admin(または /admin/sessions/[id])
/admin/master-management              → /admin/master(以下 university/subject/room はその下)
/admin/account-management             → /admin/users(students/teachers/patients を tab)
/admin/teachers-list                  → /admin/users/teachers
/admin/register-teachers              → /admin/users/teachers/new(同一画面で list + new)
/admin/students-detail?id=xxx         → /admin/users/students/[id]
```

#### B-2. レイアウト共通化(Route Groups)
```
app/
├── (auth)/
│   ├── login/page.tsx          ← 統一ログイン(role 推定 or 選択)
│   ├── reset-password/page.tsx
│   └── layout.tsx              ← 認証画面の薄いシェル
├── (app)/
│   ├── layout.tsx              ← AppShell: header/nav/footer/role-aware menu/breadcrumb/current-session
│   ├── sessions/
│   │   ├── page.tsx            ← 試験官(teacher/patient)+admin が見るセッション一覧
│   │   └── [sessionId]/
│   │       └── evaluate/page.tsx  ← 役割は claim から判定
│   └── admin/
│       ├── page.tsx            ← ダッシュボード(現 admin-dashboard)
│       ├── master/{universities,subjects,rooms}/...
│       └── users/{students,teachers,patients}/...
└── layout.tsx                  ← html/body のみ
```

#### B-3. 認証/認可の単一化
- middleware で Cookie を verify し、`x-role`、`x-account-type`、`x-university-code` 等のヘッダー(または server-only context)を下流に渡す
- Server Components で `cookies()` から読んで RSC 内で権限分岐
- **sessionStorage は完全廃止**(または「UI のフィルタ復元用」など UI 状態のみに用途限定)
- Client で必要な情報は Server Component から props で渡す or `/api/auth/me` で取得

#### B-4. データ取得の API 集約(Phase 9 と並走)
- `lib/api/<resource>.ts` を作り、すべて `/api/*` 経由の fetch wrapper に統一
- `lib/data-storage.ts` は段階的に廃止、最後に削除
- snake_case ↔ camelCase 変換は API ルート側で一括実施
- Phase 9 の RLS 有効化はこのレイヤが整ってから

#### B-5. 共通 UI コンポーネント抽出
- `<DataTable>`(フィルタ・検索・CSV・編集 Dialog 連携)で teachers-list / students-list / patients-list / question-management を統一
- `<RoleBadge>`、`<SessionStatusBadge>`、`<CurrentSessionHeader>` を共通化
- exam フローは `<ExamTabs role="teacher|patient">` に統合(F4 解消)

**Pros**:
- 真実の出所が 1 つに(認証・認可・データ取得のすべて)
- Phase 9 の前段としてそのまま機能(データ取得は既に `/api/*` 集約済み)
- 試験官の認知負荷(ロールでログイン入口が違う)が解消
- 共通シェルにより「現在のセッション名表示」「ログアウト導線」「ロール表記」が UI レベルで一貫
- デッドコード・V0 残骸を一掃する整理機会
- 一覧系 UI が共通コンポーネントで統一 → 保守コスト 1/4 程度

**Cons**:
- URL 変更でブックマーク・既存リンクが切れる(redirect で互換期間は確保可能)
- 移行期間中は新旧コード並走 → レビュー負荷増
- Server Components 化に踏み込む場合、現状の Client Component 中心構成から学習コストあり
- 工数が大きく、本番運用しながらの段階移行が前提

---

### Option C: 完全再設計 / アプリ分割(将来課題)

| Dimension | Assessment |
|---|---|
| 複雑度 | High |
| 工数 | 4〜6 ヶ月 |
| 破壊的変更 | 全面 |
| Phase 9 との親和性 | 高だが、Phase 9 を待たせる結果に |
| ロールアウトリスク | 高 |

**内容**:
- Design system layer(token、theme、a11y、i18n)を構築
- 評価入力 UX を再設計(タブ → wizard / split view、リアルタイム保存 status 表示)
- ロール別アプリ分割: `/admin` と `/exam` を別 Next.js プロジェクトに(monorepo 化)
- モバイル / タブレット最適化(現状はデスクトップ前提)、accessibility audit
- 多言語化(英語版要件があれば)

**Pros**:
- 長期保守性が最大
- 大学ごとのカスタマイズ余地が広い

**Cons**:
- 現状の運用フェーズ(数機関に試用想定)に対して過剰
- Phase 9 と排他的(同時並走は事実上不可)
- ROI が見合わない可能性

---

## 4. Trade-off Analysis

| 観点 | A | B(推奨) | C |
|---|---|---|---|
| 即効性 | ◎ | ○ | × |
| Phase 9 との適合 | × | ◎ | ◎ |
| 構造的問題の解消 | × | ◎ | ◎ |
| 工数 | ◎ | ○ | × |
| ロールアウトリスク | ◎ | ○ | × |
| 認証・認可の単一化 | × | ◎ | ◎ |
| 共通シェル整備 | × | ◎ | ◎ |
| 長期保守性 | × | ○ | ◎ |
| 過剰投資リスク | ◎ | ○ | × |

**B を選ぶ理由**: Phase 9 の地ならしが必須である以上「データ取得を /api 集約」「sessionStorage 廃止」は不可避。これらを行うなら、関連 UI(共通シェル・URL・ロール統合)を同じ波で整えるのが最も無駄が少ない。C のスコープ拡張は段階的に B の上に積み増しできるため、まず B で土台を作る。

---

## 5. Consequences(B 採用時)

### 楽になること
- 共通 AppShell に header/nav/footer が集約 → 全画面で一貫したナビゲーション、現セッション表示、ロール表示が即時実現
- 認証・認可がサーバー側 1 経路に集約 → sessionStorage 改竄・リロード欠落リスク消滅
- データ取得が `/api/*` 一本化 → snake/camel 変換も 1 箇所、Phase 9 RLS が即適用可能
- 一覧系画面が共通 DataTable → 修正・機能追加は 1 ファイル変更で全画面反映
- exam フロー重複が解消 → teacher/patient の機能差分バグが構造的に発生しなくなる

### 難しくなること
- 既存ブックマーク・外部からの直リンクが一時的に切れる(Next.js の `redirects` 設定で旧 URL → 新 URL を一定期間維持)
- 段階リリース中は新旧両方の経路をサポート → コードレビュー負荷一時増
- Server Components 寄りの設計に振ると、現行の Client 中心コンポーネントから学習コスト発生

### 後で見直すかもしれない箇所
- `/login` の単一化が UX として直感的かどうか(ロール選択 UI を残すか、メールドメインで自動推定するか)
- `/sessions/[id]/evaluate` で role を claim 自動判定する場合の「同一人物が teacher と patient を兼ねる」ケース対応
- DataTable の抽象度(過度な汎化はコスト増)

---

## 6. Action Items(B 採用時の実装計画 — Phase 9 と並走)

実装は **小さく分割して順次マージ** を原則とする。Phase 9(RLS)に先行する Phase 9-pre のシリーズとして扱う。

### Phase 9a — クリーンアップ(1 PR、1日)
- [ ] `components/exam-info-screen.tsx` を削除
- [ ] `app/admin/students/page.tsx`、`app/admin/questions/page.tsx` を削除(代替 URL に redirect 設定)
- [ ] `[v0]` console.log を全消去
- [ ] `lib/api/` ディレクトリを新設(空でも先に PR 化)

### Phase 9b — sessionStorage の一元化と段階廃止(1〜2 PR、2日)
- [ ] `lib/auth/session-context.ts` を新設し、Cookie から取得した role/accountType/universityCode/subjectCode を Server Components で配布
- [ ] `/api/auth/me` を新設(現セッション情報返却)、Client Component が必要なら fetch
- [ ] sessionStorage 13 キーを 1〜2 個(UI 状態のみ)に圧縮、認可キーは廃止
- [ ] sessionStorage 直接アクセスを `useSession()` フックに統一

### Phase 9c — データ取得 API 集約(2 PR、3〜5日)
- [ ] `/api/students`、`/api/teachers`、`/api/patients`、`/api/rooms`、`/api/attendance-records`、`/api/evaluation-results`、`/api/tests` を作成(GET/POST/PUT/DELETE)
- [ ] `lib/api/<resource>.ts` を作り、UI から呼ぶ wrapper を整備
- [ ] `lib/data-storage.ts` の `loadXxx`/`saveXxx` を上記に置換、最終的に `data-storage.ts` を削除
- [ ] **ここで Phase 9 RLS 本番有効化が可能になる**

### Phase 9d — 共通シェルと URL 再編(2〜3 PR、5〜7日)
- [ ] `app/(auth)/layout.tsx`、`app/(app)/layout.tsx` を新設し、AppShell を実装
- [ ] `<CurrentSessionHeader>`、`<RoleBadge>`、`<SessionStatusBadge>` を共通化
- [ ] 旧 URL から新 URL への redirect を `next.config.mjs` に追加
- [ ] `/login` を統一、`/admin/login` 等は redirect

### Phase 9e — 共通コンポーネントとエグザムフロー統合(2 PR、3〜5日)
- [ ] `<DataTable>` を抽出、`teachers-list`/`students-list`/`patients-list`/`question-management` を置換
- [ ] `<ExamTabs role={...}>` に teacher/patient のロジックを統合、page wrapper を共通フックに
- [ ] 試験中ヘッダーに「現セッション名・教科・部屋・経過時間・(任意)制限時間」を表示

### 検証ステップ(各 Phase 末で必須)
- [ ] 本番テストアカウント(admin/uni/kyouka/ippan/kanjya)で全主要フローを smoke test
- [ ] middleware が新 URL でも 401/redirect を正しく返すことを確認
- [ ] Vercel preview で動作確認 → main マージで自動デプロイ

---

## 7. Open Questions(レビュー時に意思決定が必要)

1. **`/login` の統一 UX**: ロールを選ばせる UI を残すか、メールドメインや ID prefix から自動推定するか
2. **URL の `/sessions/[sessionId]/evaluate` で role を自動判定する設計**: 同一アカウントで複数ロールを兼任するケースは想定するか(現状想定なしで OK?)
3. **段階移行期間**: 旧 URL の redirect サポートはどこまで(永続? 3ヶ月で削除?)
4. **Server Components へのシフト**: どこまで踏み込むか(login と一覧系だけ RSC、評価入力は Client のままなど方針が要る)
5. **Phase 9 ADR を別途立てるか、本 ADR で統合するか**: データ取得 API 集約が本 ADR の Action Item に含まれているため、Phase 9 RLS は内部実装(policy SQL)に集中する別 ADR にするのが自然か

---

## 8. References

- `CLAUDE.md` — プロジェクト全体コンテキスト
- `HANDOVER.md` — Phase 1〜8b の経緯と次の優先順位
- `components/test-selection-screen.tsx`、`components/admin-dashboard.tsx`、`components/{teacher,patient}-exam-tabs.tsx` — 主要影響箇所
- `lib/data-storage.ts`(923行)— Phase 9 で段階廃止対象
- `middleware.ts` — Cookie ベース認証の現行実装(認可ロジックの参照点)
