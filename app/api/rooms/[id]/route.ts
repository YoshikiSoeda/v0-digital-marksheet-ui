import { NextResponse, type NextRequest } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getServiceClient()
  const { data, error } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle()
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const row = data as Record<string, unknown>
  return NextResponse.json({
    item: {
      id: row.id as string,
      roomNumber: row.room_number as string,
      roomName: row.room_name as string,
      createdAt: row.created_at as string,
      universityCode: row.university_code as string | undefined,
      subjectCode: row.subject_code as string | undefined,
      testSessionId: row.test_session_id as string | undefined,
    },
  })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard
  const { id } = await params
  const supabase = getServiceClient()
  const { error } = await supabase.from("rooms").delete().eq("id", id)
  if (error) {
    console.error("[api/rooms/:id] DELETE error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
