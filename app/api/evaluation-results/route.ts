/**
 * Phase 9c-2: GET /api/evaluation-results
 * フィルタ: universityCode, testSessionId
 *
 * DB テーブル名は exam_results。フロントの語彙は evaluation 系で統一。
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
  if (error) {
    console.error("[api/evaluation-results] error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
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
