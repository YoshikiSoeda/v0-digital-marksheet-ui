/**
 * クライアント側で loginInfo を Cookie に書き込み/削除するヘルパー。
 *
 * 設計判断:
 * - middleware から認証情報を読めるようにするため Cookie に格納する。
 * - HttpOnly は付与しない(クライアント側で発行するため不可)。完全な機密性は犠牲だが、
 *   現状の sessionStorage 方式と同等のセキュリティ層に留め、middleware ガードを成立させる。
 * - 将来 Supabase Auth へ移行する際は、サーバーが HttpOnly Cookie を発行する形に置き換える。
 */

export interface LoginInfoCookie {
  loginType: "admin" | "teacher" | "patient"
  role: string
  userId?: string
  userName?: string
  universityCodes?: string[]
  universityCode?: string
  subjectCode?: string
}

const COOKIE_NAME = "loginInfo"
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12時間

export function setLoginCookie(info: LoginInfoCookie): void {
  if (typeof document === "undefined") return
  const value = encodeURIComponent(JSON.stringify(info))
  // SameSite=Lax で CSRF を一定軽減、Secure は本番(HTTPS)前提
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:"
  const secureFlag = isSecure ? "; Secure" : ""
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`
}

export function clearLoginCookie(): void {
  if (typeof document === "undefined") return
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function readLoginCookie(): LoginInfoCookie | null {
  if (typeof document === "undefined") return null
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match.split("=")[1]))
  } catch {
    return null
  }
}
