/**
 * Phase 9c-1: GET /api/students
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  let query = supabase.from("students").select("*").order("created_at", { ascending: true })

  if (filters.testSessionId) {
    query = query.eq("test_session_id", filters.testSessionId)
  }
  if (filters.universityCode) {
    query = query.eq("university_code", filters.universityCode)
  }
  if (filters.subjectCode) {
    query = query.eq("subject_code", filters.subjectCode)
  }

  const { data, error } = await query
  if (error) {
    console.error("[api/students] error:", error)
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 })
  }

  const items = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    studentId: row.student_id as string,
    name: row.name as string,
    email: row.email as string | undefined,
    department: row.department as string | undefined,
    roomNumber: (row.room_number as string) || "",
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }))

  return NextResponse.json({ items }, { status: 200 })
}
