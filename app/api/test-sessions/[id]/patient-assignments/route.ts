/**
 * ADR-007 Phase C-5: GET/PUT /api/test-sessions/[id]/patient-assignments
 * (teacher-assignments の mirror)
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

interface AssignmentItem {
  patientId: string
  assignedRoomNumber?: string | null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from("patient_test_session_assignments")
    .select("test_session_id, assigned_room_number, patients!inner(*)")
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

  const providedIds = items.map((i) => i.patientId).filter(Boolean)
  let deleteQuery = supabase
    .from("patient_test_session_assignments")
    .delete()
    .eq("test_session_id", sessionId)
  if (providedIds.length > 0) {
    deleteQuery = deleteQuery.not("patient_id", "in", `(${providedIds.join(",")})`)
  }
  const { error: delErr } = await deleteQuery
  if (delErr) {
    console.error("[patient-assignments] DELETE error:", delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (items.length > 0) {
    const rows = items.map((i) => ({
      patient_id: i.patientId,
      test_session_id: sessionId,
      assigned_room_number: (i.assignedRoomNumber || null) as string | null,
      updated_at: new Date().toISOString(),
    }))
    const { error: upErr } = await supabase
      .from("patient_test_session_assignments")
      .upsert(rows as never, { onConflict: "patient_id,test_session_id" })
    if (upErr) {
      console.error("[patient-assignments] UPSERT error:", upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, count: items.length })
}
