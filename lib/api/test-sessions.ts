/**
 * Phase 9c-2: test-sessions wrapper。
 *
 * 既存 /api/test-sessions は snake_case の生 row を配列で返す(items wrapper なし)。
 * フロントから loadTestSessions を呼んでいる箇所のために、ここで camelCase に整形する。
 */
import type { TestSession } from "@/lib/data-storage"

export interface ListTestSessionsParams {
  universityCode?: string
  [k: string]: string | undefined
}

function buildQS(params: { [k: string]: string | undefined }): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
  if (entries.length === 0) return ""
  return "?" + new URLSearchParams(entries).toString()
}

export async function listTestSessions(params: ListTestSessionsParams = {}): Promise<TestSession[]> {
  // 既存の API は snake_case パラメータ(university_code)を受ける。
  const qs: { [k: string]: string | undefined } = {}
  if (params.universityCode) qs["university_code"] = params.universityCode
  const res = await fetch(`/api/test-sessions${buildQS(qs)}`, { credentials: "same-origin" })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    testDate: row.test_date as string,
    description: (row.description as string) || "",
    universityCode: row.university_code as string | undefined,
    subjectCode: row.subject_code as string | undefined,
    passingScore: (row.passing_score as number | null) ?? null,
    durationMinutes: (row.duration_minutes as number | null) ?? null,
    status: (row.status as "not_started" | "in_progress" | "completed") || "not_started",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
  })) as TestSession[]
}
