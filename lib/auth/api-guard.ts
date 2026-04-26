/**
 * API route 内で使う認可ヘルパー(middleware の二重防御)。
 *
 * middleware で Cookie の存在は確認済みなので、ここではロールベースの認可のみ行う。
 * ただし middleware 設定漏れ時の安全網として、ここでも Cookie が無ければ拒否する。
 */
import { type NextRequest, NextResponse } from "next/server"

const ADMIN_ROLES = new Set([
  "master_admin",
  "university_admin",
  "subject_admin",
  "admin",
  "special_master",
  "university_master",
])

function readLoginInfoFromRequest(request: NextRequest): { role?: string } | null {
  const cookie = request.cookies.get("loginInfo")
  if (!cookie?.value) return null
  try {
    return JSON.parse(decodeURIComponent(cookie.value))
  } catch {
    return null
  }
}

/**
 * Admin 権限を要求する。OK ならば null、NG ならば NextResponse を返す。
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const info = readLoginInfoFromRequest(request)
  if (!info?.role) {
    return NextResponse.json(
      { error: "Unauthorized — login required" },
      { status: 401 },
    )
  }
  if (!ADMIN_ROLES.has(info.role)) {
    return NextResponse.json(
      { error: "Forbidden — admin role required" },
      { status: 403 },
    )
  }
  return null
}
