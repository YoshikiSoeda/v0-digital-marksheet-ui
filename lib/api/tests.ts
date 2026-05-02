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
