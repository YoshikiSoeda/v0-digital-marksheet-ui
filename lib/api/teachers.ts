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

export async function deleteTeacherApi(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/teachers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `deleteTeacher failed: ${res.status}`)
  }
  return { ok: true }
}

export interface UpdateTeacherInput {
  name?: string
  email?: string
  password?: string
  role?: string
  assignedRoomNumber?: string
  universityCode?: string
  subjectCode?: string
  accountType?: string
}

/**
 * 2026-05-08: id ベースの単行 UPDATE。
 * register_teachers_bulk (ON CONFLICT (univ, email)) は email 変更時に旧行を
 * orphan 化するため、編集時は本関数を使う。
 */
export async function updateTeacher(id: string, input: UpdateTeacherInput): Promise<Teacher> {
  const res = await fetch(`/api/teachers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `updateTeacher failed: ${res.status}`)
  }
  const json = await res.json()
  return json.item as Teacher
}
