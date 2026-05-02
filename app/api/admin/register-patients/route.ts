/**
 * Phase 8c: 患者役登録 API
 *
 * - admin 権限必須 (middleware で Cookie チェック + ここで requireAdmin による role 検証)
 * - service role で `register_patients_bulk(p_data jsonb)` RPC を呼ぶ
 * - RPC 内部で平文だけ bcrypt ハッシュ化、既存 bcrypt は据置
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, rejectIfOutsideSubjectScope } from "@/lib/auth/api-guard"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface PatientInput {
  name: string
  email: string
  password: string
  role: string
  assignedRoomNumber?: string
  subjectCode?: string
  universityCode?: string
  accountType?: string
  testSessionId?: string
}

interface RegisterRequestBody {
  patients?: PatientInput[]
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied

  let body: RegisterRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const patients = body.patients
  if (!Array.isArray(patients)) {
    return NextResponse.json(
      { error: "patients (array) is required" },
      { status: 400 },
    )
  }
  if (patients.length === 0) {
    return NextResponse.json({ upserted: 0 }, { status: 200 })
  }

  // Y-2: subject_admin は自教科のみ登録可
  const subjectScopeCheck = rejectIfOutsideSubjectScope(
    request,
    patients.map((p) => p.subjectCode || null),
  )
  if (subjectScopeCheck) return subjectScopeCheck

  const payload = patients.map((p) => ({
    name: p.name,
    email: p.email,
    password: p.password,
    role: p.role,
    assigned_room_number: p.assignedRoomNumber ?? "",
    subject_code: p.subjectCode ?? "",
    university_code: p.universityCode ?? "",
    account_type: p.accountType ?? "",
    test_session_id: p.testSessionId ?? "",
  }))

  for (const [i, p] of payload.entries()) {
    if (!p.name || !p.email || !p.password || !p.role) {
      return NextResponse.json(
        { error: `Row ${i}: name, email, password, role are required` },
        { status: 400 },
      )
    }
  }

  const { data, error } = await supabase.rpc("register_patients_bulk", {
    p_data: payload,
  })
  if (error) {
    console.error("[api/admin/register-patients] RPC error:", error)
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 },
    )
  }

  return NextResponse.json(data, { status: 200 })
}
