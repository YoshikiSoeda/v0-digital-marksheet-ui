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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard
  try {
    const supabase = getServiceClient()
    const { error } = await supabase.from("test_sessions").delete().eq("id", (await params).id)
    if (error) {
      console.error("[api/test-sessions/:id] DELETE error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
