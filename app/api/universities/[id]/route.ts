import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth/api-guard"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = requireAdmin(request)
    if (guard) return guard

    const { id } = await params
    const body = await request.json()
    const { university_name, department_name } = body

    const { data, error } = await supabase
      .from("universities")
      .update({
        university_name,
        department_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Failed to update university:", error)
    return NextResponse.json({ error: "Failed to update university" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = requireAdmin(request)
    if (guard) return guard

    const { id } = await params

    // 関連データを事前に確認(FK 制約 NO ACTION でブロックされる前にユーザーに案内)
    const { data: univ, error: fetchErr } = await supabase
      .from("universities")
      .select("university_code")
      .eq("id", id)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!univ) {
      return NextResponse.json({ error: "大学が見つかりませんでした" }, { status: 404 })
    }
    const universityCode = (univ as Record<string, unknown>).university_code as string

    const { count: subjectCount } = await supabase
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("university_code", universityCode)

    if ((subjectCount || 0) > 0) {
      return NextResponse.json(
        {
          error: `この大学には ${subjectCount} 件の教科が登録されているため削除できません。先に教科マスター管理から該当教科を削除してください。`,
        },
        { status: 409 },
      )
    }

    const { error } = await supabase.from("universities").delete().eq("id", id)

    if (error) {
      console.error("Failed to delete university:", error)
      return NextResponse.json(
        { error: error.message || "大学の削除に失敗しました" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("Failed to delete university:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
