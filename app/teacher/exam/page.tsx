"use client"

/**
 * Phase 9b-β2b: sessionStorage("loginInfo") parse を useSession() に置換。
 * HOTFIX-2: selectedTestId を useState の lazy init で同期読込にし、useSession の
 * cache 即時返却に対して redirect が先行する race condition を解消。
 *
 * 2026-05-04: ロール不一致 / 必須情報欠落のとき silent redirect していたのを
 * エラー UI に置換 (admin が「試験選択」から来た場合になぜ login に飛ばされるかが
 * わからなかった問題を解消)。
 *
 * 2026-05-08 (ADR-001 §1.2 F4 部分): patient と共通だったガード処理を
 * useExamPageGuard / ExamErrorScreen に抽出し、本 page は ExamTabs render に
 * 集中する。
 */

import TeacherExamTabs from "@/components/teacher-exam-tabs"
import { useExamPageGuard } from "@/components/exam-page-guard"

// 2026-05-04: 部屋未割当でも全部屋(または自教科の部屋)を任意選択して採点できる「上位教員ロール」
//   - university_admin: 自大学の全部屋
//   - subject_admin:    自教科の全部屋(教科 scope は維持)
const ELEVATED_TEACHER_ROLES = new Set(["university_admin", "subject_admin"])

export default function TeacherExamPage() {
  const guard = useExamPageGuard({
    expectedLoginType: "teacher",
    selectedTestStorageKey: "teacher_selected_test",
    examInfoPath: "/teacher/exam-info",
    roleLabel: "教員",
    requireRoom: true,
    isElevatedRole: (role) => ELEVATED_TEACHER_ROLES.has(role),
  })

  if (guard.kind === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }
  if (guard.kind === "redirect") return null
  if (guard.kind === "error") return guard.render()

  const { session, selectedTestId } = guard
  const isElevated = ELEVATED_TEACHER_ROLES.has(session.role || "")
  const hasRoom = !!session.assignedRoomNumber

  return (
    <TeacherExamTabs
      teacherEmail={session.email!}
      teacherRoomNumber={session.assignedRoomNumber || ""}
      testId={selectedTestId}
      isFlexibleRoom={isElevated && !hasRoom}
      teacherRole={session.role || "general"}
      teacherSubjectCode={session.subjectCode || ""}
      teacherUniversityCode={session.universityCode || ""}
    />
  )
}
