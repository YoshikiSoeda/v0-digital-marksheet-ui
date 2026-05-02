/** Phase 9c-2: tests wrapper. */
import type { Test } from "@/lib/data-storage"

export interface ListTestsParams {
  universityCode?: string
  subjectCode?: string
  [k: string]: string | undefined
}

function buildQS(params: { [k: string]: string | undefined }): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
  if (entries.length === 0) return ""
  return "?" + new URLSearchParams(entries).toString()
}

export async function listTests(params: ListTestsParams = {}): Promise<Test[]> {
  const res = await fetch(`/api/tests${buildQS(params)}`, { credentials: "same-origin" })
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.items) ? (json.items as Test[]) : []
}

export async function upsertTests(items: Test[]): Promise<{ ok: boolean; upserted: number }> {
  const res = await fetch("/api/tests", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `upsertTests failed: ${res.status}`)
  }
  const json = await res.json()
  return { ok: true, upserted: (json?.upserted as number) || 0 }
}

export async function deleteTestApi(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/tests/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `deleteTest failed: ${res.status}`)
  }
  return { ok: true }
}
