"use client"

import { useRouter } from "next/navigation"
import PatientExamTabs from "@/components/patient-exam-tabs"
import { useSession } from "@/lib/auth/use-session"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

/**
 * Phase 9b-β2b: sessionStorage("loginInfo") parse を useSession() に置換。
 * HOTFIX-2: selectedTestId を useState の lazy init で同期読込にし、useSession の
 * cache 即時返却に対して redirect が先行する race condition を解消。
 *
 * 2026-05-04: ロール不一致 / 必須情報欠落のとき silent redirect していたのを
 * エラー UI に置換 (admin が「試験選択」から来た場合になぜ login に飛ばされるかが
 * わからなかった問題を解消)。
 */

const ADMIN_ROLES = new Set([
  "master_admin",
  "university_admin",
  "subject_admin",
  "admin",
  "special_master",
  "university_master",
])

interface ExamErrorScreenProps {
  title: string
  message: string
  primaryLabel: string
  primaryAction: () => void
  secondaryLabel?: string
  secondaryAction?: () => void
}

function ExamErrorScreen({
  title,
  message,
  primaryLabel,
  primaryAction,
  secondaryLabel,
  secondaryAction,
}: ExamErrorScreenProps) {
  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-lg p-6 space-y-4 text-center shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={primaryAction}>{primaryLabel}</Button>
          {secondaryLabel && secondaryAction && (
            <Button variant="outline" onClick={secondaryAction}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PatientExamPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()
  const [selectedTestId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem("patient_selected_test")
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">認証確認中...</p>
      </div>
    )
  }

  if (!session) {
    if (typeof window !== "undefined") router.push("/login")
    return null
  }

  if (session.loginType !== "patient") {
    const isAdmin =
      ADMIN_ROLES.has(session.role) || ADMIN_ROLES.has(session.accountType) || session.loginType === "admin"
    return (
      <ExamErrorScreen
        title="この画面は患者役専用です"
        message={
          isAdmin
            ? "管理者アカウントでは試験の実施・採点はできません。\n試験を実施するには患者役アカウントでログインしてください。"
            : "患者役アカウントでログインしてからアクセスしてください。"
        }
        primaryLabel={isAdmin ? "管理画面に戻る" : "ログイン画面へ"}
        primaryAction={() => router.push(isAdmin ? "/admin/dashboard" : "/login")}
        secondaryLabel={isAdmin ? "ログイン画面へ" : undefined}
        secondaryAction={isAdmin ? () => router.push("/login") : undefined}
      />
    )
  }

  if (!selectedTestId) {
    if (typeof window !== "undefined") router.push("/patient/exam-info")
    return null
  }

  if (!session.email || !session.assignedRoomNumber) {
    return (
      <ExamErrorScreen
        title="セッション情報が不完全です"
        message={
          "患者役のメールアドレスまたは担当部屋番号が取得できませんでした。\n一度ログアウトして再度ログインしてください。"
        }
        primaryLabel="ログイン画面へ"
        primaryAction={() => router.push("/login")}
      />
    )
  }

  return (
    <PatientExamTabs
      patientEmail={session.email}
      patientRoomNumber={session.assignedRoomNumber}
      testId={selectedTestId}
    />
  )
}
