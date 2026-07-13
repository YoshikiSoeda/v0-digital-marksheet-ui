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
  slotIndex?: number | null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from("teacher_test_session_assignments")
    .select("test_session_id, assigned_room_number, slot_index, teachers!inner(*)")
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
      // 部屋内の①②…順 (2026-07-13)。null は未 backfill(旧データ)。
      slotIndex: (a.slot_index as number | null) ?? null,
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

  // 2026-07-02 熊木先生指摘対応: PK が (teacher_id, test_session_id, assigned_room_number)
  // に変更されたため、1 教員が複数部屋を担当可能に。
  // シンプル実装: セッション内の全 assignment を DELETE → provided items を INSERT。
  // (小規模データを想定、DELETE + INSERT でトランザクション代替)

  const { error: delErr } = await supabase
    .from("teacher_test_session_assignments")
    .delete()
    .eq("test_session_id", sessionId)
  if (delErr) {
    console.error("[teacher-assignments] DELETE error:", delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (items.length > 0) {
    // 同一 (teacher, room) が重複していないよう de-dup
    const dedup = new Map<string, { teacherId: string; assignedRoomNumber: string; slotIndex: number | null }>()
    for (const i of items) {
      const room = (i.assignedRoomNumber || "").trim()
      if (!i.teacherId || !room) continue
      dedup.set(`${i.teacherId}::${room}`, {
        teacherId: i.teacherId,
        assignedRoomNumber: room,
        slotIndex: typeof i.slotIndex === "number" ? i.slotIndex : null,
      })
    }
    const rows = Array.from(dedup.values()).map((i) => ({
      teacher_id: i.teacherId,
      test_session_id: sessionId,
      assigned_room_number: i.assignedRoomNumber,
      slot_index: i.slotIndex,
      updated_at: new Date().toISOString(),
    }))
    if (rows.length > 0) {
      const { error: insErr } = await supabase
        .from("teacher_test_session_assignments")
        .insert(rows as never)
      if (insErr) {
        console.error("[teacher-assignments] INSERT error:", insErr)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true, count: items.length })
}
