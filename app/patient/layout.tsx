"use client"

/**
 * Phase 9d-3: 全 patient 画面に共通の AppShell を適用。
 */
import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

export default function PatientLayout({ children }: { children: ReactNode }) {
  return <AppShell loginPath="/login">{children}</AppShell>
}
