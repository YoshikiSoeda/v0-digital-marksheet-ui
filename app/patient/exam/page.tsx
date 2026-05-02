"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import PatientExamTabs from "@/components/patient-exam-tabs"
import { useSession } from "@/lib/auth/use-session"

/**
 * Phase 9b-β2b: sessionStorage("loginInfo") parse を useSession() に置換。
 *
 * テスト ID(patient_selected_test)は test-selection-screen で書かれた UI 状態のため
 * sessionStorage から読み続ける。
 */
export default function PatientExamPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)

  useEffect(() => {
    const id = sessionStorage.getItem("patient_selected_test")
    setSelectedTestId(id)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">認証確認中...</p>
      </div>
    )
  }

  if (!session) {
    if (typeof window !== "undefined") router.push("/patient/login")
    return null
  }

  if (session.loginType !== "patient") {
    if (typeof window !== "undefined") router.push("/patient/login")
    return null
  }

  if (!selectedTestId) {
    if (typeof window !== "undefined") router.push("/patient/exam-info")
    return null
  }

  if (!session.email || !session.assignedRoomNumber) {
    if (typeof window !== "undefined") router.push("/patient/login")
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
