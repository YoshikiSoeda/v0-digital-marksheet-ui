"use client"

/**
 * Phase 9 design refresh: 管理画面の水平ナビゲーションバー。
 * AppShell の下に表示され、admin/* 配下の主要セクションへ常時遷移できるようにする。
 *
 * 表示条件:
 *  - special_master / university_master: 全タブ表示
 *  - subject_admin: ダッシュボード + 問題管理
 *  - その他(general teacher 等): 表示しない(ナビ自体を出さない)
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Layers, Users, FileQuestion, Settings } from "lucide-react"
import { useSession } from "@/lib/auth/use-session"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** マッチさせる pathname プレフィックス(href 単体だけでなく配下も active 判定) */
  matchPrefixes: string[]
  /** 表示する accountType の集合 */
  visibleFor: Set<string>
}

const ALL_ADMIN_ACCOUNTS = new Set(["special_master", "university_master", "subject_admin", "admin"])
const HIGHER_ADMIN_ACCOUNTS = new Set(["special_master", "university_master", "admin"])

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/dashboard",
    label: "ダッシュボード",
    icon: LayoutDashboard,
    matchPrefixes: ["/admin/dashboard"],
    visibleFor: ALL_ADMIN_ACCOUNTS,
  },
  {
    href: "/admin/master-management",
    label: "マスター管理",
    icon: Layers,
    matchPrefixes: [
      "/admin/master-management",
      "/admin/university-management",
      "/admin/room-management",
      "/admin/subject-management",
    ],
    visibleFor: HIGHER_ADMIN_ACCOUNTS,
  },
  {
    href: "/admin/account-management",
    label: "アカウント管理",
    icon: Users,
    matchPrefixes: [
      "/admin/account-management",
      "/admin/users",
      "/admin/teachers-list",
      "/admin/patients-list",
      "/admin/students-list",
      "/admin/students-detail",
      "/admin/register-students",
      "/admin/register-teachers",
      "/admin/register-patients",
    ],
    visibleFor: HIGHER_ADMIN_ACCOUNTS,
  },
  {
    href: "/admin/question-management",
    label: "問題管理",
    icon: FileQuestion,
    matchPrefixes: ["/admin/question-management", "/admin/questions"],
    visibleFor: ALL_ADMIN_ACCOUNTS,
  },
  {
    href: "/admin/settings",
    label: "設定",
    icon: Settings,
    matchPrefixes: ["/admin/settings"],
    visibleFor: HIGHER_ADMIN_ACCOUNTS,
  },
]

function isActive(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

export function AdminTopNav() {
  const pathname = usePathname() || ""
  const { session, isLoading } = useSession()

  if (isLoading || !session) return null
  // 教員ログインからの admin 兼任(subject_admin/university_admin) 含めて表示
  const accountType = session.accountType
  if (!accountType || (!ALL_ADMIN_ACCOUNTS.has(accountType) && !HIGHER_ADMIN_ACCOUNTS.has(accountType))) {
    return null
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.visibleFor.has(accountType))
  if (visibleItems.length === 0) return null

  return (
    <nav className="border-b bg-background sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {visibleItems.map((item) => {
            const active = isActive(pathname, item.matchPrefixes)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors",
                  active
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40",
                ].join(" ")}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
