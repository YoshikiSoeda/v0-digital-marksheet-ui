/**
 * ADR-007 Phase C-5 補強: GET / DELETE /api/test-sessions/[id]/student-assignments
 *
 * 試験セッションへの学生割当を扱う。学生は教員/患者役と異なり canonical 件数が多い (数百件)
 * ため、PUT 全置換ではなく追加 (POST /api/students 経由) と個別 DELETE のみを提供する。
 *
 * - GET:   現在の割当一覧を返す (room_number 付き)
 * - DELETE: ?studentId=X で 1 件 assignment を削除
 *
 * 学生の追加 (assign) は既存 POST /api/students(items に testSessionId + roomNumber を載せる)
 * を使うため、本ルートでは POST/PUT を実装しない。
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from("student_test_session_assignments")
    .select("test_session_id, room_number, students!inner(*)")
    .eq("test_session_id", sessionId)
    .order("room_number", { ascending: true, nullsFirst: false })

  if (error) {
    console.error("[student-assignments] GET error:", error)
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 })
  }

  const items = (data || []).map((a: Record<string, unknown>) => {
    const s = a.students as Record<string, unknown>
    return {
      studentId: s.id as string,
      student: {
        id: s.id as string,
        studentId: s.student_id as string,
        name: s.name as string,
        email: (s.email as string | null) ?? undefined,
        department: (s.department as string | null) ?? undefined,
        grade: (s.grade as string | null) ?? undefined,
        universityCode: (s.university_code as string | null) ?? undefined,
        subjectCode: (s.subject_code as string | null) ?? undefined,
      },
      roomNumber: (a.room_number as string | null) ?? null,
    }
  })
  return NextResponse.json({ items }, { status: 200 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const { id: sessionId } = await params
  const studentId = request.nextUrl.searchParams.get("studentId")
  if (!studentId) {
    return NextResponse.json({ error: "studentId query param is required" }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { error } = await supabase
    .from("student_test_session_assignments")
    .delete()
    .eq("test_session_id", sessionId)
    .eq("student_id", studentId)

  if (error) {
    console.error("[student-assignments] DELETE error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
