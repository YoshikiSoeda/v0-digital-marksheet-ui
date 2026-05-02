# ADR-002: Phase 9c データ取得層の API 集約と `lib/data-storage.ts` 廃止

**Status:** Accepted
**Date:** 2026-05-02
**Decided:** 2026-05-02(soeda@ediand.co.jp による承認)
**Deciders:** soeda@ediand.co.jp(プロダクトオーナー)/ Claude(設計補助)
**関連:** ADR-001 §6 Phase 9c Action Items / Phase 9 RLS

---

## 1. Context

### 1.1 なぜ今これを決めるか

ADR-001 で確定した UI/UX 再設計の Phase 9c に着手する前段。「**データ取得層を `/api/*` に一本化**」は ADR-001 の Action Item に含まれているが、その内部設計(エンドポイント命名、認可ポリシー、フロント側 wrapper の形)はまだ未定。Phase 9 で **Row Level Security (RLS) を有効化** する直前の最大のリファクタになるため、ここで一度立ち止まって設計判断を残す。

### 1.2 現状調査(2026-05-02 時点)

`lib/data-storage.ts`(923 行)— UI から呼ばれる read / write 関数群。

| リソース | read 関数 | read 経路 | write 関数 | write 経路 |
|---|---|---|---|---|
| `test_sessions` | `loadTestSessions` | **anon SELECT** | (universities API 内) | service role |
| `subjects` | `loadSubjects` | **anon SELECT** | `saveSubjects` | **anon UPSERT** |
| `students` | `loadStudents` | **anon SELECT** | `saveStudents` | **anon UPSERT** |
| `teachers` | `loadTeachers` | **anon SELECT** | `saveTeachers` | `/api/admin/register-teachers` ✅ |
| `patients` | `loadPatients` | **anon SELECT** | `savePatients` | `/api/admin/register-patients` ✅ |
| `rooms` | `loadRooms` | **anon SELECT** | `saveRooms` | **anon UPSERT** |
| `tests` | `loadTests` | **anon SELECT** | `saveTests`、`deleteTest` | **anon UPSERT/DELETE** |
| `attendance_records` | `loadAttendanceRecords` | **anon SELECT** | `saveAttendanceRecords` | **anon UPSERT** |
| `exam_results` (evaluation) | `loadEvaluationResults` | **anon SELECT** | `saveEvaluationResults` | **anon UPSERT** |

**read は 9 リソース全てが anon、write は 7 リソースが anon**(teacher / patient だけ Phase 8c で migration 済み)。

既存 `/api/*` ルート(15 個):
- `/api/auth/{login,logout,me,reset-password}` — 認証
- `/api/admin/register-{teachers,patients}` — 部分書込
- `/api/universities`、`/api/universities/[id]`、`/api/universities/bulk` — 大学
- `/api/subjects`、`/api/subjects/[id]` — 教科
- `/api/test-sessions`、`/api/test-sessions/[id]` — セッション

### 1.3 制約

- **Supabase の anon key で直接 SELECT/UPSERT している現状で RLS を有効化すると、すべての UI が空データになる**(または書込が失敗する)。これが Supabase advisor の ERROR 16 件の本質。
- フロント側コンポーネントは React 19 の Client Component が中心。Server Components 化は Phase 9d で別途検討(ADR-001 §7-4 Open)。
- 利用ユーザーは少数(試用フェーズ)なので、ある程度の段階移行で並走させても許容できる。
- データ量は中規模(students 350 件、teachers 50 件、test_sessions 数十件)、API ラウンドトリップが UX を著しく劣化させる規模ではない。

---

## 2. Decision

### 2.1 結論

**Option A: REST per-resource API + `lib/api/<resource>.ts` 型付き wrapper** を採用する。

- 各リソースに `app/api/<resource>/route.ts`(リスト + 作成)と `app/api/<resource>/[id]/route.ts`(単体取得 + 更新 + 削除)を作る
- フロントは `lib/api/<resource>.ts` の型付き関数を import して使う(`fetch` 直叩きは禁止)
- リクエスト/レスポンスは **camelCase の TS 型** に統一(snake_case → camelCase 変換は API ルート内で実施)
- 認可は middleware の Cookie ベース 401 ガード + 必要に応じて API ルート内で `requireAdmin`(ADR-001 で確立済み)

### 2.2 採用理由(短く)

