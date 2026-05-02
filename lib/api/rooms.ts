/** Phase 9c-2: rooms wrapper. */
import type { Room } from "@/lib/data-storage"

export interface ListRoomsParams {
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

export async function listRooms(params: ListRoomsParams = {}): Promise<Room[]> {
  const res = await fetch(`/api/rooms${buildQS(params)}`, { credentials: "same-origin" })
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.items) ? (json.items as Room[]) : []
}
