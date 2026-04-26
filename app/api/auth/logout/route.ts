/**
 * Phase 8: logout API
 * - HttpOnly cookie をクリア
 * - sessionStorage はクライアント側で別途クリアする(これは API では触れない)
 */
import { NextResponse } from "next/server"
import { clearLoginCookie } from "@/lib/auth/http-cookie"

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 })
  clearLoginCookie(response)
  return response
}
