/**
 * ADR-007 Phase C-5: GET/PUT /api/test-sessions/[id]/teacher-assignments
 *
 * 試験セッションへの教員割当を管理する。
 * - GET: 現在の割当一覧を取得 (canonical teachers の情報も joined)
 * - PUT: 割当を全置換 (provided items でない既存 assignment は削除、provided は upsert)
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

interface AssignmentItem {
  teacherId: string
  assignedRoomNumber?: string | null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from("teacher_test_session_assignments")
    .select("test_session_id, assigned_room_number, teachers!inner(*)")
    .eq("test_session_id", sessionId)
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

  if (error) {
    console.error("[teacher-assignments] GET error:", error)
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 })
  }

  const items = (data || []).map((a: Record<string, unknown>) => {
    const t = a.teachers as Record<string, unknown>
    return {
      teacherId: t.id as string,
      teacher: {
        id: t.id as string,
        name: t.name as string,
        email: t.email as string,
        role: t.role as string,
        universityCode: t.university_code as string | undefined,
        subjectCode: t.subject_code as string | undefined,
      },
      assignedRoomNumber: (a.assigned_room_number as string | null) ?? null,
    }
  })
  return NextResponse.json({ items }, { status: 200 })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const { id: sessionId } = await params

  let body: { items?: AssignmentItem[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const items = Array.isArray(body.items) ? body.items : []

  const supabase = getServiceClient()

  // 1. 提供されていない既存 assignment を削除 (replace 動作)
  const providedIds = items.map((i) => i.teacherId).filter(Boolean)
  let deleteQuery = supabase
    .from("teacher_test_session_assignments")
    .delete()
    .eq("test_session_id", sessionId)
  if (providedIds.length > 0) {
    deleteQuery = deleteQuery.not("teacher_id", "in", `(${providedIds.join(",")})`)
  }
  const { error: delErr } = await deleteQuery
  if (delErr) {
    console.error("[teacher-assignments] DELETE error:", delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // 2. provided items を upsert
  if (items.length > 0) {
    const rows = items.map((i) => ({
      teacher_id: i.teacherId,
      test_session_id: sessionId,
      assigned_room_number: (i.assignedRoomNumber || null) as string | null,
      updated_at: new Date().toISOString(),
    }))
    const { error: upErr } = await supabase
      .from("teacher_test_session_assignments")
      .upsert(rows as never, { onConflict: "teacher_id,test_session_id" })
    if (upErr) {
      console.error("[teacher-assignments] UPSERT error:", upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, count: items.length })
}
