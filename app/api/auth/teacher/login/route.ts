/**
 * Phase 8: teacher ログイン API
 * - verify_teacher_login() RPC で bcrypt 照合
 * - 教員は同じ email で複数 test_session_id に紐づく場合がある(既存仕様)
 *   → RPC は配列を返す。session 選択 UI は呼び出し側で実装。
 * - 単一セッションの場合は HttpOnly Cookie を即発行。
 *   複数セッションの場合は仮ログインデータをレスポンスし、後段で /api/auth/teacher/select-session を呼ぶ運用にする。
 *   → 本セッションでは「最初の 1 件で代表」とする簡易実装。複数セッションは将来課題。
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
  testSessionId?: string // 複数セッション持ちの場合、ユーザーが選んだセッションを指定
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
      { error: "IDとパスワードを入力してください" },
      { status: 400 },
    )
  }

  const { data, error } = await supabase.rpc("verify_teacher_login", {
    p_email: email,
    p_password: password,
  })

  if (error) {
    console.error("[auth/teacher] RPC error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  const teachers = (data || []) as Array<{
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

  if (teachers.length === 0) {
    return NextResponse.json(
      { error: "IDまたはパスワードが正しくありません" },
      { status: 401 },
    )
  }

  // testSessionId が指定されていればそれにマッチする 1 件を選ぶ
  let teacher = teachers[0]
  if (body.testSessionId) {
    const matched = teachers.find((t) => t.test_session_id === body.testSessionId)
    if (matched) teacher = matched
  }

  // 複数セッション持ちで testSessionId 未指定の場合は、選択候補を返してログイン未完了とする
  if (teachers.length > 1 && !body.testSessionId) {
    return NextResponse.json(
      {
        needsSessionSelection: true,
        sessions: teachers.map((t) => ({
          id: t.test_session_id,
          name: t.name,
          assignedRoomNumber: t.assigned_room_number,
          universityCode: t.university_code,
          subjectCode: t.subject_code,
        })),
      },
      { status: 200 },
    )
  }

  const role = teacher.role || "general"
  const accountTypeMap: Record<string, string> = {
    master_admin: "special_master",
    university_admin: "university_master",
    subject_admin: "subject_admin",
    general: "general",
  }
  const accountType = accountTypeMap[role] || "general"

  const responseBody = {
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherEmail: teacher.email,
    teacherRole: role,
    teacherRoom: teacher.assigned_room_number || "",
    universityCode: teacher.university_code || "dentshowa",
    subjectCode: teacher.subject_code || "",
    testSessionId: teacher.test_session_id || "",
    accountType,
  }
  const response = NextResponse.json(responseBody, { status: 200 })

  attachLoginCookie(response, {
    loginType: "teacher",
    role,
    userId: teacher.id,
    userName: teacher.name,
    universityCode: teacher.university_code || "dentshowa",
    subjectCode: teacher.subject_code || "",
    testSessionId: teacher.test_session_id || "",
    accountType,
  })

  return response
}
