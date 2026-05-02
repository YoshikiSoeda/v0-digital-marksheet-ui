/**
 * Phase 9c-1: students リソースの fetch wrapper。
 */
import type { Student } from "@/lib/data-storage"

export interface ListStudentsParams {
  universityCode?: string
  subjectCode?: string
  testSessionId?: string
  [k: string]: string | undefined
}

function buildQS(params: { [k: string]: string | undefined }): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
  if (entries.length === 0) return ""
  return "?" + new URLSearchParams(entries).toString()
}

export async function listStudents(params: ListStudentsParams = {}): Promise<Student[]> {
  const res = await fetch(`/api/students${buildQS(params)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.error("listStudents failed:", res.status)
    }
    return []
  }
  const json = await res.json()
  return Array.isArray(json?.items) ? (json.items as Student[]) : []
}

export async function getStudent(id: string): Promise<Student | null> {
  const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) return null
  const json = await res.json()
  return (json?.item ?? null) as Student | null
}

export async function upsertStudents(items: Student[]): Promise<{ ok: boolean; upserted: number }> {
  const res = await fetch("/api/students", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `upsertStudents failed: ${res.status}`)
  }
  const json = await res.json()
  return { ok: true, upserted: (json?.upserted as number) || 0 }
}
