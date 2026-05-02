/**
 * Phase 9c-1: teachers リソースの fetch wrapper。
 * UI からは loadTeachers の代わりに本ファイルの listTeachers を呼ぶ。
 * ADR-002 §5.4 を参照。
 */
import type { Teacher } from "@/lib/data-storage"

export interface ListTeachersParams {
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

export async function listTeachers(params: ListTeachersParams = {}): Promise<Teacher[]> {
  const res = await fetch(`/api/teachers${buildQS(params)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.error("listTeachers failed:", res.status)
    }
    return []
  }
  const json = await res.json()
  return Array.isArray(json?.items) ? (json.items as Teacher[]) : []
}

export async function getTeacher(id: string): Promise<Teacher | null> {
  const res = await fetch(`/api/teachers/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) return null
  const json = await res.json()
  return (json?.item ?? null) as Teacher | null
}
