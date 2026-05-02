# lib/api/

UI から呼び出す `/api/*` の薄い fetch wrapper を集約するディレクトリ。

## 目的(ADR-001 Phase 9c)

現状、データ取得には 2 経路が混在している:

1. `lib/data-storage.ts` の `loadXxx`/`saveXxx` — anon key で直接 Supabase SELECT
2. UI 内の `fetch("/api/...")` — service role + middleware ガード経由

Phase 9c で **すべての読み書きを `/api/*` に集約** し、`lib/data-storage.ts` は段階的に削除する。
このとき UI 側が直接 `fetch("/api/...")` するのではなく、本ディレクトリの型付き wrapper を呼ぶ:

```ts
// 例(将来形):
import { listTeachers } from "@/lib/api/teachers";
const teachers = await listTeachers({ universityCode, testSessionId });
```

これにより:
- UI から snake_case ↔ camelCase 変換コードを一掃できる
- API のリクエスト/レスポンス型を 1 箇所に集約できる
- Phase 9 RLS 有効化時の影響範囲が wrapper 層に閉じる

## 命名規約

- 1 ファイル = 1 リソース(`teachers.ts`、`students.ts`、`test-sessions.ts` 等)
- 関数名: `list<Resource>`、`get<Resource>`、`create<Resource>`、`update<Resource>`、`delete<Resource>`
- 入出力は camelCase の TS 型(`Teacher`、`Student` などは将来 `lib/types/` に移動予定)

現時点では空。Phase 9c 着手時に最初の wrapper を追加する。
