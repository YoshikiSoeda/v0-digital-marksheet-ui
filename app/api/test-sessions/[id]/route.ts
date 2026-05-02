import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-guard"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = requireAdmin(request)
    if (guard) return guard

    const supabase = await createClient()
    const body = await request.json()

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (body.test_date !== undefined) updateData.test_date = body.test_date
    if (body.description !== undefined) updateData.description = body.description
    if (body.university_code !== undefined) updateData.university_code = body.university_code
    if (body.passing_score !== undefined) updateData.passing_score = body.passing_score ?? null
    if (body.status !== undefined) updateData.status = body.status

    const { data, error } = await supabase
      .from("test_sessions")
      .update(updateData)
      .eq("id", (await params).id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = requireAdmin(request)
    if (guard) return guard

    const supabase = await createClient()

    const { error } = await supabase.from("test_sessions").delete().eq("id", (await params).id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