1. **既存設計の延長線** — Phase 7/8 で `/api/universities`、`/api/test-sessions` 等が既に REST per-resource 形。同じパターンの拡張で済む
2. **段階移行が可能** — リソース単位で 1 PR ずつ migration できる
3. **lib/api/ wrapper で UI の可読性が向上** — `loadStudents()` を `listStudents()` に置換するだけで型は明示的、副作用も明確
4. **Server Components とも親和的** — RSC 化を進めても fetch wrapper は server-side でも使える

---

## 3. Options Considered

### Option A: REST per-resource(推奨・採用)

| Dimension | Assessment |
|---|---|
| 複雑度 | Medium |
| 工数 | 5〜6 PR(1〜2 セッション) |
| 互換性 | 既存の universities/test-sessions/subjects の延長 |
| 段階移行 | ◎ リソース単位で進められる |
| Server Components 親和 | ○ |

**内容**:
- `app/api/<resource>/route.ts` で list + create
- `app/api/<resource>/[id]/route.ts` で get + update + delete
- `lib/api/<resource>.ts` で型付き fetch wrapper(`listStudents` / `getStudent` / `createStudent` / `updateStudent` / `deleteStudent`)
- middleware は無変更(全 `/api/*` が Cookie 必須)

**Pros**:
- リソース単位で粒度が細かく、レビューも実装も並列化可能
- 既存の universities/test-sessions と同形なので学習コスト 0
- Phase 9d で Server Components 化する場合も同じ wrapper を server-side で呼べる

**Cons**:
- 似たコード(認可チェック、camelCase 変換)が各 route に散る → 共通化が必要
- ファイル数が増える(11 リソース × 2 = 22 route files)

### Option B: 単一 `/api/data` エンドポイント(GraphQL 風)

| Dimension | Assessment |
|---|---|
| 複雑度 | High |
| 工数 | 大(設計から再考) |
| 互換性 | 既存パターンと不整合 |
| 段階移行 | × all-or-nothing |

**内容**:
- 単一の `/api/data` ルートで `{ resource: "students", op: "list", filters: {...} }` を受ける
- フロントは `data("students").list({ ... })` のような統一インターフェース

**Pros**:
- ファイル数が少ない、共通処理が一箇所に集まる
- TypeScript 型定義が一元化しやすい

**Cons**:
- 既存の `/api/universities` 等と不整合(全部書き直し)
- middleware や認可の細粒度制御がしづらい
- HTTP キャッシング・観測性が低下(URL でリソースを区別できない)
- Phase 9d で URL 再編する際、データ取得 URL が見えないため SSR/RSC 設計が複雑化

### Option C: Next.js Server Actions 中心

| Dimension | Assessment |
|---|---|
| 複雑度 | Medium-High |
| 工数 | 中(Client Component の useState 連動の書き直しが多い) |
| 互換性 | 既存の REST と二重化 |
| 段階移行 | △ Client から呼ぶ場合 form 経由 or "use server" |

**内容**:
- `'use server'` 関数で直接 DB アクセス
- フロントは `await listStudents()` を Client Component から呼ぶ(or form action)

**Pros**:
- API レイヤがコードレベルで透明、型がエンドツーエンドで連結
- Server Components / Client Components 間の橋渡しが自然
- Next.js 16 の標準パターン(将来性◎)

**Cons**:
- 既存の `/api/auth/*` や `/api/admin/register-*` と二重化(REST + Server Actions の両方を維持する羽目になる)
- Phase 9 RLS 対応のためのリファクタとしては、設計変更の幅が大きすぎる
- Client Component で Server Action を多用すると、loading/error UX を都度実装する必要がある
- 認可は依然 Cookie ベースで middleware を通すか、Server Action 内で再チェックが必要

---

## 4. Trade-off Analysis

| 観点 | A(推奨) | B | C |
|---|:-:|:-:|:-:|
| 既存パターン継続 | ◎ | × | △ |
| 学習コスト | ◎ | × | △ |
| 段階移行 | ◎ | × | △ |
| 共通化(認可・camelCase) | ○ | ◎ | ◎ |
| Server Components 移行性 | ○ | △ | ◎ |
| HTTP キャッシュ・観測性 | ◎ | × | △ |
| ファイル数 | △(多い) | ◎ | ◎ |
| Phase 9 RLS 適用 | ◎ | ◎ | ◎ |

A のファイル数増加は `lib/api/_shared.ts`(認可チェック + camelCase 変換ヘルパ)で軽減できる。Server Components 親和性は B/C の方が高いが、Phase 9d で必要に応じて wrapper を server-side で呼ぶだけで対応可能なので致命的ではない。

---

## 5. API 設計詳細

