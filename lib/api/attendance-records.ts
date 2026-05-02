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
