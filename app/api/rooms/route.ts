/**
 * Phase 9c-2: GET /api/rooms
 * フィルタ: universityCode, subjectCode, testSessionId
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  let query = supabase.from("rooms").select("*").order("room_number", { ascending: true })
  if (filters.testSessionId) query = query.eq("test_session_id", filters.testSessionId)
  if (filters.universityCode) query = query.eq("university_code", filters.universityCode)
  if (filters.subjectCode) query = query.eq("subject_code", filters.subjectCode)

  const { data, error } = await query
  if (error) {
    console.error("[api/rooms] error:", error)
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 })
  }
  const items = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    roomNumber: row.room_number as string,
    roomName: row.room_name as string,
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }))
  return NextResponse.json({ items }, { status: 200 })
}
