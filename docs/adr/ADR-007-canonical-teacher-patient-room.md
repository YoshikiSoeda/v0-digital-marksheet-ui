# ADR-007: 教員・患者役・部屋の canonical 化と試験セッション割当の junction 化

**Status:** Proposed
**Date:** 2026-05-04(Proposed)
**Deciders:** soeda@ediand.co.jp(プロダクトオーナー)/ Claude(設計補助)
**関連:** ADR-004(学生 canonical 化、Accepted) / ADR-005 §F4(本問題の根本原因認知) / Phase 9 RLS / B-2-d(過去学生から bulk assign)

---

## 1. Context

### 1.1 ユーザー要望(2026-05-04)

> アカウント登録で学生・先生それぞれ登録する際に、試験セッションを決めてしまうと操作が煩雑になります。
> 試験セッションを作る際に、教員・学生・患者、誰を紐付けるかを設定できるようにした方がよいです。
> 同じ学生・教員・患者が色んな試験セッションをこなすので、アカウントのマスターは試験ごとに入れるのは大変。
>
> 試験ごとに可変する内容は「部屋」「教科」のみだと思います。
> 部屋マスターも試験で流用されるはずなので、試験セッション作成時にそれぞれ割り当てる形に。

### 1.2 現状の問題

`teachers` / `patients` / `rooms` テーブルには `test_session_id NOT NULL` 列があり、各エンティティが特定の試験セッションに 1:1 で紐付く設計。

```
teachers (
  id uuid PK,
  email, name, password, role, account_type, subject_code,
  assigned_room_number text,
  university_code text,
  test_session_id uuid NOT NULL,   ← session 紐付け
  ...
)
```

問題点:

