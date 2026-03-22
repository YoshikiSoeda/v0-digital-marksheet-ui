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

    if (!loginInfo) {
      router.push("/teacher/login")
      return
    }

    if (!selectedTestId) {
      router.push("/teacher/exam-info")
      return
    }

    try {
      const info = JSON.parse(loginInfo)

      if (!info.email || !info.assignedRoomNumber) {
        router.push("/teacher/login")
        return
      }

      setTeacherInfo({
        email: info.email,
        roomNumber: info.assignedRoomNumber,
        testId: selectedTestId,
      })
    } catch (error) {
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
