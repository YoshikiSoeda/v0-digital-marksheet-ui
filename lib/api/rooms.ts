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

export async function upsertRooms(items: Room[]): Promise<{ ok: boolean; upserted: number }> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `upsertRooms failed: ${res.status}`)
  }
  const json = await res.json()
  return { ok: true, upserted: (json?.upserted as number) || 0 }
}


export async function deleteRoomApi(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `deleteRoom failed: ${res.status}`)
  }
  return { ok: true }
}
