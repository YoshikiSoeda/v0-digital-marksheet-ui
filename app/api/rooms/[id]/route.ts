import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"

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
