# ADR-004: 学生の canonical 化と試験セッション割当の junction 化

**Status:** Accepted
**Date:** 2026-05-02(Proposed) / 2026-05-03(Accepted)
**Decided:** 2026-05-03(soeda@ediand.co.jp による承認)
**Deciders:** soeda@ediand.co.jp(プロダクトオーナー)/ Claude(設計補助)
**関連:** ADR-001 §1 / Phase 9 B-1(学年カラム追加、scripts/211)/ ADR-005 F4(本 ADR の優先度を再評価)

> **2026-05-03 追記(Accepted への昇格理由):** ADR-005 §2 F4 で確認した通り、 `teachers` / `patients` / `students` / `rooms` の `test_session_id` がすべて NOT NULL であることが、新規試験セッション作成のたびに全データを再登録するチキン&エッグ問題の根本原因となっている。Phase 9 RLS 完了済の現在、次に着手すべき最大の構造改善として本 ADR を Accepted に昇格し、Phase B-2-1 の最初の一歩(junction table 新設)を `scripts/213` で実施する。
>
> Phase B-2-2 以降(API 層更新 / UI 更新 / 旧列削除)は段階的に別 PR で進める。

---

## 1. Context

### 1.1 ユーザー要望

ユーザーから次の要望が出た(2026-05-02):

> 学生登録機能で、学年という列を加えてください
> 試験を設定する際、再び一人ひとり学生を登録するのは大変なので、学年単位で設定ができるよう考えてください

「学年カラム追加」は Phase 9 B-1(scripts/211)で完了。本 ADR は **「学年単位で試験割当」を実現するための構造変更** を扱う。

### 1.2 現状の問題

現在の `students` テーブルは試験セッションごとに学生レコードを持つ設計:

```
students
  id              uuid PK
  student_id      text  (学籍番号、ユニークではない — session ごとに別 row)
  name, email, department, grade, ...
  room_number     text
  test_session_id uuid  (← session 紐付け)
  university_code text
  subject_code    text
```

**問題点**:
1. 新しい試験セッションを作成するたびに、**同じ学生を再登録**しなければならない(数百件をやり直し)
2. 学籍番号の同一性が DB レベルで担保されていない(同一人物が複数 row として存在)
3. 学生の連絡先(email)などのメンテナンスが session 単位で分散
4. attendance_records / exam_results も `student_id` で紐付くが、これが学籍番号なのか UUID なのか曖昧で重複リスク

### 1.3 制約

