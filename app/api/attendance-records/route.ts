/**
 * Phase 9c-2: GET /api/attendance-records
 * フィルタ: universityCode, testSessionId
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  let query = supabase
    .from("attendance_records")
    .select("*")
    .order("recorded_at", { ascending: false })
  if (filters.testSessionId) query = query.eq("test_session_id", filters.testSessionId)
  if (filters.universityCode) {
    query = query.or(`university_code.eq.${filters.universityCode},university_code.is.null`)
  }

  const { data, error } = await query
  if (error) {
    console.error("[api/attendance-records] error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
  const items = (data || []).map((row: Record<string, unknown>) => ({
    studentId: row.student_id as string,
    status: row.status as "present" | "absent" | "pending",
    markedBy: "",
    markedByType: "teacher" as const,
    roomNumber: row.room_number as string,
    timestamp: row.recorded_at as string,
    universityCode: row.university_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }))
  return NextResponse.json({ items }, { status: 200 })
}
