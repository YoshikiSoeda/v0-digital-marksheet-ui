"use client"

/**
 * Phase 9d-3: 全 admin 画面に共通の AppShell(ロゴ + ロール表示 + ログアウト)を適用。
 * ADR-001 §2.1「画面シェルは 1 つに」の実装。
 * URL は不変、children に passthrough する。
 */
import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell loginPath="/login">{children}</AppShell>
}
