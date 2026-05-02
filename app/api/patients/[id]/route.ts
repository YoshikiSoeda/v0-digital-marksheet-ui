/**
 * Phase 9c-1: GET /api/patients/[id]
 */
import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getServiceClient()
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle()
  if (error) {
    console.error("[api/patients/:id] error:", error)
    return NextResponse.json({ error: "Failed to load patient" }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const row = data as Record<string, unknown>
  const item = {
    id: row.id as string,
    patientId: row.id as string,
    name: row.name as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as "general",
    assignedRoomNumber: (row.assigned_room_number as string) || "",
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    accountType: row.account_type as "special_master" | "university_master" | "admin" | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: row.test_session_id as string | undefined,
  }
  return NextResponse.json({ item }, { status: 200 })
}
