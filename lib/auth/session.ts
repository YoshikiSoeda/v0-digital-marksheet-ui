/**
 * Phase 9b-α: 統合セッション読込ヘルパー(Server-side)。
 *
 * RSC / Route handler / Server Action から呼び、HttpOnly Cookie を decode して
 * 型安全な Session オブジェクトを返す。
 *
 * Client 側では useSession() フック(別ファイル `lib/auth/use-session.ts`)で
 * /api/auth/me を叩いて取得する。
 */
import { cookies } from "next/headers"

export type LoginType = "admin" | "teacher" | "patient"

export interface Session {
  loginType: LoginType
  role: string
  userId: string
  userName: string
  email: string
  assignedRoomNumber: string
  universityCode: string
  universityCodes: string[]
  subjectCode: string
  testSessionId: string
  accountType: string
}

const COOKIE_NAME = "loginInfo"

/**
 * Cookie を読んで Session を返す。未ログイン or 壊れた cookie は null。
 *
 * Next.js 15+ の cookies() は async。Next.js 16 の App Router でも同じシグネチャ。
 */
export async function getServerSession(): Promise<Session | null> {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return null
  try {
    const decoded = JSON.parse(decodeURIComponent(raw))
    if (!decoded || typeof decoded !== "object") return null
    const role = typeof decoded.role === "string" ? decoded.role : ""
    if (!role) return null
    return {
      loginType: (decoded.loginType as LoginType) || "admin",
      role,
      userId: typeof decoded.userId === "string" ? decoded.userId : "",
      userName: typeof decoded.userName === "string" ? decoded.userName : "",
      email: typeof decoded.email === "string" ? decoded.email : "",
      assignedRoomNumber: typeof decoded.assignedRoomNumber === "string" ? decoded.assignedRoomNumber : "",
      universityCode: typeof decoded.universityCode === "string" ? decoded.universityCode : "",
      universityCodes: Array.isArray(decoded.universityCodes) ? decoded.universityCodes : [],
      subjectCode: typeof decoded.subjectCode === "string" ? decoded.subjectCode : "",
      testSessionId: typeof decoded.testSessionId === "string" ? decoded.testSessionId : "",
      accountType: typeof decoded.accountType === "string" ? decoded.accountType : "",
    }
  } catch {
    return null
  }
}

/**
 * admin 権限を持つかの判定。
 * special_master / university_master / admin / subject_admin / master_admin / university_admin が対象。
 */
export function hasAdminRole(session: Session | null): boolean {
  if (!session) return false
  const adminRoles = new Set([
    "master_admin",
    "university_admin",
    "subject_admin",
    "admin",
    "special_master",
    "university_master",
  ])
  return adminRoles.has(session.role) || adminRoles.has(session.accountType)
}