1. **同じ教員/患者役/部屋が複数試験で使われると、レコードが重複** する(同じ email × 別 test_session で N 行)
2. 連絡先・パスワード等のマスターメンテが session 単位で分散
3. 試験セッションを新しく作るたびに、関係者全員を再登録する必要(数十~数百件のチキン&エッグ)
4. 2026-05-04 に発覚した:admin が登録ページに来ても sessionStorage に testSessionId がないため、空文字 → NULL → INSERT NOT NULL 違反で失敗(PR #70 で UI 上に試験セッション選択を必須化したが、そもそもこの紐付け自体が設計負債)

### 1.3 既に適用済の関連改修

- **ADR-004 + Phase B-2-c**(students):2026-05-02 ~ 2026-05-04 で **canonical + junction 化完了**
  - `students.test_session_id` は NULLABLE 化、application 層から読まない・書かない
  - `student_test_session_assignments` 経由で session 紐付け
  - 残るは PR3(DROP COLUMN、本番安定後)のみ
- **B-2-d**:過去学生から bulk assign する UX を /admin/register-students に「過去学生から登録」タブとして実装済み

本 ADR は、この **canonical + junction パターンを teachers / patients / rooms にも適用** することで、students と同等のメンテ性・UX を実現する。

### 1.4 制約

- 既存データ:本番に dentshowa(5/5/25)/ kanagawadent(空)/ ediand(seed)が稼働中
- attendance_records / exam_results は teacher email / patient email / room_number / student UUID で参照しており、canonical 化しても破壊しない
- B-2-* シリーズで重複削除 + canonical 化のレシピは既に確立(再現できる)

---

## 2. Decision

`teachers` / `patients` / `rooms` を canonical 化し、試験セッションへの割当を junction で表現する。

### 2.1 採用案: 案 B(rooms は junction を持たない)

**部屋自体に test_session_id 紐付けは持たせない**。「この試験で使う部屋」は、その試験の各 assignment(教員/患者役/学生)が指している `assigned_room_number` の集合として暗黙的に決まる。

理由:
- 部屋は「人」と違って独立した割当が不要(誰も使わない部屋を別途登録する意味がない)
- junction を 1 つ減らせる(複雑度減)
- 試験セッション編集画面で「部屋を選ぶ」UI は、教員/患者役/学生の配置 UI と統合できる(Step 2 で部屋を絞り、Step 3-5 でその部屋に人を割り当て)

### 2.2 新データモデル

#### canonical(マスター)

```sql
-- teachers: (university_code, email) で UNIQUE
ALTER TABLE teachers ADD CONSTRAINT teachers_canonical_unique UNIQUE (university_code, email);
ALTER TABLE teachers DROP COLUMN test_session_id;          -- 段階的に
ALTER TABLE teachers DROP COLUMN assigned_room_number;     -- session 別の部屋なので junction に移動

-- patients: 同上
ALTER TABLE patients ADD CONSTRAINT patients_canonical_unique UNIQUE (university_code, email);
ALTER TABLE patients DROP COLUMN test_session_id;
ALTER TABLE patients DROP COLUMN assigned_room_number;

-- rooms: (university_code, room_number) で UNIQUE
ALTER TABLE rooms ADD CONSTRAINT rooms_canonical_unique UNIQUE (university_code, room_number);
ALTER TABLE rooms DROP COLUMN test_session_id;
ALTER TABLE rooms DROP COLUMN subject_code;                -- 教科は session 側で持つ
```

#### junction

```sql
CREATE TABLE teacher_test_session_assignments (
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  test_session_id uuid REFERENCES test_sessions(id) ON DELETE CASCADE,
  assigned_room_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (teacher_id, test_session_id)
);

CREATE TABLE patient_test_session_assignments (
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  test_session_id uuid REFERENCES test_sessions(id) ON DELETE CASCADE,
  assigned_room_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (patient_id, test_session_id)
);

-- student_test_session_assignments は B-2-c で既に存在
```

注:`assigned_room_number` は teachers/patients も `room_number` として junction に持つ(session ごとに違う部屋を指す可能性がある)。

### 2.3 UI 変更(ウィザード型)

#### マスター登録ページ — 大幅シンプル化

| 画面 | 変更内容 |
|---|---|
| `/admin/register-teachers` | 試験セッション選択 **削除**(canonical で 1 件登録)、部屋割当 **削除** |
| `/admin/register-patients` | 同上 |
| `/admin/register-students` | 同上(B-2-d で部分対応済、test_session の選択 UI は「過去学生から登録」タブのみで使用) |
| `/admin/room-management` | 試験セッション選択 **削除**(部屋マスター登録のみ) |

#### 試験セッション作成/編集 — 5 step ウィザード

```
[Step 1] 基本情報
  名称 / 日付 / 教科 / 合格ライン %(0-100) / 制限時間

[Step 2] 使用する部屋を選ぶ
  部屋マスターからチェックボックスで選択
  ☑ S101 第1試験室
  ☑ S102 第2試験室
  ☐ S103 第3試験室
  ☑ S104 第4試験室
  ☑ S105 第5試験室

[Step 3] 教員を配置(Step 2 で選んだ部屋ごと)
  S101 → [showa-t1@example.com 田中先生 ▼] (新規追加…)
  S102 → [showa-t2@example.com 佐藤先生 ▼]
  S104 → [showa-t3@example.com 鈴木先生 ▼]
  S105 → [showa-t4@example.com 高橋先生 ▼]

[Step 4] 患者役を配置(Step 2 で選んだ部屋ごと)
  S101 → [showa-p1@example.com 患者A ▼]
  ...

[Step 5] 学生を配置
  ☑ 一括: 5年生・歯学部 25 名 → ランダム配置(部屋ごとに 5 名)
  ↓ 詳細指定(B-2-d UI 流用)
  S101: [SH001..SH005] (5名)
  S102: [SH006..SH010] (5名)
  ...

[作成 / 保存]
```

各 Step は前 Step 完了時のみ有効化(progressive disclosure)。

---

## 3. Migration Plan

ADR-004 の B-2-* と同じ段階パターン(read 切替 → write 切替 → DROP COLUMN)を踏襲。**6 つの Phase に分けて段階実装**。

### Phase C-1: junction テーブル作成 + データ統合

```
scripts/223_canonical_teacher_unique_and_assignments.sql
scripts/224_canonical_patient_unique_and_assignments.sql
scripts/225_canonical_room_unique.sql
```

内容:
- 同一 (university_code, email) の teachers / patients が複数行ある場合、最も新しい row を残し他を削除
- 同様に rooms も (university_code, room_number) で重複排除
- `(university_code, email)` UNIQUE 制約追加
- junction テーブル新設(`teacher_test_session_assignments` / `patient_test_session_assignments`)
- 既存 `teachers.test_session_id` / `patients.test_session_id` から junction に backfill
- 既存 `teachers.assigned_room_number` / `patients.assigned_room_number` も junction の `assigned_room_number` に移行

破壊性:中(重複統合あり)。本番反映前に重複行のレポートを取り、ユーザー確認後に実行。

### Phase C-2: API / UI を read 経路で junction 経由に切替

- `/api/teachers` GET:`testSessionId` フィルタ時は assignments JOIN
- `/api/patients` GET:同上
- `/api/rooms` GET:`testSessionId` フィルタ時はその session の各 assignment が指している部屋を集約
- `lib/data-storage.ts` の `loadTeachers` / `loadPatients` / `loadRooms` のシグネチャは維持(後方互換)

破壊性:低。既存 UI は無改修で動く想定。

### Phase C-3: write 経路を canonical RPC に切替

- `register_teacher_canonical(univ, email, name, password, role, ...)`(students 同等品)
- `register_patient_canonical(...)`
- `register_room_canonical(...)` — シンプル(教科や session は無視)
- `assign_teacher_to_session(teacher_id, test_session_id, room_number)` 等の assign RPC 群
- 既存 `register_teachers_bulk` / `register_patients_bulk` は **canonical + assign を同時実行する変種** に置換

破壊性:低(RPC は CREATE OR REPLACE)。

### Phase C-4: マスター登録 UI から「試験セッション選択」を削除

- `/admin/register-teachers` の上部 amber Card を削除(ADR-007 で UI 不要に)
- `/admin/register-patients` 同上
- `/admin/register-students` の「過去学生から登録」タブは保持(これは試験セッション側に統合する Step 5 で再利用)
- `/admin/room-management` も session 選択 UI を削除

破壊性:中(UI 大改修)。

### Phase C-5: 試験セッション作成・編集ウィザード実装

- `/admin/test-sessions/new` または `/admin/question-management` 内の「試験新規作成」を 5 Step ウィザードに改修
- Step 2 (部屋選び) は新規 UI
- Step 3-4 (教員/患者役配置) は新規 UI
- Step 5 (学生配置) は B-2-d の UI を試験セッション側に移植
- 既存試験セッションの「編集」も同じウィザードで再現できるよう、「現在の割当を表示 + 変更」を実装

破壊性:中。実装規模は ADR-007 で最も大きい。

### Phase C-6: legacy 列を読まない・書かない

- application 層から `teachers.test_session_id` / `assigned_room_number` を一切参照しない(B-2-c PR1 相当)
- RPC INSERT から legacy 列除去(B-2-c PR2 相当)
- 列を NULLABLE 化(B-2-a 相当)

破壊性:低。

### Phase C-7: DROP COLUMN(本番 1-2 週間安定確認後)

- `teachers.test_session_id` / `teachers.assigned_room_number` を DROP
- `patients.test_session_id` / `patients.assigned_room_number` を DROP
- `rooms.test_session_id` / `rooms.subject_code` を DROP

破壊性:**高**(取り返しがつかない)。本番運用 1-2 週間後に実行。

---

## 4. Consequences

### 楽になること

- 教員・患者役・部屋を **1 度登録すれば永続**。連絡先・パスワード・名称のメンテが 1 箇所
- 試験セッション作成時に「**この試験で誰がどの部屋を担当する**」を 1 画面で完結(数十アクションが 1 アクションに)
- マスター画面の UX が劇的に簡素化(試験セッション選択不要)
- 同じ教員が複数試験を担当しても、ログイン情報は 1 つで済む
- attendance_records / exam_results は引き続き email / room_number / student UUID で参照(canonical 化しても破壊しない)

### 難しくなること

- 試験セッション編集画面の実装規模(ウィザード型 5 Step)
- 既存データ重複の統合ルール(同 email 複数 row のとき、どの row の name/password を採用するか)
- 過去の試験記録の整合性(canonical 統合で teacher.id が変わる場合、exam_results.evaluator_email で参照しているので影響軽微)
- 「同じ教員が同一試験中に 2 つの部屋を担当する」というレアケースは表現不可(junction PK が `(teacher_id, test_session_id)` のため)→ もしあるなら別途検討

### 後で見直すかもしれない箇所

- 試験セッション間で教員情報(名前・連絡先など)が変わった時のスナップショット保持(現行は最新値、過去試験は「当時の名前」を見せたいか?)
- 試験当日の参加者追加・除外(transfer_in/out の概念)
- 部屋・教員・患者役が試験中に変更されるユースケース(救急で教員交代等)

---

## 5. Open Questions

1. **重複統合ルール**: 既存 teachers / patients で同 (university_code, email) の複数 row が見つかった場合、どの row を採用?
   - 案: 最新 `created_at` の row を残し、他は削除前に既存 assignment を junction に逃がす
   - 統合スクリプトで「重複候補レポート」を生成 → ユーザー確認後に実行
2. **学生割当のデフォルト挙動**: 試験セッション作成時、Step 5 で「全学年・全教科の全員」を初期選択するか、空から始めるか?
3. **ウィザードと既存画面の関係**: ウィザードを別 route(`/admin/test-sessions/new`)にするか、既存 `/admin/question-management` 内の Dialog 拡張にするか?
4. **subject 別 scope の扱い**: subject_admin が試験セッションを作るとき、Step 3-5 の選択肢は自教科のみに絞るべき(B-2-d でも同様の判断あり)
5. **rooms から `subject_code` を外して大丈夫か?**: 部屋を「数学室」「臨床実習室」のように教科別に管理しているなら維持必要。canonical 化の方針として外したいが、ユーザー側のニーズ要確認。

---

## 6. Implementation Notes

- **B-2-* の教訓**: 各 Phase は別 PR で出して、その都度本番反映 + 動作確認をする
- **重複データチェック**: 本番 DB で `SELECT (university_code, email), COUNT(*) FROM teachers GROUP BY 1 HAVING COUNT(*) > 1` を事前に走らせ、件数を ADR-007 の Acceptance 条件にする
- **TypeScript 型**: `Database` 型を生成していないため、新 RPC 呼び出しは `as any` で逃げる(B-2-b の教訓)
- **本番 DB は Supabase MCP `apply_migration` / `execute_sql` で直接適用**、scripts/ には Git 履歴用にコミット(B-2-d で確立した運用)

---

## 7. References

- ADR-004 — 学生 canonical 化(本 ADR の前例) — Accepted
- ADR-005 — 通しテストでの発見事項(F4 で本問題を指摘)
- ADR-006 — passing_score % 統一
- B-2-c PR1 (#63) / PR2 (#64) — students canonical 化の read/write 切替
- B-2-d (#66) — 過去学生から bulk assign する UX(本 ADR の Step 5 で再利用予定)
- PR #70 — register-teachers/patients の test_session 必須化(暫定対処、ADR-007 で根本解消後は削除可)
- `scripts/213_add_student_test_session_assignments.sql` — 学生 junction テーブルの先例
- `scripts/220_register_student_canonical_drop_legacy_writes.sql` — RPC から legacy 列除去の先例
