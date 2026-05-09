/**
 * 2026-05-08 (ADR-001 §1.2 F4 Phase A.1):
 * teacher-exam-tabs.tsx と patient-exam-tabs.tsx で 100% 同一だった
 * 純粋関数を抽出。挙動変更ゼロ、純粋な dedup。
 */

/**
 * answers (questionNumber → optionValue) の合計点を返す。
 * patient/teacher 共通の素朴 sum。
 */
export function calculateScore(answers: Record<number, number> | undefined): number {
  if (!answers) return 0
  return Object.values(answers).reduce((sum, val) => sum + val, 0)
}

/**
 * test-selection-screen が UI 状態として書く testSessionId を読む。
 * SSR 安全(server 側では空文字を返す)。
 */
export function getTestSessionId(): string {
  if (typeof window === "undefined") return ""
  return sessionStorage.getItem("testSessionId") || ""
}
