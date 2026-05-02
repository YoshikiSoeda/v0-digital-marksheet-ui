/** Phase 9c-2: evaluation-results (exam_results) wrapper. */
import type { EvaluationResult } from "@/lib/data-storage"

export interface ListEvaluationResultsParams {
  universityCode?: string
  testSessionId?: string
  [k: string]: string | undefined
}

function buildQS(params: { [k: string]: string | undefined }): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
  if (entries.length === 0) return ""
  return "?" + new URLSearchParams(entries).toString()
}

export async function listEvaluationResults(params: ListEvaluationResultsParams = {}): Promise<EvaluationResult[]> {
  const res = await fetch(`/api/evaluation-results${buildQS(params)}`, { credentials: "same-origin" })
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.items) ? (json.items as EvaluationResult[]) : []
}

export async function upsertEvaluationResults(items: EvaluationResult[]): Promise<{ ok: boolean; upserted: number }> {
  const res = await fetch("/api/evaluation-results", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `upsertEvaluationResults failed: ${res.status}`)
  }
  const json = await res.json()
  return { ok: true, upserted: (json?.upserted as number) || 0 }
}
