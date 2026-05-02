/**
 * Phase 9c-2: subjects wrapper。
 * 既存 /api/subjects は snake_case 生 row 配列を返す。camelCase に整形する。
 */
import type { Subject } from "@/lib/data-storage"

export interface ListSubjectsParams {
  universityCode?: string
  [k: string]: string | undefined
}

export async function listSubjects(params: ListSubjectsParams = {}): Promise<Subject[]> {
  const url = params.universityCode
    ? `/api/subjects?university_code=${encodeURIComponent(params.universityCode)}`
    : "/api/subjects"
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    subjectCode: row.subject_code as string,
    subjectName: row.subject_name as string,
    universityCode: row.university_code as string | undefined,
    description: row.description as string | undefined,
    isActive: row.is_active as boolean | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
  })) as Subject[]
}

export async function upsertSubjects(items: Subject[]): Promise<{ ok: boolean; upserted: number }> {
  const res = await fetch("/api/subjects", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `upsertSubjects failed: ${res.status}`)
  }
  const json = await res.json()
  return { ok: true, upserted: (json?.upserted as number) || 0 }
}
