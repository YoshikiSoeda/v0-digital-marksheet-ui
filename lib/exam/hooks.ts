"use client"

/**
 * 2026-05-08 (ADR-001 §1.2 F4 Phase A.1):
 * teacher-exam-tabs.tsx と patient-exam-tabs.tsx で 100% 同一だった
 * React フックを抽出。挙動変更ゼロ、純粋な dedup。
 */

import { useState, useEffect, useMemo } from "react"

/**
 * 1 秒ごとに +1 する経過秒数。マウント時にスタート、アンマウント時にクリア。
 * patient/teacher の `setElapsedTime((prev) => prev + 1)` 同型 useEffect を
 * 集約。試験中ヘッダー表示と ExamSessionBanner で使用される。
 */
export function useElapsedTimer(): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return elapsedSeconds
}

/**
 * 入力: flat な questions 配列(各 element は sheetTitle / categoryTitle /
 *      categoryNumber を含む)
 * 出力: sheet → categories → questions の 3 階層にグループ化したもの
 *
 * patient/teacher で全く同じ groupedQuestions 構築ループを 1 つにまとめる。
 * useMemo で questions が変わらない限り再計算しない。
 */
export interface QuestionWithGroupingMeta {
  sheetTitle: string
  categoryTitle: string
  categoryNumber: number
  // 他のフィールド (number, text, isAlertTarget, alertOptions など) は
  // hook 側で気にしない pass-through。caller の型は本 interface を extends しなくてよい。
}

export interface GroupedQuestions<Q extends QuestionWithGroupingMeta> {
  sheetTitle: string
  categories: Array<{
    categoryTitle: string
    categoryNumber: number
    questions: Q[]
  }>
}

export function useGroupedQuestions<Q extends QuestionWithGroupingMeta>(
  questions: Q[],
): GroupedQuestions<Q>[] {
  return useMemo(() => {
    const grouped: GroupedQuestions<Q>[] = []
    for (const question of questions) {
      let sheet = grouped.find((s) => s.sheetTitle === question.sheetTitle)
      if (!sheet) {
        sheet = { sheetTitle: question.sheetTitle, categories: [] }
        grouped.push(sheet)
      }
      let category = sheet.categories.find((c) => c.categoryNumber === question.categoryNumber)
      if (!category) {
        category = {
          categoryTitle: question.categoryTitle,
          categoryNumber: question.categoryNumber,
          questions: [],
        }
        sheet.categories.push(category)
      }
      category.questions.push(question)
    }
    return grouped
  }, [questions])
}