### 5.1 命名規約

```
app/api/<resource>/route.ts            ← GET (list), POST (create)
app/api/<resource>/[id]/route.ts       ← GET (get), PUT (update), DELETE (delete)
app/api/<resource>/bulk/route.ts       ← POST (bulk create), 必要に応じて(students/teachers/patients は CSV インポート用に追加)
```

リソース名は **複数形・kebab-case**: `teachers`、`students`、`patients`、`rooms`、`tests`、`attendance-records`、`evaluation-results`。

### 5.2 リクエスト / レスポンス形

すべて JSON。**フロントとの I/F は camelCase**:

```ts
// GET /api/students?universityCode=dentshowa&subjectCode=os&testSessionId=xxx
// → 200 { items: Student[] }

// POST /api/students
// Body: { name, studentId, universityCode, ... }
// → 201 { item: Student }

// GET /api/students/[id]
// → 200 { item: Student }
// → 404 { error: "Not found" }

// PUT /api/students/[id]
// Body: Partial<Student>
// → 200 { item: Student }

// DELETE /api/students/[id]
// → 204 (no body)
```

エラー形は既存 `/api/auth/*` に揃える: `{ error: string }` + 適切な status。

### 5.3 認可

- middleware が Cookie の存在確認(401 if missing)
- 各 route ハンドラで必要に応じて `requireAdmin(request)` を呼ぶ(ADR-001 §F5、Phase 7 で確立)
- 削除系・大量登録系は `requireAdmin` 必須
- リソース所有者制限(例: 大学 X の admin は大学 Y のデータを更新できない)は **Phase 9 RLS の policy 側で担保** する。API 側は Cookie の universityCode を読み取ってクエリに渡すだけ

### 5.4 lib/api/ の wrapper 形

```ts
// lib/api/students.ts
import type { Student } from "@/lib/types/student"

export interface ListStudentsParams {
  universityCode?: string
  subjectCode?: string
  testSessionId?: string
}

export async function listStudents(params: ListStudentsParams = {}): Promise<Student[]> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][]
  )
  const res = await fetch(`/api/students${qs.toString() ? `?${qs}` : ""}`, {
    credentials: "same-origin",
  })
  if (!res.ok) throw new Error(`listStudents failed: ${res.status}`)
  const json = await res.json()
  return json.items as Student[]
}

export async function createStudent(data: Omit<Student, "id" | "createdAt">): Promise<Student> {
  const res = await fetch("/api/students", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `createStudent failed: ${res.status}`)
  }
  const json = await res.json()
  return json.item as Student
}

// updateStudent / deleteStudent も同パターン
```

### 5.5 共通ヘルパ(`lib/api/_shared.ts`)

```ts
// API ルート側の共通ユーティリティ:
// - Supabase service role client の lazy init
// - snake_case row → camelCase Type の変換(zod-like 軽量バージョン)
// - 共通エラーレスポンス
```

### 5.6 既存の `loadXxx`/`saveXxx` の扱い

- 段階移行のため、`lib/data-storage.ts` 内で `loadXxx`/`saveXxx` を **ラッパとして残置**(内部で新 wrapper を呼ぶ)
- UI 側コンポーネントを順次 `lib/api/*` に書き換えていき、最後に `lib/data-storage.ts` から関数を削除
- types(`Student`、`Teacher` 等)は `lib/types/<resource>.ts` に切り出して `lib/data-storage.ts` から re-export(後方互換)

---

## 6. Consequences

### 楽になること
- **Phase 9 RLS 有効化が可能になる** — anon SELECT が消えるため、policy で行レベル制御が効く
- snake_case ↔ camelCase 変換コードが UI から消える(各画面で都度実装されていた)
- 認可ロジックが middleware + API route に集約 → UI 側で意識不要
- 型エンドツーエンド: `lib/api/students.listStudents()` の戻り値が `Student[]` で確定

### 難しくなること
- API のエンドポイント数増加(11 リソース × 2-3 route = 22-33 ファイル)
- 既存 UI の loadXxx 呼び出しを wrapper 経由に書換 → 9c-3 が大型 PR になる
- Server Components 化(9d 以降)した場合、`lib/api/*` の同一関数を server-side でも呼ぶには `fetch` の絶対 URL 化や server-only fetcher 分離が必要

