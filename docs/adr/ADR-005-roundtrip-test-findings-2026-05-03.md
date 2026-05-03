# ADR-005: 通しテスト発見事項と修正方針(EDIAND seed)

**Status:** Accepted
**Date:** 2026-05-03
**Decided:** 2026-05-03(soeda@ediand.co.jp による承認)
**Deciders:** soeda@ediand.co.jp(プロダクトオーナー)/ Claude(設計補助・実施)
**関連:** ADR-001 §6 / ADR-002 9c-2 / ADR-004(canonical 化)

---

## 1. Context

### 1.1 実施した通しテスト

2026-05-03 に本番 Vercel(`https://v0-digital-marksheet-ui.vercel.app/`)で「admin → 大学・大学責任者作成 → 教科・部屋・教科責任者・教員/患者/学生 3 名ずつを設定 → 教員/患者ログインで評価入力 → admin ダッシュボードで集計確認」を end-to-end で実行した。

**EDIAND seed**(本番に残置済み):

- 大学: `ediand` / 株式会社 EDIAND / テスト部門
- 試験セッション: `EDIAND 予備試験 2026-05-10`(passing_score=70, 30分)
- 教科: `ediand_OS` / OSCE 基本
- 部屋: E101 / E102 / E103
- アカウント(全部 password = email の prefix):
  - 大学責任者: `ediand-master@example.com` / `ediand-master`
  - 教科責任者: `ediand-subject-admin@example.com` / `ediand-subject-admin`
  - 教員: `ediand-t1`〜`ediand-t3@example.com`
  - 患者: `ediand-p1`〜`ediand-p3@example.com`
  - 学生: E001〜E003
- 評価項目: 教員側 3 設問 / 患者側 2 設問
- 評価結果: 学生1(E101)について教員 13 点 / 患者 9 点 が記録済み

### 1.2 通しテストで動いたこと

| 項目 | 結果 |
|---|---|
| 共通 `/login`(ADR-001 §7-1)| **既に実装済**。`/admin/login`、`/teacher/login`、`/patient/login` から `/login` に redirect、サーバー側でロール判定 → 役割別 dashboard へ遷移 |
| 教員ログイン → 評価選択 → 出席記録 → 5 段階入力 → 入力完了 | exam_results に正しく書き込まれた(`evaluator_type='teacher'`, `evaluations`, `total_score`, `has_alert`) |
| 患者役ログインで同じフロー | exam_results に `evaluator_type='patient'` で別行として保存 |
| admin ダッシュボード「データを更新」 | 部屋別カードに 出席数・完了数・平均(教)・平均(患)が反映 |

---

## 2. 発見事項一覧

### F1. `/api/rooms` POST の onConflict が UNIQUE 制約と不一致 🔴 重大

**現象:** 部屋マスター管理 UI で「追加」を押すと UI 上は登録されたように見えるが、画面遷移すると消える。DB に何も入らない。

**根本原因:**
- `app/api/rooms/route.ts:62`:
  ```ts
  .upsert(rows as never, { onConflict: "room_number,test_session_id" })
  ```
- 一方、実際の UNIQUE 制約は `rooms_unique_per_session UNIQUE (room_number, university_code, subject_code, test_session_id)` の 4 列。
- PostgreSQL の `ON CONFLICT (col, ...)` は UNIQUE 制約とカラム集合が完全一致していなければ `there is no unique or exclusion constraint matching the ON CONFLICT specification` でエラーになる。
- API 側はこのエラーを 500 で返しているが、フロント側は楽観更新で「成功表示」のままリストに追加してしまう(その後の reload で消える)。

**影響範囲:** EDIAND だけでなく **全大学**。本番で部屋を新規追加できない。

**修正:**
- API 側 `onConflict` を `room_number,university_code,subject_code,test_session_id` の 4 列に揃える(commit aee0b30 で main に反映済)
- 既存の `rooms_unique_per_session` UNIQUE 制約を再利用すれば、追加の DDL は不要

---

### F2. `rooms_room_number_key UNIQUE (room_number)` が複数大学運用を阻害 🔴 重大

**現象:** 通しテスト中、EDIAND で `room_number='101'` を直接 INSERT しようとすると失敗。dentshowa が 101 を持っているため。

