/**
 * Phase 8: admin ログイン API
 *
 * - admins テーブルから先に検索(verify_admin_login)
 * - 見つからなければ teachers テーブルから admin-role(university_admin/subject_admin/master_admin)を検索
 *   → 管理画面ログインで teacher 兼任 admin もログイン可能
 * - 認証成功時、HttpOnly な loginInfo Cookie を発行(middleware が読む)
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { attachLoginCookie } from "@/lib/auth/http-cookie"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface LoginRequestBody {
  adminId?: string
  password?: string
}

const ADMIN_LIKE_ROLES = new Set(["master_admin", "university_admin", "subject_admin"])

export async function POST(request: NextRequest) {
  let body: LoginRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const adminId = (body.adminId || "").trim()
  const password = body.password || ""
  if (!adminId || !password) {
    return NextResponse.json(
      { error: "管理者IDとパスワードを入力してください" },
      { status: 400 },
    )
  }

  // ediand alias を email に変換(既存仕様の互換)
  const identifier = adminId === "ediand" ? "ediand@system.local" : adminId

  // 1. admins テーブル
  const { data: adminData, error: adminErr } = await supabase.rpc("verify_admin_login", {
    p_identifier: identifier,
    p_password: password,
  })
  if (adminErr) {
    console.error("[auth/admin] admin RPC error:", adminErr)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  const admin = Array.isArray(adminData) ? adminData[0] : adminData
  if (admin) {
    const universityCodes: string[] = admin.university_codes || ["dentshowa"]
    const role: string = admin.role || "master_admin"
    const accountTypeMap: Record<string, string> = {
      master_admin: "special_master",
      university_admin: "university_master",
    }
    const accountType = accountTypeMap[role] || "admin"

    const responseBody = {
      source: "admins" as const,
      userId: admin.id,
      userName: admin.name,
      role,
      accountType,
      universityCodes,
    }
    const response = NextResponse.json(responseBody, { status: 200 })
    attachLoginCookie(response, {
      loginType: "admin",
      role,
      userId: admin.id,
      userName: admin.name,
      universityCodes,
      accountType,
    })
    return response
  }

  // 2. teachers テーブル(admin-like ロールのみ)
  const { data: teacherData, error: teacherErr } = await supabase.rpc("verify_teacher_login", {
    p_email: identifier,
    p_password: password,
  })
  if (teacherErr) {
    console.error("[auth/admin] teacher RPC error:", teacherErr)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
  const teachers = (teacherData || []) as Array<{
    id: string
    email: string
    name: string
    role: string
    assigned_room_number: string | null
    university_code: string | null
    subject_code: string | null
  }>
  const teacherAdmin = teachers.find((t) => ADMIN_LIKE_ROLES.has(t.role))
  if (teacherAdmin) {
    const role = teacherAdmin.role
    const accountTypeMap: Record<string, string> = {
      master_admin: "special_master",
      university_admin: "university_master",
      subject_admin: "subject_admin",
    }
    const accountType = accountTypeMap[role] || "admin"
    const universityCode = teacherAdmin.university_code || "dentshowa"
    const subjectCode = teacherAdmin.subject_code || ""

    const responseBody = {
      source: "teachers" as const,
      userId: teacherAdmin.id,
      userName: teacherAdmin.name,
      teacherEmail: teacherAdmin.email,
      teacherRoom: teacherAdmin.assigned_room_number || "",
      role,
      accountType,
      universityCode,
      universityCodes: [universityCode],
      subjectCode,
    }
    const response = NextResponse.json(responseBody, { status: 200 })
    attachLoginCookie(response, {
      loginType: "admin",
      role,
      userId: teacherAdmin.id,
      userName: teacherAdmin.name,
      universityCode,
      universityCodes: [universityCode],
      subjectCode,
      accountType,
    })
    return response
  }

  return NextResponse.json(
    { error: "管理者IDまたはパスワードが正しくありません" },
    { status: 401 },
  )
}
