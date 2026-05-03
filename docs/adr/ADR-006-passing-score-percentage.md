# ADR-006: 合格判定を `passing_score` の % 運用に統一

**Status:** Accepted
**Date:** 2026-05-03
**Decided:** 2026-05-03(soeda@ediand.co.jp による承認)
**Deciders:** soeda@ediand.co.jp(プロダクトオーナー)/ Claude(設計補助)
**関連:** ADR-005 F6(本 ADR を起票するきっかけ)

---

## 1. Context

### 1.1 現状の挙動(2026-05-03 通しテストで発見)

`test_sessions.passing_score` は **絶対点** として保存・判定されている。例:

- EDIAND 予備試験 2026-05-10:`passing_score = 70`
- 学生1 の評価結果: 教員 13/15 (86.7%) + 患者 9/10 (90%) = **合計 22 点**
- 22 < 70 → 「不合格」と表示

学生1 は実質「合格相当の好成績」だが、**閾値の絶対点(70)を評価上限(25)と整合させていなかった**ため不合格扱いになる。

### 1.2 関連するコード

`app/admin/students-detail/page.tsx`(L107-114):

```ts
const passingScore = currentSession?.passing_score
let passResult: "合格" | "不合格" | "" = ""
if (passingScore != null && passingScore > 0 && completedEvaluations.length > 0) {
  passResult = combinedScore >= passingScore ? "合格" : "不合格"
}
```

`combinedScore = teacherScore + patientScore`(両者の絶対点合計)。`passingScore` も絶対点として比較。

`components/admin-dashboard.tsx` も同様に `passing_score` を絶対点として扱っている(部屋カードの「合格」表示)。

### 1.3 設計上の問題

評価項目数は試験ごとに異なる(例: 教員 3 設問 / 患者 2 設問の通しテスト vs 既存の 教員 30 設問 / 患者 10 設問の本番試験)。**設問数を変更するたびに `passing_score` を再計算して入れ直す運用** は事故の温床になる。

また現行運用では `passing_score = 70` がよく使われており、これは「70%」の意図で入力されていることが推察される(評価上限が 100 点を超える試験は実態として存在しない)。**運用上の意図と実装が乖離している**。

---

## 2. Decision

### 2.1 結論

**Option A: `passing_score` を 0–100 の % として再解釈する** を採用する。

判定式:

```ts
const maxPossible = teacherMaxScore + patientMaxScore  // 各 evaluation_results.max_score の合計
const passResult =
  passingScore != null && passingScore > 0 && completedEvaluations.length > 0
    ? (combinedScore / maxPossible) * 100 >= passingScore ? "合格" : "不合格"
    : ""
```

- DB 列 `passing_score` の意味は **「合格 % しきい値(0–100)」** に変更
- DB スキーマの型変更は不要(integer 0–100 で運用)
- UI 表記を「合格ライン 70 点」→「合格ライン 70%」に変更

### 2.2 採用理由

- 設問数の増減に依存しないため運用負担が軽い
- 既存運用の意図(`passing_score = 70` の多くは「70%」のつもり)と一致
- 大学・試験ごとに合格基準を独立して設定でき、複数大学運用に親和的
- (注: 評価上限を表す max_score は現状 DB に保存されていないため、後続 PR で `exam_results.max_score` を追加する必要あり — §4.0 参照)

### 2.3 教員/患者の合算 vs 別々判定(本 ADR §1 の Open Question 解消)

**結論: 合算スコアで判定する**(現行 UI の `combinedScore` を踏襲)。

理由:
- OSCE は「医療面接全体の能力」を評価するもので、教員視点と患者視点の **総合判定** が運用上自然
- 別々判定にすると「教員側だけ合格・患者側だけ不合格」のような中途半端ステータスが UI に増え、認知負荷が上がる
- 将来的に「ロール別合格ライン」が必要になった場合は ADR-006-1 として別途切り出す

ただし UI には **教員側スコア・患者側スコアを併記** し、運用者が個別に確認できる状態は維持(現行の「教員 13 点 / 患者 9 点」表示はそのまま)。

---

## 3. Options Considered

### Option A: % 運用(推奨・採用)

| Dimension | Assessment |
|---|---|
| 複雑度 | Low(判定式 1 箇所 + UI 表記) |
| DB 変更 | なし |
| 運用負担 | ◎(設問数変更で再設定不要) |
| 既存運用との整合 | ◎(`passing_score=70` の意図と一致) |
| 移行リスク | 低(全 test_session が 0–100 の値を持つことを確認) |

### Option B: 絶対点運用を維持し、設問追加時に管理画面で警告

| Dimension | Assessment |
|---|---|
| 複雑度 | Medium(設問追加時のフック + 警告 UI) |
| 運用負担 | ×(設問数変更で都度再設定) |
| 直感性 | ×(設問数を意識しないと正しく入力できない) |

### Option C: role_type ごとの別 `passing_score`(教員/患者別判定)

| Dimension | Assessment |
|---|---|
| 複雑度 | High(DB 列追加 + UI 大幅変更) |
| 運用負担 | △(基準が 2 倍に) |
| 試用フェーズへの適合 | ×(過剰スコープ) |

A 以外を選ぶ理由は現状ない。

---

## 4. 実装詳細

### 4.0 重要事実:`exam_results.max_score` カラムが存在しない

実装着手前に確認したところ、`exam_results` テーブルに `max_score`(評価上限点)を保存するカラムが **存在しない**。`total_score`(獲得点合計)のみ保存されている。

