/**
 * Phase 9c-1: GET /api/students
 * Phase 9c-4: POST /api/students(upsert)
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery, requireAdmin } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  let query = supabase.from("students").select("*").order("created_at", { ascending: true })

  if (filters.testSessionId) query = query.eq("test_session_id", filters.testSessionId)
  if (filters.universityCode) query = query.eq("university_code", filters.universityCode)
  if (filters.subjectCode) query = query.eq("subject_code", filters.subjectCode)

  const { data, error } = await query
  if (error) {
    console.error("[api/students] GET error:", error)
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 })
  }
  const items = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    studentId: row.student_id as string,
    name: row.name as string,
    email: row.email as string | undefined,
    department: row.department as string | undefined,
    grade: row.grade as string | undefined,
    roomNumber: (row.room_number as string) || "",
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }))
  return NextResponse.json({ items }, { status: 200 })
}

interface UpsertStudent {
  studentId: string
  name: string
  email?: string
  department?: string
  grade?: string
  roomNumber?: string
  universityCode?: string
  subjectCode?: string
  testSessionId?: string
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: { items?: UpsertStudent[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ ok: true, upserted: 0 })

  const rows = items.map((s) => ({
    student_id: s.studentId,
    name: s.name,
    email: s.email || null,
    department: s.department,
    grade: s.grade || null,
    room_number: s.roomNumber,
    university_code: s.universityCode || null,
    subject_code: s.subjectCode || null,
    test_session_id: s.testSessionId || null,
  }))

  const supabase = getServiceClient()
  const { error } = await supabase
    .from("students")
    .upsert(rows as never, { onConflict: "student_id,test_session_id" })
  if (error) {
    console.error("[api/students] POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, upserted: rows.length })
}
