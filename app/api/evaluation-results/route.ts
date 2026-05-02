/**
 * Phase 9c-2: GET /api/evaluation-results
 * Phase 9c-4: POST /api/evaluation-results(upsert、試験中の教員/患者役のため認証必須のみ)
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  let query = supabase
    .from("exam_results")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000)
  if (filters.testSessionId) query = query.eq("test_session_id", filters.testSessionId)
  if (filters.universityCode) {
    query = query.or(`university_code.eq.${filters.universityCode},university_code.is.null`)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
  const items = (data || []).map((row: Record<string, unknown>) => ({
    studentId: row.student_id as string,
    evaluatorId: row.evaluator_email as string,
    evaluatorType: row.evaluator_type as "teacher" | "patient",
    roomNumber: row.room_number as string,
    answers: (row.evaluations as Record<string, unknown>) || {},
    totalScore: (row.total_score as number) || 0,
    answeredCount: Object.keys((row.evaluations as Record<string, unknown>) || {}).length,
    isCompleted: (row.is_completed as boolean) || false,
    hasAlert: (row.has_alert as boolean) || false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
    universityCode: row.university_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }))
  return NextResponse.json({ items }, { status: 200 })
}

interface UpsertEvaluation {
  studentId: string
  roomNumber: string
  evaluatorId: string
  evaluatorType: "teacher" | "patient"
  answers: Record<string, unknown>
  totalScore: number
  isCompleted: boolean
  hasAlert?: boolean
  universityCode?: string
  testSessionId?: string
}

export async function POST(request: NextRequest) {
  let body: { items?: UpsertEvaluation[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ ok: true, upserted: 0 })

  const rows = items.map((r) => ({
    student_id: r.studentId,
    room_number: r.roomNumber,
    evaluator_email: r.evaluatorId,
    evaluator_type: r.evaluatorType,
    evaluations: r.answers,
    total_score: r.totalScore,
    is_completed: r.isCompleted,
    has_alert: r.hasAlert || false,
    university_code: r.universityCode || null,
    test_session_id: r.testSessionId || null,
  }))
  const supabase = getServiceClient()
  const { error } = await supabase
    .from("exam_results")
    .upsert(rows as never, {
      onConflict: "student_id,evaluator_email,evaluator_type,room_number,test_session_id",
    })
  if (error) {
    console.error("[api/evaluation-results] POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, upserted: rows.length })
}