そのため、% 判定には max を別経路で得る必要がある。3 つの実装案:

| 案 | 内容 | Pros | Cons |
|---|---|---|---|
| **A1** | `exam_results` に `max_score` カラムを追加し、評価保存時(`/api/evaluation-results` POST)に計算して保存 | 集計が高速、後方互換も既存行は NULL → フォールバック | DDL マイグレーション必要 |
| **A2** | tests/sheets/categories/questions を JOIN して動的算出(設問数 × 5)| DB 変更不要 | 集計が重い(テストごとに JOIN)、option1-5 の最大値が常に 5 という前提に依存 |
| **A3** | `tests` テーブルに `max_score` 列を追加(test 単位で算出済の値を保持) | 集計軽量、test ごと一意に決まる | DDL マイグレーション必要、設問追加時に再計算トリガー必要 |

**推奨: A1**(評価結果に max を持たせる方が変動要因を吸収しやすい)。実装は Phase R-2-F6 で別 PR。

### 4.1 判定式の置換箇所(A1 採用時)

#### `app/admin/students-detail/page.tsx`(getStudentData)

```ts
// 旧
passResult = combinedScore >= passingScore ? "合格" : "不合格"

// 新(% 判定)
const teacherMax = teacherEvals.reduce((sum, e) => sum + (e.maxScore || 0), 0)
const patientMax = patientEvals.reduce((sum, e) => sum + (e.maxScore || 0), 0)
const combinedMax = teacherMax + patientMax
if (combinedMax > 0) {
  const pct = (combinedScore / combinedMax) * 100
  passResult = pct >= passingScore ? "合格" : "不合格"
}
```

#### `components/admin-dashboard.tsx`(部屋カードの 合格 表示)

同様のロジックを適用。集計箇所が 3 箇所(L362-374 / L571-583 / L1040-1048)あるため、共通関数 `lib/passing.ts` に切り出すのが望ましい。

### 4.2 UI 表記の変更

- exam-session-banner: 「合格ライン 70 点」→「合格ライン 70%」
- 試験セッション作成・編集 UI: 入力欄ラベルを「合格点(0-100)」→「合格ライン %(0-100)」+ プレースホルダ「例: 70」
- 入力バリデーションを 0-100 に制約

### 4.3 DB データの整合性確認

既存の `test_sessions.passing_score` の値分布を確認し、想定通り 0-100 に収まっていればコード変更のみで OK。100 を超える行があれば移行 SQL で % 変換が必要。

```sql
SELECT id, description, passing_score
FROM test_sessions
WHERE passing_score > 100 OR passing_score < 0;
```

---

## 5. Action Items

### Phase R-2-F6-0: スキーマ前提整備(別 PR)

- [ ] `scripts/214_add_max_score_to_exam_results.sql`: `exam_results.max_score INTEGER` を NULL 許容で追加(scripts/213 は ADR-004 Phase B-2-1 で先取済み)
- [ ] `app/api/evaluation-results/route.ts`(POST/upsert)で評価保存時に max_score を計算して保存
  - 計算式: 当該 test_id の questions 数 × 5(5 段階評価固定の前提)
- [ ] 既存行は max_score = NULL のまま(過去データの遡及更新は ADR-006-bk のスコープ外)

### Phase R-2-F6-1: コード修正(別 PR)

- [ ] `lib/passing.ts` を新設し、`computePassResult({ teacherEvals, patientEvals, passingScore })` を提供
- [ ] `app/admin/students-detail/page.tsx` の `getStudentData` で `lib/passing.ts` を利用
- [ ] `components/admin-dashboard.tsx` の合格判定 3 箇所も同様に修正
- [ ] `components/exam-session-banner.tsx` の表記を「点」→「%」に
- [ ] 試験セッション作成・編集 UI の input ラベル・バリデーション更新

### Phase R-2-F6-2: 既存データ確認(別作業)

- [ ] §4.3 の SQL を実行し、100 超の行があればユーザー確認の上で % 換算 or NULL 化

### Phase R-2-F6-3: 通しテスト再実施

- [ ] EDIAND 予備試験 2026-05-10 で学生1 が「合格」表示になることを確認(max_score を 25 に設定後)
- [ ] 教員/患者を別個に確認できる UI が壊れていないこと
- [ ] max_score = NULL のレガシー行は「合格判定スキップ」表示になり、既存 UI が壊れないこと

---

## 6. Consequences

### 楽になること
- 設問追加・削除のたびに `passing_score` を再計算する運用が不要に
- UI 表記が「%」で直感的になる
- 大学・試験ごとに独立した合格基準を設定でき、複数大学運用と親和

### 注意すること
- 既存ユーザーが `passing_score=70` を「70 点」のつもりで入れていた場合でも、運用上の意図(70%)と一致するため実害は少ないと想定。ただし大学責任者には「% 化した」旨を周知する必要あり
- evaluation_results.max_score の集計に依存するため、max_score が NULL のレガシー行があると判定が壊れる(§4.1 の `combinedMax > 0` ガードでフォールバック)

### 後で見直すかもしれない箇所
- ロール別判定(教員 70% かつ 患者 70%)が必要になった場合は ADR-006-1 を切り出す
- 「合格者」だけでなく「要再試験」「要面談」などの中間ステータス導入

---

## 7. References

- ADR-005 F6 — 本 ADR の起票理由
- `app/admin/students-detail/page.tsx` — 主要修正箇所
- `components/admin-dashboard.tsx` — 部屋別カードの合格判定
- `components/exam-session-banner.tsx` — UI 表記
