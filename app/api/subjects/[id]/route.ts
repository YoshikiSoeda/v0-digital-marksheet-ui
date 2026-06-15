import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth/api-guard"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = requireAdmin(request)
    if (guard) return guard

    const { id } = await params
    const body = await request.json()
    // 2026-05-19 副田さん報告 fix: 旧実装は subject_name / description / is_active だけ
    // destructure しており、university_code を変更しても保存されない bug があった。
    const { subject_name, description, is_active, university_code } = body

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (subject_name !== undefined) update.subject_name = subject_name
    if (description !== undefined) update.description = description
    if (is_active !== undefined) update.is_active = is_active
    if (university_code !== undefined) update.university_code = university_code

    const { data, error } = await supabase
      .from("subjects")
      .update(update)
      .eq("id", id)
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error("Error updating subject:", error)
    return NextResponse.json({ error: "Failed to update subject" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = requireAdmin(request)
    if (guard) return guard

    const { id } = await params

    // 2026-05-19 副田さん報告 fix: subjects.subject_code を参照する FK が 4 つ
    // (teachers / students / tests / test_sessions) あり、いずれも delete_rule=NO ACTION。
    // 依存があると DELETE は 500 で返るが、旧 UI は理由を表示せず「削除に失敗しました」
    // としか出ないため、副田さんから「削除されない」と報告された。
    // → 削除前に依存件数を集計し、あれば 409 + 詳細メッセージで返す。

    const { data: targetRow, error: targetErr } = await supabase
      .from("subjects")
      .select("subject_code")
      .eq("id", id)
      .maybeSingle()
    if (targetErr) {
      console.error("Error loading subject:", targetErr)
      return NextResponse.json({ error: "Failed to load subject" }, { status: 500 })
    }
    if (!targetRow) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 })
    }
    const subjectCode = (targetRow as { subject_code: string }).subject_code

    const [teacherDep, studentDep, testDep, sessionDep] = await Promise.all([
      supabase.from("teachers").select("id", { count: "exact", head: true }).eq("subject_code", subjectCode),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("subject_code", subjectCode),
      supabase.from("tests").select("id", { count: "exact", head: true }).eq("subject_code", subjectCode),
      supabase.from("test_sessions").select("id", { count: "exact", head: true }).eq("subject_code", subjectCode),
    ])

    const parts: string[] = []
    if ((teacherDep.count ?? 0) > 0) parts.push(`教員 ${teacherDep.count} 名`)
    if ((studentDep.count ?? 0) > 0) parts.push(`学生 ${studentDep.count} 名`)
    if ((testDep.count ?? 0) > 0) parts.push(`テスト ${testDep.count} 件`)
    if ((sessionDep.count ?? 0) > 0) parts.push(`試験セッション ${sessionDep.count} 件`)

    if (parts.length > 0) {
      return NextResponse.json(
        {
          error: `この教科は ${parts.join("、")} で使用されているため削除できません。先に依存先の教科を変更または削除してください。`,
        },
        { status: 409 },
      )
    }

    const { error } = await supabase.from("subjects").delete().eq("id", id)

    if (error) {
      // 念のため race condition (依存が直前で追加された) を 409 でハンドル
      if ((error as { code?: string }).code === "23503") {
        return NextResponse.json(
          { error: "他の行から参照されているため削除できません" },
          { status: 409 },
        )
      }
      console.error("Error deleting subject:", error)
      return NextResponse.json({ error: error.message || "Failed to delete subject" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting subject:", error)
    const msg = error instanceof Error ? error.message : "Failed to delete subject"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
