"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import PatientExamTabs from "@/components/patient-exam-tabs"

export default function PatientExamPage() {
  const router = useRouter()
  const [loginInfo, setLoginInfo] = useState<{ email: string; assignedRoomNumber: string } | null>(null)
  const [testId, setTestId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedLoginInfo = sessionStorage.getItem("loginInfo")
    const storedTestId = sessionStorage.getItem("patient_selected_test")

    console.log("[v0] Patient exam page - loginInfo:", storedLoginInfo)
    console.log("[v0] Patient exam page - selectedTestId:", storedTestId)

    if (!storedLoginInfo) {
      console.log("[v0] No login info, redirecting to login")
      router.push("/patient/login")
      return
    }

    const info = JSON.parse(storedLoginInfo)

    if (!info.email || !info.assignedRoomNumber) {
      console.log("[v0] Incomplete login info, redirecting to login")
      router.push("/patient/login")
      return
    }

    if (!storedTestId) {
      console.log("[v0] No test selected, redirecting to test selection")
      router.push("/patient/exam-info")
      return
    }

    setLoginInfo(info)
    setTestId(storedTestId)
    setIsLoading(false)
  }, [router])

  if (isLoading || !loginInfo || !testId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">認証確認中...</p>
      </div>
    )
  }

  return (
    <PatientExamTabs patientEmail={loginInfo.email} patientRoomNumber={loginInfo.assignedRoomNumber} testId={testId} />
  )
}
