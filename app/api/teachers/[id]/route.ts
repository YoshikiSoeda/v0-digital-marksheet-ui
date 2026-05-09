/**
 * Phase 9c-1: GET /api/teachers/[id]
 * 2026-05-08 PATCH /api/teachers/[id] を追加: id ベースの単行 UPDATE
 *   (saveTeachers / register_teachers_bulk は ON CONFLICT (univ, email) で
 *    email 変更時に旧行が orphan になる構造的バグがあったため)
 * レスポンス:
 *   GET    200 { item: Teacher } | 404
 *   PATCH  200 { item: Teacher } | 400 / 403 / 404 / 409 / 500
 *   DELETE 204 | 403 / 500
 */
import { NextResponse, type NextRequest } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"
import { getSubjectScope } from "@/lib/auth/api-guard"

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

interface PatchTeacherInput {
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

  let body: PatchTeacherInput
  try {
    body = (await request.json()) as PatchTeacherInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 対象行を読む(404 + Y-2 scope check 用)
  const { data: existing, error: existingErr } = await supabase
    .from("teachers")
    .select("id, subject_code")
    .eq("id", id)
    .maybeSingle()
  if (existingErr) {
    console.error("[api/teachers/:id] PATCH select error:", existingErr)
    return NextResponse.json({ error: "Failed to load teacher" }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Y-2: subject_admin は自教科の row のみ編集可。subject_code 変更時は新値も自教科でなければ拒否。
  const scope = getSubjectScope(request)
  if (scope) {
    const currentCode = (existing as Record<string, unknown>).subject_code as string | undefined
    if (!currentCode || currentCode !== scope) {
      return NextResponse.json(
        { error: `Forbidden — subject_admin は自教科 (${scope}) の教員のみ編集可能です` },
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

  // 提供されたフィールドのみ UPDATE する。
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.email !== undefined) update.email = body.email
  if (body.role !== undefined) update.role = body.role
  if (body.assignedRoomNumber !== undefined) update.assigned_room_number = body.assignedRoomNumber || null
  if (body.universityCode !== undefined) update.university_code = body.universityCode || null
  if (body.subjectCode !== undefined) update.subject_code = body.subjectCode || null
  if (body.accountType !== undefined) update.account_type = body.accountType || null

  // password は空文字 / undefined ならスキップ。値ありなら hash_password_if_plain を経由。
  if (body.password) {
    const { data: hashed, error: hashErr } = await supabase.rpc(
      "hash_password_if_plain" as never,
      { p_password: body.password } as never,
    )
    if (hashErr) {
      console.error("[api/teachers/:id] PATCH hash error:", hashErr)
      return NextResponse.json({ error: "Failed to hash password" }, { status: 500 })
    }
    update.password = hashed as string
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from("teachers")
    .update(update as never)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (updateErr) {
    console.error("[api/teachers/:id] PATCH update error:", updateErr)
    // UNIQUE (university_code, email) 違反時は 409 で返す
    const msg = updateErr.message || ""
    if (updateErr.code === "23505" || msg.includes("teachers_canonical_unique") || msg.includes("duplicate key")) {
      return NextResponse.json(
        { error: "同じ大学に同じ email の教員が既に存在します(university_code + email は一意)" },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: msg || "Failed to update teacher" }, { status: 500 })
  }
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const row = updated as Record<string, unknown>
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
    accountType: row.account_type as string | undefined,
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
      .from("teachers")
      .select("subject_code")
      .eq("id", id)
      .maybeSingle()
    const targetCode = (target as Record<string, unknown> | null)?.subject_code as string | undefined
    if (!targetCode || targetCode !== scope) {
      return NextResponse.json(
        { error: `Forbidden — subject_admin は自教科 (${scope}) の教員のみ削除可能です` },
        { status: 403 },
      )
    }
  }

  const { error } = await supabase.from("teachers").delete().eq("id", id)
  if (error) {
    console.error("[api/teachers/:id] DELETE error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