### 後で見直すかもしれない箇所
- lib/api/ wrapper を **TanStack Query** などのキャッシュ層に乗せ替えるかどうか(現状は素の fetch、9d 以降で検討)
- bulk import ルート(students/teachers/patients の CSV 取込)を専用エンドポイントにするか、`POST /api/students` の配列 body で済ませるか
- 削除系の論理削除化(`deleted_at` カラム追加)— 本 ADR では物理削除のまま

---

## 7. Action Items(Phase 9c の段取り)

### 9c-1: read API 第 1 弾(teachers / patients / students)
- [ ] `app/api/teachers/route.ts` (GET) + `app/api/teachers/[id]/route.ts` (GET)
- [ ] `app/api/patients/route.ts` (GET) + `app/api/patients/[id]/route.ts` (GET)
- [ ] `app/api/students/route.ts` (GET) + `app/api/students/[id]/route.ts` (GET)
- [ ] `lib/api/teachers.ts`、`lib/api/patients.ts`、`lib/api/students.ts` wrapper
- [ ] `lib/api/_shared.ts` に共通ヘルパ(supabase service role、camelCase 変換)
- [ ] `lib/data-storage.ts` の `loadTeachers/Patients/Students` を内部で wrapper を呼ぶ形に

### 9c-2: read API 第 2 弾(rooms / tests / attendance / evaluation)
- [ ] `app/api/rooms/route.ts` + `[id]/route.ts`(GET のみ、まず)
- [ ] `app/api/tests/route.ts` + `[id]/route.ts`
- [ ] `app/api/attendance-records/route.ts` + `[id]/route.ts`
- [ ] `app/api/evaluation-results/route.ts` + `[id]/route.ts`
- [ ] 対応する `lib/api/*.ts`
- [ ] `lib/data-storage.ts` の load 系を全て新経路に切替

### 9c-3: UI を `lib/data-storage` 経由から `lib/api/*` 直接呼び出しに切替
- [ ] admin-dashboard.tsx(中心)
- [ ] test-selection-screen / teacher-exam-tabs / patient-exam-tabs
- [ ] 各 admin/* ページ
- [ ] 各 components/*-registration、room-management、subject-management、question-*

### 9c-4: write API(students / rooms / tests / attendance / evaluation / subjects)
- [ ] POST/PUT/DELETE エンドポイントを各リソースに追加
- [ ] CSV bulk インポート用の bulk エンドポイント(必要なら)
- [ ] `lib/api/*.ts` の create/update/delete 関数
- [ ] UI 側の `saveXxx` 呼び出しを wrapper 経由に置換

### 9c-5: `lib/data-storage.ts` 削除 + 型ファイル切り出し
- [ ] `lib/types/<resource>.ts` に Student / Teacher / Patient / Room / Test / Subject / TestSession / AttendanceRecord / EvaluationResult / Question 等を移動
- [ ] `lib/data-storage.ts` を削除(または re-export のみのスタブに)
- [ ] grep で残存呼び出しが 0 件であることを確認

### 9c-6: Phase 9 RLS 有効化(別 ADR-003 で扱う候補)
- 13 テーブルに RLS ENABLE
- 各テーブルに universityCode / role に基づく SELECT/INSERT/UPDATE/DELETE policy を定義
- Supabase advisor で ERROR 0 件達成
- registration forms の平文保存問題(ADR-001 §1.2.F5)もこの段階で完全解消

### 検証ステップ(各 sub-PR 末で必須)
- [ ] `tsc --noEmit` rc=0
- [ ] 本番テストアカウント(admin/uni/kyouka/ippan/kanjya)で smoke test
- [ ] 該当画面で データ表示・登録・更新・削除が回帰なく動作

---

## 8. Open Questions(レビュー時に意思決定が必要)

1. **bulk import 経路の API 設計**: students/teachers/patients の CSV インポートを `/api/<resource>/bulk` の専用エンドポイントにするか、`POST /api/<resource>` を配列 body 対応にするか
2. **論理削除の導入**: tests/students 等で論理削除(`deleted_at`)を導入するか、物理削除を維持するか
3. **API キャッシュ戦略**: 当面は素の fetch、必要になれば TanStack Query などを入れるか
4. **Phase 9 RLS の policy 細粒度**: row owner ベース vs role-based(university scope)— ADR-003 で扱う

---

## 9. References

- ADR-001 — UI/UX 再設計の上位 ADR(Phase 9c は §6 Action Items の Phase 9c に対応)
- `lib/data-storage.ts` — 段階廃止対象
- 既存 `/api/universities`、`/api/test-sessions`、`/api/subjects` — REST per-resource パターンの先行例
- Supabase RLS ドキュメント(Phase 9 で参照予定)
