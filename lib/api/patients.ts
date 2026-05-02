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
