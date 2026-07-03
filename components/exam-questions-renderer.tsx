"use client"

/**
 * 2026-05-08 (ADR-001 §1.2 F4 Phase B.1):
 * teacher-exam-tabs.tsx と patient-exam-tabs.tsx で完全に同一だった
 * 「sheet → category → question 行 → 5 段階評価ボタン」の描画ブロックを
 * 共通コンポーネントとして抽出。
 *
 * 挙動変更ゼロ:
 *  - 入力 disabled の判定は caller 側で計算 (teacher は editMode を考慮、
 *    patient は completion 単体) し、prop で渡す
 *  - onAnswer は caller の handleAnswerChange を直接渡す
 */

import { Button } from "@/components/ui/button"
import type { GroupedQuestions, QuestionWithGroupingMeta } from "@/lib/exam/hooks"

// 描画に必要な question フィールド
interface RenderableQuestion extends QuestionWithGroupingMeta {
  number: number
  text?: string
  isAlertTarget?: boolean
  alertOptions?: number[]
}

interface ExamQuestionsRendererProps {
  groupedQuestions: GroupedQuestions<RenderableQuestion>[]
  /** 2026-07-03: compositeKey (`${categoryNumber}-${questionNumber}`) → optionValue */
  answers: Record<string, number>
  /** 入力ボタンを無効化するか(完了済み or 編集モード OFF) */
  inputDisabled: boolean
  /** 出席状態が present でない場合は入力不可 */
  attendancePresent: boolean
  /** ボタンクリック時のハンドラ (compositeKey を渡す) */
  onAnswer: (compositeKey: string, optionValue: number) => void
}

export function ExamQuestionsRenderer({
  groupedQuestions,
  answers,
  inputDisabled,
  attendancePresent,
  onAnswer,
}: ExamQuestionsRendererProps) {
  return (
    <>
      {groupedQuestions.map((sheet) => (
        <div key={sheet.sheetTitle} className="space-y-3">
          <div className="bg-muted px-4 py-3 rounded">
            <span className="font-medium">{sheet.sheetTitle}</span>
          </div>

          {sheet.categories.map((category) => (
            <div key={category.categoryNumber} className="space-y-3">
              <div className="px-4">
                <p className="text-sm font-semibold">{category.categoryTitle}</p>
              </div>

              <div className="space-y-1 px-4">
                {category.questions.map((question) => {
                  // 2026-07-03 副田さんバグ報告: カテゴリ跨ぎ同期を防ぐため compositeKey で参照
                  const compositeKey = `${category.categoryNumber}-${question.number}`
                  const selectedOption = answers[compositeKey]
                  const isAlertTarget = question.isAlertTarget

                  return (
                    <div
                      key={compositeKey}
                      className="flex items-center gap-4 py-2 border-b border-gray-200/40"
                    >
                      <div className="flex-shrink-0 w-8 text-sm font-medium text-muted-foreground">
                        {question.number}
                      </div>

                      <div className="flex-1 min-w-0 text-sm">
                        {question.text}
                        {isAlertTarget && (
                          <span className="ml-2 text-xs text-red-600 font-medium">
                            (アラート対象: {question.alertOptions?.join(",")})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {[1, 2, 3, 4, 5].map((option) => (
                          <Button
                            key={option}
                            variant={selectedOption === option ? "default" : "outline"}
                            size="sm"
                            className="w-10 h-10 p-0 text-sm rounded-md"
                            onClick={() => onAnswer(compositeKey, option)}
                            disabled={inputDisabled || !attendancePresent}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
