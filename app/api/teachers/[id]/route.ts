/**
 * Phase 9c-1: GET /api/teachers/[id]
 * レスポンス: 200 { item: Teacher } | 404
 */
import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getServiceClient()
  const { data, error } = await supabase.from("teachers").select("*").eq("id", id).maybeSingle()
  if (error) {
    console.error("[api/teachers/:id] error:", error)
    return NextResponse.json({ error: "Failed to load teacher" }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const row = data as Record<string, unknown>
  const item = {
    id: row.id as string,
    teacherId: row.id as string,
    name: row.name as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as string,
    assignedRoomNumber: (row.assigned_room_number as string) || "",
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }
  return NextResponse.json({ item }, { status: 200 })
}
