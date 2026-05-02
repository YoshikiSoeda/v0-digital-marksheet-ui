/**
 * Phase 9c-1: GET /api/patients/[id]
 */
import { NextResponse, type NextRequest } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"
import { getSubjectScope } from "@/lib/auth/api-guard"

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard
  const { id } = await params
  const supabase = getServiceClient()

  // Y-2: subject_admin は自教科の row のみ削除可
  const scope = getSubjectScope(request)
  if (scope) {
    const { data: target } = await supabase
      .from("patients")
      .select("subject_code")
      .eq("id", id)
      .maybeSingle()
    const targetCode = (target as Record<string, unknown> | null)?.subject_code as string | undefined
    if (!targetCode || targetCode !== scope) {
      return NextResponse.json(
        { error: `Forbidden — subject_admin は自教科 (${scope}) の患者役のみ削除可能です` },
        { status: 403 },
      )
    }
  }

  const { error } = await supabase.from("patients").delete().eq("id", id)
  if (error) {
    console.error("[api/patients/:id] DELETE error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
