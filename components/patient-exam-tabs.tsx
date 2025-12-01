"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  type Student,
  type AttendanceRecord,
  type EvaluationResult,
  type Test,
  loadTests,
  loadStudents,
  loadRooms,
  loadAttendanceRecords,
  loadEvaluationResults,
  saveAttendanceRecords,
  saveEvaluationResults,
} from "@/lib/data-storage"
import type { Question } from "@/lib/types" // Declare the Question variable

interface PatientExamTabsProps {
  patientEmail: string
  patientRoomNumber: string
  testId: string
  patientName: string
  elapsedTime: number
}

interface Answer {
  [key: number]: number
}

interface QuestionWithMeta extends Question {
  // Use the declared Question type instead of any
  sheetTitle: string
  categoryTitle: string
  categoryNumber: number
  displayNumber: number
}

export default function PatientExamTabs({
  patientEmail,
  patientRoomNumber,
  testId,
  patientName,
  elapsedTime,
}: PatientExamTabsProps) {
  const router = useRouter()
  const [selectedTest, setSelectedTest] = useState<Test | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [assignedStudents, setAssignedStudents] = useState<Student[]>([])
  const [activeStudentIndex, setActiveStudentIndex] = useState(0)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, Record<number, number>>>({})
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, "present" | "absent" | "pending">>({})
  const [completionStatus, setCompletionStatus] = useState<Record<string, boolean>>({})
  const [questions, setQuestions] = useState<QuestionWithMeta[]>([])
  const [alertTriggers, setAlertTriggers] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [testsData, roomsData, attendanceData, resultsData] = await Promise.all([
          loadTests(),
          loadRooms(),
          loadAttendanceRecords(),
          loadEvaluationResults(),
        ])

        if (!Array.isArray(testsData)) {
          console.error("[v0] Tests is not an array:", testsData)
          router.push("/patient/exam-info")
          return
        }

        const test = testsData.find((t) => t.id === testId)
        if (!test) {
          console.error("[v0] Test not found")
          router.push("/patient/exam-info")
          return
        }

        if (!test.sheets || !Array.isArray(test.sheets)) {
          console.error("[v0] Test sheets is not valid:", test)
          router.push("/patient/exam-info")
          return
        }

        setSelectedTest(test)

        const flatQuestions: QuestionWithMeta[] = []
        let displayNumber = 1

        test.sheets.forEach((sheet) => {
          if (!sheet.categories || !Array.isArray(sheet.categories)) return

          sheet.categories.forEach((category) => {
            if (!category.questions || !Array.isArray(category.questions)) return

            category.questions.forEach((question) => {
              flatQuestions.push({
                ...question,
                sheetTitle: sheet.title,
                categoryTitle: category.title,
                categoryNumber: category.number,
                displayNumber: displayNumber++,
              })
            })
          })
        })

        setQuestions(flatQuestions)

        let students: any[] = []
        try {
          const loadedStudents = await loadStudents(patientRoomNumber)

          if (!Array.isArray(loadedStudents)) {
            console.error("[v0] Students is not an array:", loadedStudents)
            students = []
          } else {
            students = loadedStudents
          }
        } catch (error) {
          console.error("[v0] Error loading students:", error)
          students = []
        }

        setAssignedStudents(students)

        if (students.length === 0) {
          console.log("[v0] No students found for room:", patientRoomNumber)
          setAttendanceStatus({})
          setStudentAnswers({})
          setCompletionStatus({})
          setAlertTriggers({})
          return
        }

        const validAttendanceData = Array.isArray(attendanceData) ? attendanceData : []
        const validResultsData = Array.isArray(resultsData) ? resultsData : []

        const initialAttendance: Record<string, "present" | "absent" | "pending"> = {}
        const initialAnswers: Record<string, Record<number, number>> = {}
        const initialCompletionStatus: Record<string, boolean> = {}
        const initialAlertTriggers: Record<string, boolean> = {}

        students.forEach((student) => {
          if (!student || !student.id) {
            console.error("[v0] Invalid student:", student)
            return
          }

          const attendanceRecord = validAttendanceData.find((r) => r.studentId === student.id)
          initialAttendance[student.id] = attendanceRecord?.status || "pending"

          const evaluation = validResultsData.find((e) => e.studentId === student.id && e.evaluatorType === "patient")

          initialAnswers[student.id] = evaluation?.answers || {}
          initialCompletionStatus[student.id] = evaluation?.isCompleted || false
          initialAlertTriggers[student.id] = evaluation?.hasAlert || false
        })

        setAttendanceStatus(initialAttendance)
        setStudentAnswers(initialAnswers)
        setCompletionStatus(initialCompletionStatus)
        setAlertTriggers(initialAlertTriggers)
      } catch (error) {
        console.error("[v0] Error loading data:", error)
        router.push("/patient/exam-info")
      }
    }

    fetchData()
  }, [router, testId, patientRoomNumber])

  const handleAnswerChange = async (questionNumber: number, value: number) => {
    const student = assignedStudents[activeStudentIndex]
    if (!student) return

    const updatedAnswers = {
      ...studentAnswers[student.id],
      [questionNumber]: value,
    }

    setStudentAnswers((prev) => ({
      ...prev,
      [student.id]: updatedAnswers,
    }))

    const totalScore = Object.values(updatedAnswers).reduce((sum, val) => sum + val, 0)
    const hasAlert = alertTriggers[student.id] || false

    const evaluationResult: EvaluationResult = {
      studentId: student.studentId,
      evaluatorId: patientEmail,
      evaluatorType: "patient",
      roomNumber: patientRoomNumber,
      answers: updatedAnswers,
      totalScore,
      answeredCount: Object.keys(updatedAnswers).length,
      isCompleted: completionStatus[student.id] || false,
      hasAlert,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      await saveEvaluationResults([evaluationResult])
      console.log("[v0] Saved evaluation result:", student.id)
    } catch (error) {
      console.error("[v0] Error saving evaluation:", error)
    }
  }

  const handleMarkComplete = async (studentId: string) => {
    const student = assignedStudents.find((s) => s.id === studentId)
    if (!student) return

    const studentAnswersData = studentAnswers[studentId] || {}
    const answeredCount = Object.keys(studentAnswersData).length

    if (answeredCount !== questions.length) {
      alert(`全ての設問に回答してください。(${answeredCount}/${questions.length}問回答済み)`)
      return
    }

    setCompletionStatus((prev) => ({
      ...prev,
      [studentId]: true,
    }))

    const totalScore = calculateScore(studentId)
    const hasAlert = alertTriggers[studentId] || false

    const evaluationResult: EvaluationResult = {
      studentId: student.studentId,
      evaluatorId: patientEmail,
      evaluatorType: "patient",
      roomNumber: patientRoomNumber,
      answers: studentAnswersData,
      totalScore,
      answeredCount,
      isCompleted: true,
      hasAlert,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      await saveEvaluationResults([evaluationResult])
      console.log("[v0] Marked student as completed:", studentId)
    } catch (error) {
      console.error("[v0] Error marking completion:", error)
    }
  }

  const calculateScore = (studentId: string) => {
    const studentAnswersData = studentAnswers[studentId] || {}
    return Object.values(studentAnswersData).reduce((sum, val) => sum + val, 0)
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const answeredCount = Object.keys(studentAnswers[assignedStudents[activeStudentIndex]?.id || ""] || {}).length
  const totalScore = calculateScore(assignedStudents[activeStudentIndex]?.id || "")
  const activeStudent = assignedStudents[activeStudentIndex]

  const handleAttendanceChange = async (studentId: string, status: "present" | "absent") => {
    setAttendanceStatus((prev) => ({
      ...prev,
      [studentId]: status,
    }))

    const attendanceRecord: AttendanceRecord = {
      studentId,
      status,
      markedBy: patientEmail,
      markedByType: "patient",
      roomNumber: patientRoomNumber,
      timestamp: new Date().toISOString(),
    }

    try {
      await saveAttendanceRecords([attendanceRecord])
      console.log("[v0] Saved attendance record:", studentId)
    } catch (error) {
      console.error("[v0] Error saving attendance:", error)
    }
  }

  const groupedQuestions: Array<{
    sheetTitle: string
    categories: Array<{
      categoryTitle: string
      categoryNumber: number
      questions: QuestionWithMeta[]
    }>
  }> = []

  questions.forEach((question) => {
    let sheet = groupedQuestions.find((s) => s.sheetTitle === question.sheetTitle)
    if (!sheet) {
      sheet = { sheetTitle: question.sheetTitle, categories: [] }
      groupedQuestions.push(sheet)
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
  })

  const handleEnableEdit = (studentId: string) => {
    setCompletionStatus((prev) => ({
      ...prev,
      [studentId]: false,
    }))
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <header className="py-0 px-10 bg-background border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="font-medium">部屋番号:</span> {patientRoomNumber}
            </div>
            <div className="text-sm">
              <span className="font-medium">担当患者:</span> {patientName}
            </div>
            <div className="text-sm">
              <span className="font-medium">時間:</span> {formatTime(elapsedTime)}
            </div>
            {activeStudent && (
              <>
                <div className="text-sm">
                  <span className="font-medium">進捗:</span>{" "}
                  {Object.keys(studentAnswers[activeStudent.id] || {}).length}/{questions.length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">合計点:</span> {calculateScore(activeStudent.id)}点
                </div>
              </>
            )}
          </div>
          <Button onClick={() => router.push("/patient/results")} size="sm" className="h-6 text-sm px-2">
            評価完了
          </Button>
        </div>
      </header>

      <div className="border-b pb-2 pt-3 px-2">
        <div className="text-sm font-semibold mb-2">医学生選択 - 評価する医学生を選択してください</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {assignedStudents.map((student, index) => {
            const attendance = attendanceStatus[student.id] || null
            const isStudentCompleted = completionStatus[student.id] || false
            const studentScore = calculateScore(student.id)
            const studentAnsweredCount = Object.keys(studentAnswers[student.id] || {}).length

            return (
              <div
                key={student.id}
                onClick={() => setActiveStudentIndex(index)}
                className={`flex-shrink-0 w-44 p-2 rounded-lg border-2 cursor-pointer transition-colors ${
                  activeStudentIndex === index ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium text-sm mb-2 text-center truncate">{student.name}</div>

                <div className="flex gap-1 mb-2">
                  <Button
                    variant={attendance === "present" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs px-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAttendanceChange(student.id, "present")
                    }}
                    disabled={isStudentCompleted}
                  >
                    出席
                  </Button>
                  <Button
                    variant={attendance === "absent" ? "destructive" : "outline"}
                    size="sm"
                    className={`flex-1 h-7 text-xs px-1 ${
                      attendance === "absent" ? "bg-red-500 hover:bg-red-600 text-white" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAttendanceChange(student.id, "absent")
                    }}
                    disabled={isStudentCompleted}
                  >
                    欠席
                  </Button>
                  <div
                    className={`flex-1 h-7 flex items-center justify-center rounded-md text-xs font-medium ${
                      isStudentCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    完了
                  </div>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>得点: {studentScore}点</span>
                  <span>
                    進捗: {studentAnsweredCount}/{questions.length}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">{activeStudent?.name}の評価</h2>
          <p className="text-sm text-muted-foreground mb-1">
            {activeStudent?.studentId} - {answeredCount}/{questions.length}回答済み
          </p>
          <p className="text-sm font-medium">テスト: {groupedQuestions[0]?.sheetTitle || "評価シート"}</p>
        </div>

        {attendanceStatus[activeStudent?.id || ""] !== "present" && (
          <div className="text-center py-8 text-muted-foreground">出席ボタンを押してから入力してください</div>
        )}

        {attendanceStatus[activeStudent?.id || ""] === "present" && (
          <>
            {groupedQuestions.map((sheet) => (
              <div key={sheet.sheetTitle} className="space-y-3">
                {sheet.categories.map((category) => (
                  <div key={category.categoryNumber} className="space-y-3">
                    <div className="bg-muted px-4 py-3 rounded relative">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-3xl font-light text-muted-foreground">
                        {"{"}
                      </div>
                      <div className="ml-6">
                        <span className="font-medium">{category.categoryTitle}</span>
                      </div>
                    </div>

                    <div className="px-4">
                      <p className="text-sm font-semibold">
                        カテゴリ {category.categoryNumber}: 学生の評価にマークをしてください
                      </p>
                    </div>

                    <div className="space-y-1 px-4">
                      {category.questions.map((question) => {
                        const studentAnswersData = studentAnswers[activeStudent.id] || {}
                        const selectedOption = studentAnswersData[question.number]
                        const isAlertTarget = question.isAlertTarget
                        const isInputDisabled = completionStatus[activeStudent.id] || false

                        return (
                          <div
                            key={`${category.categoryNumber}-${question.number}`}
                            className="flex items-center gap-4 py-2 border-b border-border/40"
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
                                  onClick={() => handleAnswerChange(question.number, option)}
                                  disabled={isInputDisabled || attendanceStatus[activeStudent.id] !== "present"}
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

            <div className="flex gap-3 pt-4 px-4">
              {!completionStatus[activeStudent.id] && (
                <Button
                  onClick={() => handleMarkComplete(activeStudent.id)}
                  disabled={answeredCount !== questions.length || attendanceStatus[activeStudent.id] !== "present"}
                  className="flex-1"
                >
                  入力完了 ({answeredCount}/{questions.length})
                </Button>
              )}
              {completionStatus[activeStudent.id] && (
                <>
                  <Button onClick={() => handleEnableEdit(activeStudent.id)} variant="outline" className="flex-1">
                    編集
                  </Button>
                  <div className="flex-1 flex items-center justify-center bg-muted text-muted-foreground rounded-md px-4 py-2">
                    入力完了済み
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
