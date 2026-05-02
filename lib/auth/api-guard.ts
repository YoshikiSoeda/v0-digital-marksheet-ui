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

interface LoginInfo {
  role?: string
  accountType?: string
  subjectCode?: string
  universityCode?: string
}

function readLoginInfoFromRequest(request: NextRequest): LoginInfo | null {
  const cookie = request.cookies.get("loginInfo")
  if (!cookie?.value) return null
  try {
    return JSON.parse(decodeURIComponent(cookie.value)) as LoginInfo
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

/**
 * リクエスト元の subject scope を返す。
 * - subject_admin の場合: そのアカウントの subjectCode を返す(行制限のキー)
 * - それ以外(university_master / special_master など): undefined(無制限)
 *
 * Y-2: subject_admin が他教科の row を作成・更新・削除できないようにする際に使う。
 * 戻り値が undefined の場合はチェック不要、文字列の場合は対象 row の subject_code が
 * 一致しないと拒否(403)。
 */
export function getSubjectScope(request: NextRequest): string | undefined {
  const info = readLoginInfoFromRequest(request)
  if (!info) return undefined
  if (info.accountType === "subject_admin" || info.role === "subject_admin") {
    return info.subjectCode || undefined
  }
  return undefined
}

/**
 * subject_admin が body に含まれる subject_code 値を操作できるかチェックする。
 * - subject_admin かつ body の subject_code が自身の scope と異なる場合、403 を返す
 * - その他のロールは無条件で OK(null を返す)
 */
export function rejectIfOutsideSubjectScope(
  request: NextRequest,
  bodySubjectCodes: Array<string | null | undefined>,
): NextResponse | null {
  const scope = getSubjectScope(request)
  if (!scope) return null // not a subject_admin → no restriction
  for (const code of bodySubjectCodes) {
    if (!code) {
      return NextResponse.json(
        { error: "Forbidden — subject_admin は subject_code 未設定の対象を操作できません" },
        { status: 403 },
      )
    }
    if (code !== scope) {
      return NextResponse.json(
        {
          error: `Forbidden — subject_admin は自教科 (${scope}) の対象のみ操作可能です(対象: ${code})`,
        },
        { status: 403 },
      )
    }
  }
  return null
}
