"use client"

import { useRouter } from "next/navigation"
import { SubjectManagement } from "@/components/subject-management"
import { useSession } from "@/lib/auth/use-session"

/**
 * Phase 9b-β2f1: sessionStorage("accountType") を useSession() に置換
 * (β2 の移行漏れ分 — gate のみ機能、認証情報は SubjectManagement 内で再取得)
 */
export default function SubjectManagementPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()

  if (isLoading) return null
  if (!session) {
    if (typeof window !== "undefined") router.push("/admin/login")
    return null
  }

  return <SubjectManagement />
}
