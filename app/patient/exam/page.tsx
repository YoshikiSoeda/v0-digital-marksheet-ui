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
 * 2026-05-08 (ADR-001 §1.2 F4 部分): teacher と共通だったガード処理を
 * useExamPageGuard / ExamErrorScreen に抽出し、本 page は ExamTabs render に
 * 集中する。
 */

import PatientExamTabs from "@/components/patient-exam-tabs"
import { useExamPageGuard } from "@/components/exam-page-guard"

export default function PatientExamPage() {
  const guard = useExamPageGuard({
    expectedLoginType: "patient",
    selectedTestStorageKey: "patient_selected_test",
    examInfoPath: "/patient/exam-info",
    roleLabel: "患者役",
    requireRoom: false,
  })

  if (guard.kind === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">認証確認中...</p>
      </div>
    )
  }
  if (guard.kind === "redirect") return null
  if (guard.kind === "error") return guard.render()

  return (
    <PatientExamTabs
      patientEmail={guard.session.email!}
      patientRoomNumber={guard.session.assignedRoomNumber!}
      testId={guard.selectedTestId}
    />
  )
}
