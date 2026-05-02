"use client"

/**
 * Phase 9b-γ: AppShell — ロール対応ヘッダーの骨格。
 *
 * ADR-001 §2.1 の「画面シェルは 1 つに」を実現する最初の実装。
 * 認証済みページの上部に表示される共通ヘッダー。
 *
 * Phase 9b-γ では「最小先行サンプル」として、master-management ページだけに
 * 適用して本番動作確認を行う。Phase 9d で route group への移行と全画面適用を実施。
 */

import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, LogOut } from "lucide-react"
import { useSession, invalidateSessionCache } from "@/lib/auth/use-session"

interface AppShellProps {
  children: ReactNode
  /** アクセス必須(未ログインなら login にリダイレクト)。デフォルト true */
  requireAuth?: boolean
  /** 未ログイン時の遷移先 */
  loginPath?: string
}

/**
 * ロール → 表示ラベル のマップ。9d で master データに移行する可能性あり。
 */
const ROLE_LABELS: Record<string, string> = {
  master_admin: "システム管理者",
  university_admin: "大学管理者",
  subject_admin: "教科責任者",
  general: "一般",
  admin: "管理者",
  // accountType レベル(歴史的経緯)
  special_master: "システム管理者",
  university_master: "大学管理者",
}

/**
 * ロール → バッジ variant のマップ。
 */
const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  master_admin: "destructive",
  special_master: "destructive",
  university_admin: "default",
  university_master: "default",
  subject_admin: "secondary",
  general: "outline",
  admin: "secondary",
}

function deriveRoleLabel(role: string, accountType: string): string {
  return ROLE_LABELS[role] || ROLE_LABELS[accountType] || role || "ユーザー"
}

function deriveRoleVariant(role: string, accountType: string) {
  return ROLE_BADGE_VARIANT[role] || ROLE_BADGE_VARIANT[accountType] || "outline"
}

export function AppShell({ children, requireAuth = true, loginPath = "/" }: AppShellProps) {
  const router = useRouter()
  const { session, isLoading } = useSession()

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
    } catch {
      // logout API 失敗時も UI 側はキャッシュ破棄してトップへ進む(cookie は HttpOnly だが
      // 万一残っても次の認証 API が新規発行する)
    }
    invalidateSessionCache()
    router.push(loginPath)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary/30">
        <header className="border-b bg-background">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <span className="text-primary font-semibold">OSCE 評価システム</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        </main>
      </div>
    )
  }

  if (requireAuth && !session) {
    if (typeof window !== "undefined") {
      router.push(loginPath)
    }
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <header className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-primary font-semibold text-lg">
              OSCE 評価システム
            </Link>
            {session && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-muted-foreground hover:text-foreground"
                title="一つ前の画面に戻る"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                戻る
              </Button>
            )}
          </div>
          {session && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium leading-tight">
                  {session.userName || "ユーザー"}
                </div>
                <Badge
                  variant={deriveRoleVariant(session.role, session.accountType)}
                  className="text-[10px] px-1.5 py-0 h-4"
                >
                  {deriveRoleLabel(session.role, session.accountType)}
                </Badge>
              </div>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-1.5" />
                ログアウト
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
