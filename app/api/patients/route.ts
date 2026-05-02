/**
 * Phase 9c-1: GET /api/patients
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  let query = supabase
    .from("patients")
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
    console.error("[api/patients] error:", error)
    return NextResponse.json({ error: "Failed to load patients" }, { status: 500 })
  }

  const items = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    patientId: row.id as string,
    name: row.name as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as "general",
    assignedRoomNumber: (row.assigned_room_number as string) || "",
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    accountType: row.account_type as "special_master" | "university_master" | "admin" | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }))

  return NextResponse.json({ items }, { status: 200 })
}
