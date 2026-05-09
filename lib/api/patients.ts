/**
 * Phase 9c-1: patients リソースの fetch wrapper。
 */
import type { Patient } from "@/lib/data-storage"

export interface ListPatientsParams {
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

export async function listPatients(params: ListPatientsParams = {}): Promise<Patient[]> {
  const res = await fetch(`/api/patients${buildQS(params)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.error("listPatients failed:", res.status)
    }
    return []
  }
  const json = await res.json()
  return Array.isArray(json?.items) ? (json.items as Patient[]) : []
}

export async function getPatient(id: string): Promise<Patient | null> {
  const res = await fetch(`/api/patients/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) return null
  const json = await res.json()
  return (json?.item ?? null) as Patient | null
}

export async function deletePatientApi(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/patients/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `deletePatient failed: ${res.status}`)
  }
  return { ok: true }
}

export interface UpdatePatientInput {
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
 * register_patients_bulk (ON CONFLICT (univ, email)) は email 変更時に旧行を
 * orphan 化するため、編集時は本関数を使う。
 */
export async function updatePatient(id: string, input: UpdatePatientInput): Promise<Patient> {
  const res = await fetch(`/api/patients/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `updatePatient failed: ${res.status}`)
  }
  const json = await res.json()
  return json.item as Patient
}
