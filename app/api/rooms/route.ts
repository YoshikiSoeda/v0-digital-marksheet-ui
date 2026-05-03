/**
 * Phase 9c-2: GET /api/rooms
 * Phase 9c-4: POST /api/rooms(upsert)
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery, requireAdmin } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  let query = supabase.from("rooms").select("*").order("room_number", { ascending: true })
  if (filters.testSessionId) query = query.eq("test_session_id", filters.testSessionId)
  if (filters.universityCode) query = query.eq("university_code", filters.universityCode)
  if (filters.subjectCode) query = query.eq("subject_code", filters.subjectCode)

  const { data, error } = await query
  if (error) {
    console.error("[api/rooms] GET error:", error)
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

interface UpsertRoom {
  roomNumber: string
  roomName: string
  createdAt?: string
  universityCode?: string
  subjectCode?: string
  testSessionId?: string
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard
  let body: { items?: UpsertRoom[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ ok: true, upserted: 0 })

  const rows = items.map((r) => ({
    room_number: r.roomNumber,
    room_name: r.roomName,
    created_at: r.createdAt,
    university_code: r.universityCode || null,
    subject_code: r.subjectCode || null,
    test_session_id: r.testSessionId || null,
  }))
  const supabase = getServiceClient()
  const { error } = await supabase
    .from("rooms")
    // ADR-005 F1: rooms テーブルの UNIQUE 制約は (room_number, university_code, subject_code, test_session_id) の 4 列。
    // 旧 onConflict "room_number,test_session_id" は 4 列 UNIQUE と一致せず常に 23P01 で失敗 → UI は楽観更新で「成功」表示するが DB に反映されないバグだった。
    .upsert(rows as never, { onConflict: "room_number,university_code,subject_code,test_session_id" })
  if (error) {
    console.error("[api/rooms] POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, upserted: rows.length })
}

