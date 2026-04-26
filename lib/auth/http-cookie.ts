/**
 * Phase 8: サーバー側で HttpOnly な loginInfo Cookie を発行するヘルパー。
 *
 * 既存の middleware (Phase 7) は loginInfo cookie を読むため、
 * 名前と JSON シェイプはそれと互換に保つ。
 */
import { type NextResponse } from "next/server"

export interface ServerLoginInfo {
  loginType: "admin" | "teacher" | "patient"
  role: string
  userId: string
  userName?: string
  universityCodes?: string[]
  universityCode?: string
  subjectCode?: string
  testSessionId?: string
  accountType?: string
}

const COOKIE_NAME = "loginInfo"
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 時間

export function attachLoginCookie(response: NextResponse, info: ServerLoginInfo): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: JSON.stringify(info),
    httpOnly: true,
    secure: true, // production HTTPS 前提。Vercel でも production/preview 共に HTTPS。
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
  return response
}

export function clearLoginCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}
