"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import TeacherExamTabs from "@/components/teacher-exam-tabs"

export default function TeacherExamPage() {
  const router = useRouter()
  const [teacherInfo, setTeacherInfo] = useState<{
    email: string
    roomNumber: string
    testId: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loginInfo = sessionStorage.getItem("loginInfo")
    const selectedTestId = sessionStorage.getItem("teacher_selected_test")

    console.log("[v0] Teacher exam page - loginInfo:", loginInfo)
    console.log("[v0] Teacher exam page - selectedTestId:", selectedTestId)

    if (!loginInfo) {
      console.error("[v0] Missing login info, redirecting to login")
      router.push("/teacher/login")
      return
    }

    if (!selectedTestId) {
      console.error("[v0] No test selected, redirecting to test selection")
      router.push("/teacher/exam-info")
      return
    }

    try {
      const info = JSON.parse(loginInfo)
      console.log("[v0] Parsed teacher info:", info)

      if (!info.email || !info.assignedRoomNumber) {
        console.error("[v0] Missing email or room number in login info")
        router.push("/teacher/login")
        return
      }

      setTeacherInfo({
        email: info.email,
        roomNumber: info.assignedRoomNumber,
        testId: selectedTestId,
      })
    } catch (error) {
      console.error("[v0] Error parsing login info:", error)
      router.push("/teacher/login")
      return
    } finally {
      setIsLoading(false)
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!teacherInfo) {
    return null
  }

  return (
    <TeacherExamTabs
      teacherEmail={teacherInfo.email}
      teacherRoomNumber={teacherInfo.roomNumber}
      testId={teacherInfo.testId}
    />
  )
}
