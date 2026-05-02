/**
 * Phase 9c-1: GET /api/students/[id]
 */
import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getServiceClient()
  const { data, error } = await supabase.from("students").select("*").eq("id", id).maybeSingle()
  if (error) {
    console.error("[api/students/:id] error:", error)
    return NextResponse.json({ error: "Failed to load student" }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const row = data as Record<string, unknown>
  const item = {
    id: row.id as string,
    studentId: row.student_id as string,
    name: row.name as string,
    email: row.email as string | undefined,
    department: row.department as string | undefined,
    roomNumber: (row.room_number as string) || "",
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }
  return NextResponse.json({ item }, { status: 200 })
}
