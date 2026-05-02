"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import TeacherExamTabs from "@/components/teacher-exam-tabs"
import { useSession } from "@/lib/auth/use-session"

/**
 * Phase 9b-β2b: sessionStorage("loginInfo") parse を useSession() に置換。
 *
 * テスト ID(teacher_selected_test)は test-selection-screen で書かれた UI 状態のため
 * sessionStorage から読み続ける(β2 の対象外、UI 状態として残置)。
 */
export default function TeacherExamPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)

  useEffect(() => {
    const id = sessionStorage.getItem("teacher_selected_test")
    setSelectedTestId(id)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    if (typeof window !== "undefined") router.push("/teacher/login")
    return null
  }

  if (session.loginType !== "teacher") {
    // 別ロールがここに到達したら教員ログインへ戻す
    if (typeof window !== "undefined") router.push("/teacher/login")
    return null
  }

  if (!selectedTestId) {
    if (typeof window !== "undefined") router.push("/teacher/exam-info")
    return null
  }

  if (!session.email || !session.assignedRoomNumber) {
    // 必須情報が揃っていない場合(古い cookie)はログインに戻す
    if (typeof window !== "undefined") router.push("/teacher/login")
    return null
  }

  return (
    <TeacherExamTabs
      teacherEmail={session.email}
      teacherRoomNumber={session.assignedRoomNumber}
      testId={selectedTestId}
    />
  )
}
