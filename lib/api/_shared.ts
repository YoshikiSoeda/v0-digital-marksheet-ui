/**
 * Phase 9c-1: API ルート共通ヘルパ。
 * - Supabase service role client(lazy init)
 * - クライアント向け型と DB 行(snake_case)の相互変換ユーティリティ
 *
 * すべての app/api/<resource>/route.ts はここを経由して DB アクセスする。
 * ADR-002 §5.5 を参照。
 */
import { createClient } from "@supabase/supabase-js"

let _client: ReturnType<typeof createClient> | null = null

export function getServiceClient() {
  if (_client) return _client
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  return _client
}

/**
 * URL の query string からフィルタ params を取り出すヘルパ。
 * 各 route ハンドラで `parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"])` の形で使う。
 */
export function parseListQuery(
  request: Request,
  keys: readonly string[],
): Record<string, string> {
  const url = new URL(request.url)
  const out: Record<string, string> = {}
  for (const k of keys) {
    const v = url.searchParams.get(k)
    if (v) out[k] = v
  }
  return out
}
