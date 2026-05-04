"use client"

import { useRouter } from "next/navigation"
import TeacherExamTabs from "@/components/teacher-exam-tabs"
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
 *
 * テスト ID(teacher_selected_test)は test-selection-screen で書かれた UI 状態のため
 * sessionStorage から読み続ける(β2 の対象外、UI 状態として残置)。
 */

const ADMIN_ROLES = new Set([
  "master_admin",
  "university_admin",
  "subject_admin",
  "admin",
  "special_master",
  "university_master",
])

// 2026-05-04: 部屋未割当でも全部屋(または自教科の部屋)を任意選択して採点できる「上位教員ロール」
//   - university_admin: 自大学の全部屋
//   - subject_admin:    自教科の全部屋(教科 scope は維持)
const ELEVATED_TEACHER_ROLES = new Set(["university_admin", "subject_admin"])

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

export default function TeacherExamPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()
  // HOTFIX-2: 同期読込で redirect 先行を防ぐ
  const [selectedTestId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem("teacher_selected_test")
  })

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
    if (typeof window !== "undefined") router.push("/login")
    return null
  }

  // ロール不一致(admin / patient など)→ エラー UI 表示
  if (session.loginType !== "teacher") {
    const isAdmin =
      ADMIN_ROLES.has(session.role) || ADMIN_ROLES.has(session.accountType) || session.loginType === "admin"
    return (
      <ExamErrorScreen
        title="この画面は教員専用です"
        message={
          isAdmin
            ? "管理者アカウントでは試験の実施・採点はできません。\n試験を実施するには教員アカウントでログインしてください。"
            : "教員アカウントでログインしてからアクセスしてください。"
        }
        primaryLabel={isAdmin ? "管理画面に戻る" : "ログイン画面へ"}
        primaryAction={() => router.push(isAdmin ? "/admin/dashboard" : "/login")}
        secondaryLabel={isAdmin ? "ログイン画面へ" : undefined}
        secondaryAction={isAdmin ? () => router.push("/login") : undefined}
      />
    )
  }

  if (!selectedTestId) {
    if (typeof window !== "undefined") router.push("/teacher/exam-info")
    return null
  }

  // メール欠落は誰であっても採点不能
  if (!session.email) {
    return (
      <ExamErrorScreen
        title="セッション情報が不完全です"
        message={"教員のメールアドレスが取得できませんでした。\n一度ログアウトして再度ログインしてください。"}
        primaryLabel="ログイン画面へ"
        primaryAction={() => router.push("/login")}
      />
    )
  }

  // 部屋未割当: ELEVATED ロール (university_admin / subject_admin) は任意の部屋を選べる
  // 一般教員 (general) は担当部屋の割り当てが必須
  const isElevated = ELEVATED_TEACHER_ROLES.has(session.role || "")
  const hasRoom = !!session.assignedRoomNumber

  if (!hasRoom && !isElevated) {
    return (
      <ExamErrorScreen
        title="担当部屋が未割当です"
        message={"あなたのアカウントには担当部屋が割り当てられていません。\n管理者に連絡して担当部屋を設定してもらってください。"}
        primaryLabel="ログイン画面へ"
        primaryAction={() => router.push("/login")}
      />
    )
  }

  return (
    <TeacherExamTabs
      teacherEmail={session.email}
      teacherRoomNumber={session.assignedRoomNumber || ""}
      testId={selectedTestId}
      isFlexibleRoom={isElevated && !hasRoom}
      teacherRole={session.role || "general"}
      teacherSubjectCode={session.subjectCode || ""}
      teacherUniversityCode={session.universityCode || ""}
    />
  )
}
