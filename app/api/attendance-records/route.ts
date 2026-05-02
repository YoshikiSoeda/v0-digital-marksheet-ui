/**
 * Phase 9c-2: GET /api/attendance-records
 * Phase 9c-4: POST /api/attendance-records(upsert、教員/患者役の試験中操作のため認証必須のみ)
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
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
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

interface UpsertAttendanceRecord {
  studentId: string
  roomNumber: string
  status: "present" | "absent" | "pending"
  timestamp?: string
  universityCode?: string
  testSessionId?: string
}

export async function POST(request: NextRequest) {
  // 試験中の教員/患者役が呼ぶため admin 強制は不可。middleware の Cookie 必須で十分。
  let body: { items?: UpsertAttendanceRecord[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ ok: true, upserted: 0 })

  const rows = items.map((r) => ({
    student_id: r.studentId,
    room_number: r.roomNumber,
    status: r.status,
    recorded_at: r.timestamp,
    university_code: r.universityCode || null,
    test_session_id: r.testSessionId || null,
  }))
  const supabase = getServiceClient()
  const { error } = await supabase
    .from("attendance_records")
    .upsert(rows as never, { onConflict: "student_id,room_number,test_session_id" })
  if (error) {
    console.error("[api/attendance-records] POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, upserted: rows.length })
}
