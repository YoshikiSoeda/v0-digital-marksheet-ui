/**
 * Phase 9c-1: GET /api/patients/[id]
 * 2026-05-08 PATCH /api/patients/[id] を追加: id ベースの単行 UPDATE
 *   (savePatients / register_patients_bulk は ON CONFLICT (univ, email) で
 *    email 変更時に旧行が orphan になる構造的バグがあったため)
 * レスポンス:
 *   GET    200 { item: Patient } | 404
 *   PATCH  200 { item: Patient } | 400 / 403 / 404 / 409 / 500
 *   DELETE 204 | 403 / 500
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

interface PatchPatientInput {
  name?: string
  email?: string
  password?: string
  role?: string
  assignedRoomNumber?: string
  universityCode?: string
  subjectCode?: string
  accountType?: string
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard
  const { id } = await params
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  let body: PatchPatientInput
  try {
    body = (await request.json()) as PatchPatientInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const supabase = getServiceClient()

  const { data: existing, error: existingErr } = await supabase
    .from("patients")
    .select("id, subject_code")
    .eq("id", id)
    .maybeSingle()
  if (existingErr) {
    console.error("[api/patients/:id] PATCH select error:", existingErr)
    return NextResponse.json({ error: "Failed to load patient" }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Y-2: subject_admin は自教科のみ編集可
  const scope = getSubjectScope(request)
  if (scope) {
    const currentCode = (existing as Record<string, unknown>).subject_code as string | undefined
    if (!currentCode || currentCode !== scope) {
      return NextResponse.json(
        { error: `Forbidden — subject_admin は自教科 (${scope}) の患者役のみ編集可能です` },
        { status: 403 },
      )
    }
    if (body.subjectCode !== undefined && body.subjectCode !== scope) {
      return NextResponse.json(
        { error: `Forbidden — subject_admin は subject_code を自教科 (${scope}) 以外に変更できません` },
        { status: 403 },
      )
    }
  }

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.email !== undefined) update.email = body.email
  if (body.role !== undefined) update.role = body.role
  if (body.assignedRoomNumber !== undefined) update.assigned_room_number = body.assignedRoomNumber || null
  if (body.universityCode !== undefined) update.university_code = body.universityCode || null
  if (body.subjectCode !== undefined) update.subject_code = body.subjectCode || null
  if (body.accountType !== undefined) update.account_type = body.accountType || null

  if (body.password) {
    const { data: hashed, error: hashErr } = await supabase.rpc(
      "hash_password_if_plain" as never,
      { p_password: body.password } as never,
    )
    if (hashErr) {
      console.error("[api/patients/:id] PATCH hash error:", hashErr)
      return NextResponse.json({ error: "Failed to hash password" }, { status: 500 })
    }
    update.password = hashed as string
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from("patients")
    .update(update as never)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (updateErr) {
    console.error("[api/patients/:id] PATCH update error:", updateErr)
    const msg = updateErr.message || ""
    if (updateErr.code === "23505" || msg.includes("patients_canonical_unique") || msg.includes("duplicate key")) {
      return NextResponse.json(
        { error: "同じ大学に同じ email の患者役が既に存在します(university_code + email は一意)" },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: msg || "Failed to update patient" }, { status: 500 })
  }
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const row = updated as Record<string, unknown>
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
