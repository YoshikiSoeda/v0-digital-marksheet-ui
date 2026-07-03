/**
 * HOTFIX: Phase 9 RLS 有効化後、anon key では UPDATE/DELETE が拒否されるため
 * service role(getServiceClient)に切替。
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard
  try {
    const supabase = getServiceClient()
    const body = await request.json()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (body.test_date !== undefined) updateData.test_date = body.test_date
    if (body.description !== undefined) updateData.description = body.description
    if (body.university_code !== undefined) updateData.university_code = body.university_code
    if (body.passing_score !== undefined) updateData.passing_score = body.passing_score ?? null
    if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes ?? null
    if (body.status !== undefined) updateData.status = body.status

    const { data, error } = await supabase
      .from("test_sessions")
      .update(updateData as never)
      .eq("id", (await params).id)
      .select()
      .single()

    if (error) {
      console.error("[api/test-sessions/:id] PUT error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// 2026-07-03 副田さん要望: 試験セッション削除機能
//   - デフォルト: 依存があれば 409 + dependencies を返す
//   - ?cascade=true: 依存 (tests / attendance / exam_results / 3 種 assignments)
//     を全て削除してからセッション本体を削除
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard
  try {
    const { id } = await params
    const cascade = request.nextUrl.searchParams.get("cascade") === "true"
    const supabase = getServiceClient()

    // 依存件数を集計
    const [tests, attendance, examResults, stuAssigns, teacherAssigns, patientAssigns] =
      await Promise.all([
        supabase.from("tests").select("id", { count: "exact", head: true }).eq("test_session_id", id),
        supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("test_session_id", id),
        supabase.from("exam_results").select("id", { count: "exact", head: true }).eq("test_session_id", id),
        supabase.from("student_test_session_assignments").select("student_id", { count: "exact", head: true }).eq("test_session_id", id),
        supabase.from("teacher_test_session_assignments").select("teacher_id", { count: "exact", head: true }).eq("test_session_id", id),
        supabase.from("patient_test_session_assignments").select("patient_id", { count: "exact", head: true }).eq("test_session_id", id),
      ])
    const dependencies = {
      tests: tests.count ?? 0,
      attendance: attendance.count ?? 0,
      examResults: examResults.count ?? 0,
      studentAssigns: stuAssigns.count ?? 0,
      teacherAssigns: teacherAssigns.count ?? 0,
      patientAssigns: patientAssigns.count ?? 0,
    }
    const totalDeps =
      dependencies.tests +
      dependencies.attendance +
      dependencies.examResults +
      dependencies.studentAssigns +
      dependencies.teacherAssigns +
      dependencies.patientAssigns

    if (!cascade && totalDeps > 0) {
      const parts: string[] = []
      if (dependencies.tests > 0) parts.push(`テスト ${dependencies.tests} 件`)
      if (dependencies.attendance > 0) parts.push(`出席記録 ${dependencies.attendance} 件`)
      if (dependencies.examResults > 0) parts.push(`評価結果 ${dependencies.examResults} 件`)
      if (dependencies.studentAssigns > 0) parts.push(`学生割当 ${dependencies.studentAssigns} 件`)
      if (dependencies.teacherAssigns > 0) parts.push(`教員割当 ${dependencies.teacherAssigns} 件`)
      if (dependencies.patientAssigns > 0) parts.push(`患者役割当 ${dependencies.patientAssigns} 件`)
      return NextResponse.json(
        {
          error: `このセッションには ${parts.join("、")} が紐づいています。cascade=true で強制削除できます。`,
          dependencies,
        },
        { status: 409 },
      )
    }

    // cascade 削除: 依存を全削除
    if (cascade && totalDeps > 0) {
      const cascadeResults = await Promise.all([
        supabase.from("student_test_session_assignments").delete().eq("test_session_id", id),
        supabase.from("teacher_test_session_assignments").delete().eq("test_session_id", id),
        supabase.from("patient_test_session_assignments").delete().eq("test_session_id", id),
        supabase.from("attendance_records").delete().eq("test_session_id", id),
        supabase.from("exam_results").delete().eq("test_session_id", id),
        supabase.from("tests").delete().eq("test_session_id", id),
      ])
      for (const r of cascadeResults) {
        if (r.error) {
          console.error("[api/test-sessions/:id] cascade DELETE error:", r.error)
          return NextResponse.json({ error: r.error.message }, { status: 500 })
        }
      }
    }

    // セッション本体を削除
    const { error } = await supabase.from("test_sessions").delete().eq("id", id)
    if (error) {
      console.error("[api/test-sessions/:id] DELETE error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, dependencies })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
