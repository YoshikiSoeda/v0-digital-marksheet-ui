/**
 * Phase 9c-1: GET /api/students
 * Phase 9c-4: POST /api/students(upsert)
 *
 * ADR-004 Phase B-2-b: testSessionId フィルタ時は student_test_session_assignments
 * 経由で読む(canonical 化への移行)。フィルタなしのときは students を直接読む。
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery, requireAdmin } from "@/lib/api/_shared"

type StudentRow = {
  id: string
  student_id: string
  name: string
  email?: string | null
  department?: string | null
  grade?: string | null
  room_number?: string | null
  university_code?: string | null
  subject_code?: string | null
  test_session_id?: string | null
  created_at: string
}

function mapStudent(
  row: StudentRow,
  override?: { test_session_id?: string | null; room_number?: string | null }
) {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    email: row.email ?? undefined,
    department: row.department ?? undefined,
    grade: row.grade ?? undefined,
    roomNumber: (override?.room_number ?? row.room_number ?? "") as string,
    createdAt: row.created_at,
    universityCode: row.university_code ?? undefined,
    subjectCode: row.subject_code ?? undefined,
    testSessionId: (override?.test_session_id ?? row.test_session_id) ?? undefined,
  }
}

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  // ADR-004 Phase B-2-b: testSessionId フィルタは assignments 経由で読む
  if (filters.testSessionId) {
    let q = supabase
      .from("student_test_session_assignments")
      .select("test_session_id, room_number, students!inner(*)")
      .eq("test_session_id", filters.testSessionId)
      .order("created_at", { ascending: true })

    if (filters.universityCode) q = q.eq("students.university_code", filters.universityCode)
    if (filters.subjectCode) q = q.eq("students.subject_code", filters.subjectCode)

    const { data, error } = await q
    if (error) {
      console.error("[api/students] GET (assignments) error:", error)
      return NextResponse.json({ error: "Failed to load students" }, { status: 500 })
    }
    const items = (data || []).map((a: Record<string, unknown>) => {
      const studentRel = a.students as StudentRow
      return mapStudent(studentRel, {
        test_session_id: a.test_session_id as string,
        room_number: a.room_number as string | null,
      })
    })
    return NextResponse.json({ items }, { status: 200 })
  }

  // testSessionId フィルタなしは students を直接(canonical view)
  let query = supabase.from("students").select("*").order("created_at", { ascending: true })
  if (filters.universityCode) query = query.eq("university_code", filters.universityCode)
  if (filters.subjectCode) query = query.eq("subject_code", filters.subjectCode)

  const { data, error } = await query
  if (error) {
    console.error("[api/students] GET error:", error)
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 })
  }
  const items = (data || []).map((row: Record<string, unknown>) => mapStudent(row as StudentRow))
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
