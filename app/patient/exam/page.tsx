"use client"

import { useRouter } from "next/navigation"
import PatientExamTabs from "@/components/patient-exam-tabs"
import { useSession } from "@/lib/auth/use-session"
import { useState } from "react"

/**
 * Phase 9b-β2b: sessionStorage("loginInfo") parse を useSession() に置換。
 * HOTFIX-2: selectedTestId を useState の lazy init で同期読込にし、useSession の
 * cache 即時返却に対して redirect が先行する race condition を解消。
 */
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
    if (typeof window !== "undefined") router.push("/login")
    return null
  }

  if (!selectedTestId) {
    if (typeof window !== "undefined") router.push("/patient/exam-info")
    return null
  }

  if (!session.email || !session.assignedRoomNumber) {
    if (typeof window !== "undefined") router.push("/login")
    return null
  }

  return (
    <PatientExamTabs
      patientEmail={session.email}
      patientRoomNumber={session.assignedRoomNumber}
      testId={selectedTestId}
    />
  )
}
