/**
 * Phase 9c-2: GET /api/rooms
 * Phase 9c-4: POST /api/rooms(upsert)
 *
 * ADR-007 C-6 (2026-05-07): testSessionId フィルタは
 * student/teacher/patient の test_session_assignments junction を
 * 経由して導出する。これまでは rooms.test_session_id 列で絞り込んでいたが、
 * 新規セッションには対応する rooms 行が存在せず候補ゼロになっていた。
 *
 * ロジック:
 *   1. junctions から (test_session_id, room_number) のユニオンを作成
 *   2. それを rooms canonical (university_code, room_number) に結合
 *   3. 結果を rooms 形式で返す
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery, requireAdmin } from "@/lib/api/_shared"

type RoomRow = {
  id: string
  room_number: string
  room_name: string | null
  created_at: string
  university_code: string | null
  subject_code: string | null
  test_session_id: string | null
}

function mapRoom(row: RoomRow, override?: { test_session_id?: string | null }) {
  return {
    id: row.id,
    roomNumber: row.room_number,
    roomName: row.room_name ?? "",
    createdAt: row.created_at,
    universityCode: row.university_code ?? undefined,
    subjectCode: row.subject_code ?? undefined,
    // ADR-007 C-6: testSessionId は assignment 経由 (override) で上書き
    testSessionId: override?.test_session_id ?? row.test_session_id ?? undefined,
  }
}

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode", "testSessionId"] as const)
  const supabase = getServiceClient()

  // ADR-007 C-6: testSessionId フィルタ時は assignment junction 経由で導出する。
  if (filters.testSessionId) {
    // 1) 各 junction から room_number を取得
    const [studentRes, teacherRes, patientRes] = await Promise.all([
      supabase
        .from("student_test_session_assignments")
        .select("room_number")
        .eq("test_session_id", filters.testSessionId),
      supabase
        .from("teacher_test_session_assignments")
        .select("assigned_room_number")
        .eq("test_session_id", filters.testSessionId),
      supabase
        .from("patient_test_session_assignments")
        .select("assigned_room_number")
        .eq("test_session_id", filters.testSessionId),
    ])
    if (studentRes.error || teacherRes.error || patientRes.error) {
      console.error(
        "[api/rooms] GET (junctions) error:",
        studentRes.error || teacherRes.error || patientRes.error,
      )
      return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 })
    }
    const roomNumbers = new Set<string>()
    for (const r of (studentRes.data || []) as Array<{ room_number: string | null }>) {
      if (r.room_number) roomNumbers.add(r.room_number)
    }
    for (const r of (teacherRes.data || []) as Array<{ assigned_room_number: string | null }>) {
      if (r.assigned_room_number) roomNumbers.add(r.assigned_room_number)
    }
    for (const r of (patientRes.data || []) as Array<{ assigned_room_number: string | null }>) {
      if (r.assigned_room_number) roomNumbers.add(r.assigned_room_number)
    }
    if (roomNumbers.size === 0) return NextResponse.json({ items: [] }, { status: 200 })

    // 2) canonical な rooms 1 行を引く(university_code + room_number で UNIQUE)
    let q = supabase
      .from("rooms")
      .select("*")
      .in("room_number", Array.from(roomNumbers))
      .order("room_number", { ascending: true })
    if (filters.universityCode) q = q.eq("university_code", filters.universityCode)
    if (filters.subjectCode) q = q.eq("subject_code", filters.subjectCode)

    const { data, error } = await q
    if (error) {
      console.error("[api/rooms] GET (canonical) error:", error)
      return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 })
    }
    // 同じ room_number を複数 university が持つ可能性があるので
    // (university_code, room_number) でユニーク化する
    const seen = new Set<string>()
    const items: ReturnType<typeof mapRoom>[] = []
    for (const row of (data || []) as RoomRow[]) {
      const key = `${row.university_code ?? ""}::${row.room_number}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push(mapRoom(row, { test_session_id: filters.testSessionId }))
    }
    return NextResponse.json({ items }, { status: 200 })
  }

  // testSessionId フィルタなし: canonical rooms をそのまま返す
  let query = supabase.from("rooms").select("*").order("room_number", { ascending: true })
  if (filters.universityCode) query = query.eq("university_code", filters.universityCode)
  if (filters.subjectCode) query = query.eq("subject_code", filters.subjectCode)

  const { data, error } = await query
  if (error) {
    console.error("[api/rooms] GET error:", error)
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 })
  }
  // canonical (university_code, room_number) で重複排除
  const seen = new Set<string>()
  const items: ReturnType<typeof mapRoom>[] = []
  for (const row of (data || []) as RoomRow[]) {
    const key = `${row.university_code ?? ""}::${row.room_number}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(mapRoom(row))
  }
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
    // ADR-007 C-6 / scripts/233: rooms の UNIQUE 制約は canonical な
    // (university_code, room_number) のみ。旧 4 列 UNIQUE (rooms_unique_per_session)
    // は scripts/233 で DROP 済み。それを参照していた旧 onConflict は 42P10 で失敗
    // していた(部屋追加が常に「失敗しました」alert で阻まれる致命バグ)。
    .upsert(rows as never, { onConflict: "university_code,room_number" })
  if (error) {
    console.error("[api/rooms] POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, upserted: rows.length })
}

