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

/**
 * Test の sheets → categories → questions ネスト構造を flat な question 配列に
 * 展開する。各 element に sheet/category のメタ情報を付与する。
 *
 * patient/teacher の同型ループを 1 つに集約。
 *
 * オプション:
 * - dedupByKey: 同じ (sheet, category, question) キーが現れたら 2 回目以降を
 *   読み飛ばす(teacher 側の防御的実装に対応)
 * - addDisplayNumber: 連番 displayNumber を付与する(patient 側の表示用番号)
 */
export interface FlattenedQuestion {
  sheetTitle: string
  categoryTitle: string
  categoryNumber: number
  number: number
  text?: string
  isAlertTarget?: boolean
  alertOptions?: number[]
  // displayNumber は addDisplayNumber=true のときのみ
  displayNumber?: number
  // 元の question の他のフィールドは pass-through で保持
  [extra: string]: unknown
}

export interface FlattenTestOptions {
  dedupByKey?: boolean
  addDisplayNumber?: boolean
}

// Test の型は呼び出し側で多様(@/lib/types の Test, またはさらに緩い any)
// なので、本 utility は最小限の構造的型(MinimalTest)で受け取る。
// caller は必要に応じて as any でキャストして渡す前提。
interface MinimalSheet {
  title: string
  categories?: ReadonlyArray<MinimalCategory>
}
interface MinimalCategory {
  title: string
  number: number
  questions?: ReadonlyArray<unknown>
}
interface MinimalTest {
  sheets?: ReadonlyArray<MinimalSheet>
}

/**
 * EvaluationResult の配列(全件)から、評価者にマッチする行だけを抽出して
 * 学生 ID をキーとする answers / completion / alerts のマップを組み立てる。
 *
 * patient/teacher で同型だった「初期評価状態の組み立てループ」を 1 つに集約。
 * editMode のような role 固有の派生 state は caller 側で computeMaps.completion
 * から導出する想定。
 */
export interface EvaluationMaps {
  answers: Record<string, Record<number, number>>
  completion: Record<string, boolean>
  alerts: Record<string, boolean>
}

interface EvaluationResultLike {
  studentId: string
  evaluatorType?: string | null
  evaluatorId?: string | null
  answers?: Record<number, number> | null
  isCompleted?: boolean | null
  hasAlert?: boolean | null
}

export function buildEvaluationMaps(
  results: ReadonlyArray<EvaluationResultLike> | null | undefined,
  opts: {
    evaluatorType: "teacher" | "patient"
    /** teacher 限定: 同じ部屋の他教員の評価を除外する為の照合 */
    evaluatorEmail?: string
  },
): EvaluationMaps {
  const out: EvaluationMaps = { answers: {}, completion: {}, alerts: {} }
  if (!results || !Array.isArray(results)) return out

  for (const r of results) {
    if (r.evaluatorType !== opts.evaluatorType) continue
    if (opts.evaluatorEmail && r.evaluatorId !== opts.evaluatorEmail) continue
    if (!r.studentId) continue
    out.answers[r.studentId] = r.answers || {}
    out.completion[r.studentId] = r.isCompleted || false
    out.alerts[r.studentId] = r.hasAlert || false
  }
  return out
}

export function flattenTestQuestions(
  test: MinimalTest | null | undefined,
  options: FlattenTestOptions = {},
): FlattenedQuestion[] {
  const out: FlattenedQuestion[] = []
  if (!test?.sheets || !Array.isArray(test.sheets)) return out

  const seen = options.dedupByKey ? new Set<string>() : null
  let displayNumber = 1

  for (const sheet of test.sheets) {
    if (!sheet.categories || !Array.isArray(sheet.categories)) continue
    for (const category of sheet.categories) {
      if (!category.questions || !Array.isArray(category.questions)) continue
      for (const rawQuestion of category.questions) {
        const question = rawQuestion as Record<string, unknown>
        const num = (question.number as number | undefined) ?? 0
        if (seen) {
          const key = `${sheet.title}-${category.number}-${num}`
          if (seen.has(key)) continue
          seen.add(key)
        }
        const flattened: FlattenedQuestion = {
          ...question,
          number: num,
          sheetTitle: sheet.title,
          categoryTitle: category.title,
          categoryNumber: category.number,
        }
        if (options.addDisplayNumber) {
          flattened.displayNumber = displayNumber++
        }
        out.push(flattened)
      }
    }
  }
  return out
}
