/** Phase 9c-2: attendance-records wrapper. */
import type { AttendanceRecord } from "@/lib/data-storage"

export interface ListAttendanceRecordsParams {
  universityCode?: string
  testSessionId?: string
  [k: string]: string | undefined
}

function buildQS(params: { [k: string]: string | undefined }): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
  if (entries.length === 0) return ""
  return "?" + new URLSearchParams(entries).toString()
}

export async function listAttendanceRecords(params: ListAttendanceRecordsParams = {}): Promise<AttendanceRecord[]> {
  const res = await fetch(`/api/attendance-records${buildQS(params)}`, { credentials: "same-origin" })
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.items) ? (json.items as AttendanceRecord[]) : []
}

export async function upsertAttendanceRecords(items: AttendanceRecord[]): Promise<{ ok: boolean; upserted: number }> {
  const res = await fetch("/api/attendance-records", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `upsertAttendanceRecords failed: ${res.status}`)
  }
  const json = await res.json()
  return { ok: true, upserted: (json?.upserted as number) || 0 }
}