**根本原因:**
- `rooms_room_number_key` が `UNIQUE (room_number)` のみ(=部屋番号がグローバルに一意)。
- 一方で `rooms_unique_per_session` という 4 列 UNIQUE が **同時に** 存在しており、後者の方が正しい設計意図(同一試験セッション内で部屋番号一意)。
- F1 を直しても、`rooms_room_number_key` が残っている限り「dentshowa の 101」と「ediand の 101」が衝突する。

**修正:**
- `scripts/212_drop_global_room_number_unique.sql` で `rooms_room_number_key` を DROP
- 4 列 UNIQUE は既に存在するので追加不要
- 通しテスト用に EDIAND の部屋を `E101/E102/E103` で seed 済み。本マイグレーション適用後、必要なら `101/102/103` に rename 可

---

### F3. `university_admin`(大学責任者)を UI から作れない 🟡 中

**現象:** `/admin/users/new` の役割ドロップダウンに「一般教員 / 教科責任者 / 患者役」しかなく、大学責任者を一発で作れない。teachers-list で「一般教員 → 大学管理者」に昇格させる二段階フローが必要(発見しづらい)。

**今回の対応:** EDIAND 大学責任者は `hash_password_if_plain` RPC + INSERT で SQL 直接作成した。

**修正(別途検討):**
- `/admin/users/new` の役割ドロップダウンに「大学管理者」を追加(`accountType=='special_master' || 'university_master'` の時のみ表示)
- ADR-001 §7-1 の登録モデルとも整合: `university_master`(=teachers.role=`university_admin`)を「大学責任者」として表示
- ただし `university_master` は ADR-001 では「手動 SQL」と記載があるので、UI 化するかは要相談(special_master しか university_master を作るべきでないという運用ルール)

---

### F4. canonical 化未実装による試験セッション再登録地獄 🟡 中(ADR-004 で扱い中)

**現象:** `teachers` / `patients` / `students` / `rooms` の `test_session_id` がすべて NOT NULL。新しい試験セッションを作るたびに、教員・学生・部屋を再度 INSERT する必要がある。

**通しテストへの影響:** 大学責任者を「先に」作ろうとすると、teacher.test_session_id NOT NULL のため、まず test_session を作る必要があるチキン&エッグ。今回は `(1) 教科 → (2) test_session → (3) 大学責任者` の順で SQL bootstrap で吸収した。

**修正:** ADR-004(Proposed)の Phase B-2-1〜B-2-4 をそのまま実施すれば解消。本 ADR はこの優先度を **「Phase 9 RLS 完了済の今、次に着手すべき最大の構造改善」** と再評価する。

---

### F5. 受験者一覧画面で評価結果が反映されない / 別大学のテスト名が混入 🟡 中

**現象:** `/admin/students-detail`(受験者一覧)で EDIAND 学生 3 名がすべて「未受験」表示。進捗・点数・教員・患者・合否がすべて `-`。さらに「タイトル1」列に dentshowa の test 名「`202512 全身の医療面接評価(短縮版)`」が混入。

**仮説(要調査):**
- 受験者一覧の data fetch が test_session_id でフィルタしていない、または exam_results との JOIN キーが一致していない
- title 列の test 検索が大学を跨いでいる(ロック単位 or `LIMIT 1` で先頭の test を引いている)

**修正:** 別タスクで `app/admin/students-detail/page.tsx` と関連 API を調査。本 ADR では発見の記録のみ。

---

### F6. 合格判定が常に 0 → `passing_score` の意味付け不明確 🟡 中

**現象:** ダッシュボードで合格者が 0。学生1 は教員 13/15 (86.7%) + 患者 9/10 (90%) で実質合格相当だが、`test_sessions.passing_score=70` を絶対点で判定しているため不合格扱い。

**選択肢:**

| 案 | 内容 | Pros | Cons |
|---|---|---|---|
| A | `passing_score` を %(0–100)として運用 | 設問数に依存しない、直感的 | UI 表記を「合格ライン 70%」に変更要 |
| B | `passing_score` を絶対点とし、評価上限が `passing_score` を上回るように設問数を縛る運用 | コード変更不要 | 設問追加で都度 passing_score を再計算する手間 |
| C | role_type ごとに別々の `passing_score` を持つ(教員/患者で別判定) | 細粒度制御可 | UI / DB 変更大 |

**推奨:** **A(% 運用)** 。判定式を `(total_score / max_possible_score) * 100 >= passing_score` に変更。ただし「教員と患者の合算スコアか、別々の判定か」は運用要件確認が必要(本 ADR の Open Question)。

