/**
 * Phase 8c: 教員登録 API
 *
 * - admin 権限必須 (middleware で Cookie チェック + ここで requireAdmin による role 検証)
 * - service role で `register_teachers_bulk(p_data jsonb)` RPC を呼ぶ
 * - RPC 内部で平文だけ bcrypt ハッシュ化、既存 bcrypt は据置
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth/api-guard"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface TeacherInput {
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
  teachers?: TeacherInput[]
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

  const teachers = body.teachers
  if (!Array.isArray(teachers)) {
    return NextResponse.json(
      { error: "teachers (array) is required" },
      { status: 400 },
    )
  }
  if (teachers.length === 0) {
    return NextResponse.json({ upserted: 0 }, { status: 200 })
  }

  // RPC が受け取る jsonb 配列形式に変換 (snake_case)
  const payload = teachers.map((t) => ({
    name: t.name,
    email: t.email,
    password: t.password,
    role: t.role,
    assigned_room_number: t.assignedRoomNumber ?? "",
    subject_code: t.subjectCode ?? "",
    university_code: t.universityCode ?? "",
    account_type: t.accountType ?? "",
    test_session_id: t.testSessionId ?? "",
  }))

  // 必須項目バリデーション
  for (const [i, p] of payload.entries()) {
    if (!p.name || !p.email || !p.password || !p.role) {
      return NextResponse.json(
        { error: `Row ${i}: name, email, password, role are required` },
        { status: 400 },
      )
    }
  }

  const { data, error } = await supabase.rpc("register_teachers_bulk", {
    p_data: payload,
  })
  if (error) {
    console.error("[api/admin/register-teachers] RPC error:", error)
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 },
    )
  }

  return NextResponse.json(data, { status: 200 })
}
