/**
 * ADR-006: 合格判定の % 化共通ロジック。
 *
 * 旧実装は test_sessions.passing_score を絶対点として扱っていたが、
 * 設問数の増減で意味が変わる問題があった。本モジュールでは
 *   pct = (combinedScore / combinedMax) * 100
 *   passResult = pct >= passingScore ? "合格" : "不合格"
 * という % 判定に統一する。
 *
 * combinedMax は exam_results.max_score (= 設問数 × 5) の合算。
 * max_score が NULL の行 (レガシー / 未保存) があれば判定をスキップする
 * (= passResult: "")。
 */

export interface EvalForPassing {
  totalScore?: number | null
  maxScore?: number | null
  isCompleted?: boolean | null
  evaluatorType?: "teacher" | "patient" | null
}

export type PassResult = "合格" | "不合格" | ""

export interface ComputePassResultParams {
  /** 当該学生の全 evaluation_results 行(教員 + 患者) */
  evaluations: EvalForPassing[]
  /** test_sessions.passing_score (% しきい値, 0–100) */
  passingScore: number | null | undefined
}

export interface PassResultDetail {
  /** "合格" | "不合格" | "" (判定不能) */
  result: PassResult
  /** 合計取得点 */
  combinedScore: number
  /** 合計上限 (NULL 行があれば 0) */
  combinedMax: number
  /** 取得 % (combinedMax 0 のとき NaN) */
  percentage: number | null
}

/**
 * % ベースの合格判定を返す。
 *
 * - 完了済み (is_completed=true) の評価のみを対象
 * - max_score が NULL の行が含まれていれば、その行を除外せずに combinedMax にカウントできない
 *   ため、判定全体をスキップして "" を返す(レガシー行混在時の安全側)
 * - passingScore が NULL/0 の場合も "" (基準未設定)
 */
export function computePassResult({
  evaluations,
  passingScore,
}: ComputePassResultParams): PassResultDetail {
  const completed = evaluations.filter((e) => e.isCompleted)
  const combinedScore = completed.reduce((sum, e) => sum + (e.totalScore || 0), 0)

  // max_score が 1 件でも NULL なら判定不能
  const hasNullMax = completed.some((e) => e.maxScore == null)
  const combinedMax = hasNullMax ? 0 : completed.reduce((sum, e) => sum + (e.maxScore || 0), 0)

  if (passingScore == null || passingScore <= 0 || completed.length === 0 || combinedMax === 0) {
    return { result: "", combinedScore, combinedMax, percentage: null }
  }

  const pct = (combinedScore / combinedMax) * 100
  const result: PassResult = pct >= passingScore ? "合格" : "不合格"
  return { result, combinedScore, combinedMax, percentage: pct }
}