---

### F7. 試験画面ヘッダーの進捗・合計点が学生別に集計されない 🟢 低

**現象:** `/teacher/exam` のヘッダーに「進捗 0/3 合計点 0 点」と表示されたまま、学生選択 → 評価入力をしても更新されない。学生カード側(`得点: 13点 進捗: 3/3`)は正しく更新される。

**修正:** ヘッダーの `useEffect` で選択中の学生の評価をリッスンするように修正。優先度低。

---

## 3. Decision

### 3.1 本 PR で実施すること

- [x] **F1 fix:** `app/api/rooms/route.ts:62` の onConflict を 4 列に修正(commit aee0b30 で main に直接反映済 — Web UI 上のラジオが効かず main へ commit、本番 Vercel が即デプロイ中)
- [ ] **F2 fix:** `scripts/212_drop_global_room_number_unique.sql` を追加(`rooms_room_number_key` を DROP)
- [ ] 本 ADR 自体(ADR-005)の起票

### 3.2 別 PR / 別 ADR で扱うこと

- F3(大学責任者の UI 登録)— ADR-001 §7-1 の延長で別 PR
- F4(canonical 化)— **ADR-004 Proposed → Accepted への昇格 + 実装着手** を強く推奨
- F5(受験者一覧の表示バグ)— 調査タスクとして別途切る
- F6(合格判定仕様)— 運用要件ヒアリング後に別 ADR
- F7(ヘッダー集計)— tech-debt として別途

---

## 4. Action Items

### Phase R-1(本 PR): F1 + F2

- [x] `app/api/rooms/route.ts:62` 修正(onConflict 4 列) — commit aee0b30 main
- [x] `scripts/212_drop_global_room_number_unique.sql` 追加 — 本 PR
- [ ] Supabase MCP `apply_migration` で本番に scripts/212 適用
- [ ] 本番 UI で部屋追加が動くこと確認(EDIAND で `E104` を追加 → 表示・永続化される)
- [ ] PR レビュー → main マージ → Vercel preview → 本番

### Phase R-2 候補(優先度順)

1. **ADR-004 を Accepted に昇格 + canonical 化実装着手**(F4)
2. F5 の受験者一覧 表示バグ調査・修正
3. F6 の合格判定仕様確定 → 別 ADR
4. F3 の大学責任者 UI 登録
5. F7 のヘッダー集計修正

---

## 5. Open Questions

1. **F2 の Phase R-1 適用順序:** `scripts/212` を先に適用してから API fix の本番デプロイをする(逆だと部屋追加 UI 経由で他大学と衝突する room_number を試して 23505 が出る) → デプロイ手順の明記が必要
2. **F6 の合格判定:** %判定にする場合、教員側スコアと患者側スコアを合算するか別々に判定するか(現行 DB は exam_results が evaluator_type で分かれているため別々判定が自然)
3. **F4 の canonical 化スコープ:** ADR-004 をどこまで一気にやるか(Phase B-2-1〜B-2-4 のうち、まず DB 構造変更だけ進めて UI は段階移行、というアプローチが安全)

---

## 6. Consequences

### 楽になること
- F1 + F2 の同時 fix で、部屋マスター管理 UI が **全大学で正常動作** に戻る
- 複数大学運用の地雷(部屋番号グローバル UNIQUE)が消える
- 本 ADR が今後の通しテストの「期待される結果」のリファレンスになる

### 注意すること
- F2 の `DROP CONSTRAINT` は破壊的だが、同等の機能が `rooms_unique_per_session` で担保されているため実質的な制約緩和のみ。既存データは影響を受けない
- 本番に EDIAND seed が残っているため、誤って試験運用に混入しないよう、admin ダッシュボードの大学切替で運用大学のみ選択する運用ルールが必要

---

## 7. References

- ADR-001 — UI/UX 再設計(共通 /login が既に実装済であることを本 ADR が確認)
- ADR-002 — Phase 9c API 集約(`/api/rooms` は既に Phase 9c-2 で集約済)
- ADR-003 — Phase 9 RLS(本通しテストで RLS 有効状態でも認証経路が正常動作することを確認)
- ADR-004 — 学生 canonical 化 + junction(本 ADR で優先度を再評価、F4)
- 本日の通しテスト記録は session 内に保持
