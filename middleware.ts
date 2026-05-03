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
 *
 * ADR-005 hotfix #57 後追い: /admin/* は admin 権限ロールのみアクセス可能に絞る。
 * 一般教員・患者役は /admin/* に到達できない (api-guard.ts ADMIN_ROLES と同じセット)。
 */

// /admin/* に入れる role の集合 (api-guard.ts ADMIN_ROLES と同期)
const ADMIN_ROLES = new Set([
  "master_admin",
  "university_admin",
  "subject_admin",
  "admin",
  "special_master",
  "university_master",
])

const PUBLIC_API_PATHS: string[] = [
  // 認証エンドポイント自身は当然認証不要
  // 統合ログイン (Phase 9b-α)
  "/api/auth/login",
  "/api/auth/logout",
  // パスワードリセット (Phase 8c) は未ログインで使う
  "/api/auth/reset-password",
]

const PUBLIC_PAGES_PREFIX = [
  // Phase 9d-1: 共通ログイン
  "/login",
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

function getLoginRedirect(_pathname: string): string {
  // Phase 9d-cleanup-1: ログインは /login に統一
  return "/login"
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
      // ADR-005 hotfix #57 後追い: /admin/* は admin 権限のみ。
      // 一般教員 (role="general") / 患者役 (role="general") を弾き、各々の通常画面へ戻す。
      if (pathname.startsWith("/admin/")) {
        const role = String(info.role || "")
        const accountType = String(info.accountType || "")
        const isAdmin = ADMIN_ROLES.has(role) || ADMIN_ROLES.has(accountType)
        if (!isAdmin) {
          const url = request.nextUrl.clone()
          // 教員/患者は各自の試験情報画面へ、それ以外はログインへ
          if (info.loginType === "teacher") {
            url.pathname = "/teacher/exam-info"
          } else if (info.loginType === "patient") {
            url.pathname = "/patient/exam-info"
          } else {
            url.pathname = "/login"
          }
          return NextResponse.redirect(url)
        }
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

