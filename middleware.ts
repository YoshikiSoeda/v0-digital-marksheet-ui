import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Phase 7 セキュリティガード:
 * - /api/* と /teacher/* /patient/* に loginInfo Cookie 必須
 * - Cookie が無い/壊れている場合は API は 401、画面は対応するログインへリダイレクト
 *
 * 注意: この Cookie は HttpOnly ではなくクライアント発行のため完全な機密性はない。
 *      Supabase Auth へ移行するまでの暫定ガード。
 *      Row Level Security (Supabase 側)も別途検討すべき。
 */

const PUBLIC_API_PATHS: string[] = [
  // 認証エンドポイント自身は当然認証不要
  "/api/auth/admin/login",
  "/api/auth/teacher/login",
  "/api/auth/patient/login",
  "/api/auth/logout",
  // パスワードリセット (Phase 8c) は未ログインで使う
  "/api/auth/reset-password",
]

const PUBLIC_PAGES_PREFIX = [
  "/admin/login",
  "/teacher/login",
  "/patient/login",
  "/reset-password",
  "/privacy",
  "/terms",
]

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES_PREFIX.some((p) => pathname === p || pathname.startsWith(p))
}

function getLoginRedirect(pathname: string): string {
  if (pathname.startsWith("/teacher/")) return "/teacher/login"
  if (pathname.startsWith("/patient/")) return "/patient/login"
  if (pathname.startsWith("/admin/")) return "/admin/login"
  return "/"
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 静的アセットや Next.js 内部は通す(matcher で大半除外しているが念のため)
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  // API ガード
  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) return NextResponse.next()
    const cookie = request.cookies.get("loginInfo")
    if (!cookie?.value) {
      return NextResponse.json(
        { error: "Unauthorized — login required" },
        { status: 401 },
      )
    }
    try {
      const info = JSON.parse(decodeURIComponent(cookie.value))
      if (!info?.role) {
        return NextResponse.json(
          { error: "Unauthorized — invalid session" },
          { status: 401 },
        )
      }
    } catch {
      return NextResponse.json(
        { error: "Unauthorized — malformed session" },
        { status: 401 },
      )
    }
    return NextResponse.next()
  }

  // 画面ガード(/teacher/* と /patient/* と /admin/*)
  if (
    pathname.startsWith("/teacher/") ||
    pathname.startsWith("/patient/") ||
    pathname.startsWith("/admin/")
  ) {
    if (isPublicPage(pathname)) return NextResponse.next()
    const cookie = request.cookies.get("loginInfo")
    if (!cookie?.value) {
      const url = request.nextUrl.clone()
      url.pathname = getLoginRedirect(pathname)
      return NextResponse.redirect(url)
    }
    try {
      const info = JSON.parse(decodeURIComponent(cookie.value))
      if (!info?.role) {
        const url = request.nextUrl.clone()
        url.pathname = getLoginRedirect(pathname)
        return NextResponse.redirect(url)
      }
    } catch {
      const url = request.nextUrl.clone()
      url.pathname = getLoginRedirect(pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match:
     * - /api/...   (全 API)
     * - /admin/... /teacher/... /patient/...  (画面)
     * 除外: 静的アセット、Next.js 内部、トップページ
     */
    "/api/:path*",
    "/admin/:path*",
    "/teacher/:path*",
    "/patient/:path*",
  ],
}
