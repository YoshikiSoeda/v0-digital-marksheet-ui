/**
 * Phase 8: patient (患者役) ログイン API
 * teacher と同じく複数セッション対応 + bcrypt 照合。
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { attachLoginCookie } from "@/lib/auth/http-cookie"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface LoginRequestBody {
  email?: string
  password?: string
  testSessionId?: string
}

export async function POST(request: NextRequest) {
  let body: LoginRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const email = (body.email || "").trim()
  const password = body.password || ""
  if (!email || !password) {
    return NextResponse.json(
      { error: "患者担当者IDとパスワードを入力してください" },
      { status: 400 },
    )
  }

  const { data, error } = await supabase.rpc("verify_patient_login", {
    p_email: email,
    p_password: password,
  })

  if (error) {
    console.error("[auth/patient] RPC error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  const patients = (data || []) as Array<{
    id: string
    email: string
    name: string
    role: string
    assigned_room_number: string | null
    university_code: string | null
    subject_code: string | null
    test_session_id: string | null
    account_type: string | null
  }>

  if (patients.length === 0) {
    return NextResponse.json(
      { error: "患者担当者IDまたはパスワードが正しくありません" },
      { status: 401 },
    )
  }

  let patient = patients[0]
  if (body.testSessionId) {
    const matched = patients.find((p) => p.test_session_id === body.testSessionId)
    if (matched) patient = matched
  }

  if (patients.length > 1 && !body.testSessionId) {
    return NextResponse.json(
      {
        needsSessionSelection: true,
        sessions: patients.map((p) => ({
          id: p.test_session_id,
          name: p.name,
          assignedRoomNumber: p.assigned_room_number,
          universityCode: p.university_code,
          subjectCode: p.subject_code,
        })),
      },
      { status: 200 },
    )
  }

  const role = patient.role || "general"
  const accountType = role === "admin" ? "admin" : "general"

  const responseBody = {
    patientId: patient.id,
    patientName: patient.name,
    patientEmail: patient.email,
    patientRoom: patient.assigned_room_number || "",
    universityCode: patient.university_code || "dentshowa",
    subjectCode: patient.subject_code || "",
    testSessionId: patient.test_session_id || "",
    userRole: role,
    accountType,
  }
  const response = NextResponse.json(responseBody, { status: 200 })

  attachLoginCookie(response, {
    loginType: "patient",
    role,
    userId: patient.id,
    userName: patient.name,
    universityCode: patient.university_code || "dentshowa",
    subjectCode: patient.subject_code || "",
    testSessionId: patient.test_session_id || "",
    accountType,
  })

  return response
}
