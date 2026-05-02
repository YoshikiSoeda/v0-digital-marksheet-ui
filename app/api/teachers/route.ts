/**
 * Phase 9c-1: GET /api/teachers
 *
 * クエリ: ?universityCode=...&subjectCode=...&testSessionId=...
 * レスポンス: 200 { items: Teacher[] }
 *
 * 認可: middleware で Cookie 必須。さらに細かい行制御は Phase 9 RLS で対応予定。
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  let query = supabase
    .from("teachers")
    .select("*")
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

  if (filters.testSessionId) {
    query = query.eq("test_session_id", filters.testSessionId)
  }
  if (filters.universityCode) {
    query = query.or(`university_code.eq.${filters.universityCode},university_code.is.null`)
  }
  if (filters.subjectCode) {
    query = query.eq("subject_code", filters.subjectCode)
  }

  const { data, error } = await query
  if (error) {
    console.error("[api/teachers] error:", error)
    return NextResponse.json({ error: "Failed to load teachers" }, { status: 500 })
  }

  const items = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    teacherId: row.id as string,
    name: row.name as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as string,
    assignedRoomNumber: (row.assigned_room_number as string) || "",
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }))

  return NextResponse.json({ items }, { status: 200 })
}