- 既存データ: students テーブルに数百件のレコード(university_code = `dentshowa` / `kanagawadent` ほか、test_session 跨ぎで重複あり)
- 既存の attendance_records / exam_results は `student_id` カラムで students を参照(FK 設定の有無は要確認)
- Phase 9 で全データアクセスは /api/* 経由・service role に集約済み — schema 変更は API 層の更新だけで済む
- ユーザーは少数(試用フェーズ)、ある程度の段階移行を許容できる

---

## 2. Decision

### 2.1 結論

**Option A: students を canonical 化 + `student_test_session_assignments` junction を新設** を提案する。

具体的には:

1. **`students` テーブル** から `test_session_id` / `room_number` を取り除く(canonical 学生マスター化)
   - 残る列: `id`, `student_id`(学籍番号、unique per university_code), `name`, `email`, `department`, `grade`, `university_code`, `subject_code`(任意)
   - `(university_code, student_id)` に UNIQUE 制約

2. **新規 `student_test_session_assignments` 表** を作成
   - `student_id uuid` (FK → students.id, ON DELETE CASCADE)
   - `test_session_id uuid` (FK → test_sessions.id, ON DELETE CASCADE)
   - `room_number text`
   - `created_at`, `updated_at`
   - PK: (student_id, test_session_id)

3. **`attendance_records`** と **`exam_results`** は student_test_session_assignment(s, t) を参照する形に整理
   - `attendance_records.student_id` を students.id に揃える(現行混在の可能性、要点検)
   - 必要なら同 junction の代わりに(student_id, test_session_id) 複合 FK
   - 試験中の出欠書込/評価書込 API は本 ADR 範囲

4. **新 UI フロー**(試験セッション作成時の受験者割当)
   - 試験セッション作成画面に「**受験者を一括割当**」セクションを追加
   - 学年・大学・学部学科でフィルタ → 該当学生をプレビュー → 「適用」で junction レコード一括作成
   - 部屋割当はデフォルト未設定、必要に応じて個別調整(担当部屋のドロップダウン or CSV)

### 2.2 採用理由

- 学生マスターを 1 度登録すれば永続(再登録不要)— ユーザー要望にダイレクト対応
- 学年・大学などのフィルタで **数百件を 1 アクションで割当** 可能
- attendance / evaluation の重複リスクを構造的に解消
- 既存データは段階移行(students の重複統合 + assignments への移植)で吸収可能

---

## 3. Options Considered

### Option A: canonical 化 + junction(推奨・採用)

| Dimension | Assessment |
|---|---|
| 複雑度 | Medium-High |
| 工数 | 5〜7 PR(2〜3 セッション) |
| 破壊的変更 | DB スキーマ変更 + 既存データ移行 + UI 大幅変更 |
| 段階移行 | ◎ 旧/新 並走可能 |

**Pros**:
- ユーザー要望の完全解決
- 構造的にきれい、長期保守性 ◎
- 学籍番号の一意性が DB で担保

**Cons**:
- 既存データの重複統合が必要(同一人物が複数 row → 1 row に集約)
- attendance_records / exam_results の参照整合性確保
- UI も新規/編集/CSV すべて junction 対応が必要

### Option B: 現行スキーマ維持で「コピー機能」を追加

| Dimension | Assessment |
|---|---|
| 複雑度 | Low |
| 工数 | 1〜2 PR |
| 破壊的変更 | なし |

**内容**: 「既存試験から学生を複製」ボタンを追加。新試験を作る際に旧試験の学生を選んで一括コピー。

**Pros**:
- 既存スキーマを変えない、ロー リスク
- すぐ実装可能

**Cons**:
- 学生情報の真の一元管理にはならない(コピーごとに row 増殖)
- 連絡先変更などのメンテナンスが分散したまま
- 学籍番号重複の問題は解消しない

### Option C: students.test_session_id を nullable + 学年フィルタの API のみ提供

| Dimension | Assessment |
|---|---|
| 複雑度 | Low-Medium |
| 工数 | 2〜3 PR |
| 破壊的変更 | 軽微 |

**内容**: students の test_session_id を nullable に、`/api/students?grade=4年` のようにフィルタ提供。試験セッション側で「この学年の学生を含める」と論理的に紐づけ。

**Pros**:
- スキーマ変更小
- 学年単位の絞込は実現

**Cons**:
- 物理的な「試験セッションごとの受験者一覧」が確定的に作れない(動的フィルタのみ)
- attendance_records が student_id だけだと「どのセッションの出席か」が曖昧
- 結局 junction 相当が必要になる(設計の負債を先送り)

---

## 4. Trade-off Analysis

| 観点 | A(推奨) | B | C |
|---|:-:|:-:|:-:|
| ユーザー要望(再登録不要) | ◎ | △ | ○ |
| データ整合性 | ◎ | × | △ |
| 工数 | × | ◎ | ○ |
| 移行リスク | △ | ◎ | ○ |
| 長期保守性 | ◎ | × | △ |
| 試用フェーズへの適合 | △ | ◎ | ○ |

**A を選ぶ理由**: ユーザー要望の本質(同一学生の永続マスター化)を解決でき、長期で見ると最も整理された構造になる。短期的な工数は大きいが、段階移行で運用しながら進められる。

**B / C は将来 A への移行が必要になる**ため、本 ADR では A を採用する。

---

## 5. 段階実装計画(Action Items)

### Phase B-2-1: 新スキーマ準備(DB のみ、UI 影響なし)

> **2026-05-03 番号繰下げ:** scripts/212 が ADR-005 F2(rooms_room_number_key DROP)で先取された。本 ADR の Phase B-2-1 は scripts/213 から始める。さらに scripts/214 は ADR-006 Phase R-2-F6-0(exam_results.max_score 追加)で予約済み。

- [x] **scripts/213**: `student_test_session_assignments` 表新設(本 PR で実施)
- [ ] **scripts/215**: students の重複統合(同一 university_code + student_id を集約、最新の連絡先を採用)
  - 注: 重複統合ルールはユーザーと合意の上で実行
- [ ] **scripts/216**: `(university_code, student_id)` UNIQUE 制約追加
- [ ] **scripts/217**: 既存 students の (id, test_session_id, room_number) を assignments テーブルに展開
- [ ] **scripts/218**: students から `test_session_id` `room_number` 列削除(最後)

各 migration ごとに smoke test(API 動作 + UI データ表示)を入れる。

### Phase B-2-2: API 層更新

- [ ] **`/api/students`** の GET/POST から test_session_id 引数を撤廃、代わりに別 endpoint:
- [ ] **`/api/student-test-session-assignments`** GET/POST/DELETE 新設
- [ ] **`/api/test-sessions/[id]/assign-students`** バルク割当エンドポイント(学年フィルタで指定)
- [ ] `lib/api/*` wrapper 追加・既存 wrapper 改修
- [ ] `lib/types.ts`: Student から test_session_id を外し、StudentTestSessionAssignment 型を追加

### Phase B-2-3: UI 更新

- [ ] **学生登録/一覧**(students-list, student-registration): test_session_id 入力を削除、canonical 学生として登録
- [ ] **試験セッション作成画面**: 「受験者割当」セクションを新設
  - 学年・大学・学部・学科のフィルタ
  - 該当学生プレビュー(件数 + 一覧)
  - 「適用」ボタン → 一括 assignment レコード作成
  - 部屋割当: デフォルト空、CSV インポートまたは個別編集
- [ ] **既存画面の参照変更**: admin-dashboard / teacher-exam-tabs / patient-exam-tabs 等で students を参照していた箇所を assignments 経由に
- [ ] **attendance_records / exam_results** の student_id 参照整合性確認

### Phase B-2-4: クリーンアップ

- [ ] 旧フィールド(students.test_session_id 等)を残しているなら削除
- [ ] 旧 API 経路を整理
- [ ] HANDOVER.md / docs 更新

### 検証ステップ(各 Phase 末)

- 本番テストアカウント全 5 種で smoke test
- attendance_records / exam_results が正しく更新される
- /admin/dashboard の部屋別統計が変化しない(学生マスターのリンクが切れない)

---

## 6. Consequences

### 楽になること

- 学生は 1 度登録すれば永続(連絡先・学年などのメンテナンスが楽)
- 試験セッション作成時に **学年単位で一括割当**(数百人を 1 アクション)
- 学籍番号の一意性が DB で担保
- attendance_records / exam_results の参照先が明確に

### 難しくなること

- 既存データ移行の重複統合ルールを慎重に決める必要(誰の連絡先を採用するか)
- 部屋割当が学年フィルタと別軸になるため、UI で「どの部屋に何人」を明示する仕組みが要る
- assignments テーブルが空のセッションは「受験者未割当」として明示が必要

### 後で見直すかもしれない箇所

- 部屋割当のロジック(自動 round-robin / 手動 / CSV)
- 試験セッション間で学生情報が変わった場合のスナップショット保持(現行は最新値を反映、過去の試験記録はどう見せるか)
- assignment への transfer_in/out のような変更履歴(試験当日に部屋移動など)

---

## 7. Open Questions

1. **重複統合ルール**: 既存 students で同一 (university_code, student_id) の複数 row があった場合、どの row の email/name を採用するか? 最新 createdAt? 手動マージ?
2. **部屋割当**: 自動か手動か。手動なら CSV インポート対応?
3. **過去の試験記録の表示**: 既存 attendance_records / exam_results は現状の student_id で繋がっている。canonical 化後も同じ ID で参照できるようにすべき(つまり統合時に古い ID を引き継ぐ必要)
4. **試験当日の参加者追加・除外**: 試験開始後に学生を追加できるか(できる方向と思うが UX を要相談)

---

## 8. References

- ADR-001 — UI/UX 再設計の上位 ADR
- ADR-002 — Phase 9c データ取得層 API 集約
- ADR-003 — Phase 9 RLS 有効化
- `scripts/211_add_grade_to_students.sql` — Phase 9 B-1(学年カラム追加、本 ADR の前段)
- `students` / `attendance_records` / `exam_results` テーブル現行スキーマ
