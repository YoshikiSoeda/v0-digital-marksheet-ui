/**
 * ADR-007 Phase C-5: GET/PUT /api/test-sessions/[id]/patient-assignments
 * (teacher-assignments の mirror)
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

interface AssignmentItem {
  patientId: string
  assignedRoomNumber?: string | null
  slotIndex?: number | null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from("patient_test_session_assignments")
    .select("test_session_id, assigned_room_number, slot_index, patients!inner(*)")
    .eq("test_session_id", sessionId)
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

  if (error) {
    console.error("[patient-assignments] GET error:", error)
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 })
  }

  const items = (data || []).map((a: Record<string, unknown>) => {
    const p = a.patients as Record<string, unknown>
    return {
      patientId: p.id as string,
      patient: {
        id: p.id as string,
        name: p.name as string,
        email: p.email as string,
        role: p.role as string,
        universityCode: p.university_code as string | undefined,
        subjectCode: p.subject_code as string | undefined,
      },
      assignedRoomNumber: (a.assigned_room_number as string | null) ?? null,
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

  // 2026-07-02 熊木先生指摘対応: PK が (patient_id, test_session_id, assigned_room_number)
  // に変更されたため、1 患者役が複数部屋を担当可能に。
  // シンプル実装: セッション内の全 assignment を DELETE → provided items を INSERT。

  const { error: delErr } = await supabase
    .from("patient_test_session_assignments")
    .delete()
    .eq("test_session_id", sessionId)
  if (delErr) {
    console.error("[patient-assignments] DELETE error:", delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (items.length > 0) {
    const dedup = new Map<string, { patientId: string; assignedRoomNumber: string; slotIndex: number | null }>()
    for (const i of items) {
      const room = (i.assignedRoomNumber || "").trim()
      if (!i.patientId || !room) continue
      dedup.set(`${i.patientId}::${room}`, {
        patientId: i.patientId,
        assignedRoomNumber: room,
        slotIndex: typeof i.slotIndex === "number" ? i.slotIndex : null,
      })
    }
    const rows = Array.from(dedup.values()).map((i) => ({
      patient_id: i.patientId,
      test_session_id: sessionId,
      assigned_room_number: i.assignedRoomNumber,
      slot_index: i.slotIndex,
      updated_at: new Date().toISOString(),
    }))
    if (rows.length > 0) {
      const { error: insErr } = await supabase
        .from("patient_test_session_assignments")
        .insert(rows as never)
      if (insErr) {
        console.error("[patient-assignments] INSERT error:", insErr)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true, count: items.length })
}
