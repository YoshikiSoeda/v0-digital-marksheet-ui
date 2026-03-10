"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  type AttendanceRecord,
  type EvaluationResult,
  loadTests,
  loadStudents,
  loadAttendanceRecords,
  loadEvaluationResults,
  saveAttendanceRecords,
  saveEvaluationResults,
  loadTeachers,
} from "@/lib/data-storage"

interface TeacherExamTabsProps {
  teacherEmail: string
  teacherRoomNumber: string
  testId: string
}

export default function TeacherExamTabs({ teacherEmail, teacherRoomNumber, testId }: TeacherExamTabsProps) {
  const router = useRouter()
  const [tests, setTests] = useState<any[]>([])
  const [selectedTest, setSelectedTest] = useState<any>(null)
  const [assignedStudents, setAssignedStudents] = useState<any[]>([])
  const [activeStudentIndex, setActiveStudentIndex] = useState(0)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, Record<string, number>>>({})
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, "present" | "absent" | null>>({})
  const [completionStatus, setCompletionStatus] = useState<Record<string, boolean>>({})
  const [editMode, setEditMode] = useState<Record<string, boolean>>({})
  const [questions, setQuestions] = useState<any[]>([])
  const [teacherName, setTeacherName] = useState("")
  const [elapsedTime, setElapsedTime] = useState<number>(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const loginInfo = sessionStorage.getItem("loginInfo")
        const universityCode = loginInfo ? JSON.parse(loginInfo).universityCode || "" : ""
        const testSessionId = sessionStorage.getItem("testSessionId") || ""

        const fetchedTeachers = await loadTeachers(universityCode, undefined, testSessionId)
        if (Array.isArray(fetchedTeachers)) {
          const teacher = fetchedTeachers.find((t) => t.email === teacherEmail)
          if (teacher) {
            setTeacherName(teacher.name)
          }
        }

        const fetchedTests = await loadTests()
        setTests(Array.isArray(fetchedTests) ? fetchedTests : [])

        const fetchedStudents = await loadStudents(universityCode, undefined, testSessionId)
        const filteredStudents = Array.isArray(fetchedStudents)
          ? fetchedStudents.filter((student) => student.roomNumber === teacherRoomNumber)
          : []
        setAssignedStudents(filteredStudents)

        const selectedTest = fetchedTests.find((t) => t.id === testId)
        setSelectedTest(selectedTest)
        if (selectedTest && selectedTest.sheets) {
          const allQuestions: any[] = []
          const seenQuestionNumbers = new Set<string>()

          selectedTest.sheets.forEach((sheet) => {
            sheet.categories.forEach((category) => {
              category.questions.forEach((question) => {
                // Create unique key combining sheet, category, and question number
                const uniqueKey = `${sheet.title}-${category.number}-${question.number}`

                if (!seenQuestionNumbers.has(uniqueKey)) {
                  seenQuestionNumbers.add(uniqueKey)
                  allQuestions.push({
                    ...question,
                    sheetTitle: sheet.title,
                    categoryTitle: category.title,
                    categoryNumber: category.number,
                  })
                }
              })
            })
          })
          setQuestions(allQuestions)
        }

        const fetchedAttendanceRecords = await loadAttendanceRecords(universityCode, testSessionId)
        if (Array.isArray(fetchedAttendanceRecords)) {
          setAttendanceStatus(
            fetchedAttendanceRecords.reduce(
              (acc, record) => {
                acc[record.studentId] = record.status
                return acc
              },
              {} as Record<string, "present" | "absent" | null>,
            ),
          )
        }

        const fetchedEvaluationResults = await loadEvaluationResults(universityCode, testSessionId)
        if (Array.isArray(fetchedEvaluationResults)) {
          const answersByStudent: Record<string, Record<string, number>> = {}
          const completionByStudent: Record<string, boolean> = {}
          const editByStudent: Record<string, boolean> = {}

          fetchedEvaluationResults.forEach((result) => {
            if (result.evaluatorType === "teacher" && result.evaluatorId === teacherEmail) {
              answersByStudent[result.studentId] = result.answers || {}
              completionByStudent[result.studentId] = result.isCompleted || false
              editByStudent[result.studentId] = !result.isCompleted
            }
          })

          setStudentAnswers(answersByStudent)
          setCompletionStatus(completionByStudent)
          setEditMode(editByStudent)
        }
      } catch (error) {
        console.error("[v0] Error loading data:", error)
      }
    }

    fetchData()
  }, [teacherEmail, teacherRoomNumber, testId])

  const getUniversityCode = (): string => {
    try {
      const loginInfo = sessionStorage.getItem("loginInfo")
      return loginInfo ? JSON.parse(loginInfo).universityCode || "" : ""
    } catch { return "" }
  }

  const getTestSessionId = (): string => {
    return sessionStorage.getItem("testSessionId") || ""
  }

  const handleAnswerChange = async (questionId: string, optionValue: number) => {
    const activeStudent = assignedStudents[activeStudentIndex]
    if (!activeStudent) return

    if (attendanceStatus[activeStudent.id] !== "present") {
      return
    }

    const updatedAnswers = {
      ...studentAnswers,
      [activeStudent.id]: {
        ...(studentAnswers[activeStudent.id] || {}),
        [questionId]: optionValue,
      },
    }
    setStudentAnswers(updatedAnswers)

    const universityCode = getUniversityCode()
    const testSessionId = getTestSessionId()
    const studentAnswersData = updatedAnswers[activeStudent.id] || {}
    const totalScore = Object.values(studentAnswersData).reduce((sum, val) => sum + val, 0)

    const question = questions.find((q) => q.id === questionId)
    const hasAlert = question?.isAlertTarget && question.alertOptions?.includes(optionValue)

    const newEvaluation: EvaluationResult = {
      studentId: activeStudent.id,
      evaluatorId: teacherEmail,
      evaluatorType: "teacher",
      testId,
      roomNumber: teacherRoomNumber,
      answers: studentAnswersData,
      totalScore,
      answeredCount: Object.keys(studentAnswersData).length,
      isCompleted: completionStatus[activeStudent.id] || false,
      hasAlert,
      timestamp: new Date().toISOString(),
      universityCode,
      testSessionId,
    }

    await saveEvaluationResults([newEvaluation])
  }

  const handleAttendanceChange = async (studentId: string, status: "present" | "absent") => {
    setAttendanceStatus((prev) => ({ ...prev, [studentId]: status }))

    const universityCode = getUniversityCode()
    const testSessionId = getTestSessionId()

    const newRecord: AttendanceRecord = {
      studentId,
      status,
      markedBy: teacherEmail,
      markedByType: "teacher",
      roomNumber: teacherRoomNumber,
      timestamp: new Date().toISOString(),
      universityCode,
      testSessionId,
    }

    await saveAttendanceRecords([newRecord])
  }

  const handleMarkComplete = async (studentId: string) => {
    console.log("[v0] Complete button clicked for student:", studentId)
    const studentAnswersData = studentAnswers[studentId] || {}
    const answeredCount = Object.keys(studentAnswersData).length
    console.log("[v0] Answered count:", answeredCount, "Total questions:", questions.length)
    console.log("[v0] Attendance status:", attendanceStatus[studentId])

    if (answeredCount === questions.length && attendanceStatus[studentId] === "present") {
      setCompletionStatus((prev) => ({ ...prev, [studentId]: true }))
      setEditMode((prev) => ({ ...prev, [studentId]: false }))

      const universityCode = getUniversityCode()
      const testSessionId = getTestSessionId()

      const completedResult: EvaluationResult = {
        studentId,
        evaluatorType: "teacher" as const,
        evaluatorId: teacherEmail,
        testId,
        roomNumber: teacherRoomNumber,
        totalScore: calculateScore(studentId),
        answers: studentAnswersData,
        answeredCount,
        isCompleted: true,
        hasAlert: false,
        timestamp: new Date().toISOString(),
        universityCode,
        testSessionId,
      }

      await saveEvaluationResults([completedResult])
      console.log("[v0] Evaluation marked as complete")
    } else {
      console.log("[v0] Cannot mark as complete - conditions not met")
    }
  }

  const handleEnableEdit = (studentId: string) => {
    setEditMode((prev) => ({ ...prev, [studentId]: true }))
    setCompletionStatus((prev) => ({ ...prev, [studentId]: false }))
  }

  const calculateScore = (studentId: string): number => {
    const answers = studentAnswers[studentId] || {}
    return Object.values(answers).reduce((sum, val) => sum + val, 0)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const activeStudent = assignedStudents[activeStudentIndex]
  const studentAnswersData = studentAnswers[activeStudent?.id || ""] || {}
  const answeredCount = Object.keys(studentAnswersData).length
  const totalScore = calculateScore(activeStudent?.id || "")
  const isCompleted = completionStatus[activeStudent?.id || ""] || false
  const isEditMode = editMode[activeStudent?.id || ""] || false
  const isInputDisabled = isCompleted && !isEditMode

  const groupedQuestions: Array<{
    sheetTitle: string
    categories: Array<{
      categoryTitle: string
      categoryNumber: number
      questions: any[]
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

  const handleFinishEvaluation = async () => {
    console.log("[v0] Finish evaluation button clicked")
    router.push("/teacher/results")
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="container mx-auto p-4 space-y-4">
      <header className="py-0 px-2 bg-background border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="font-medium">部屋番号:</span> {teacherRoomNumber}
            </div>
            <div className="text-sm">
              <span className="font-medium">担当教員:</span> {teacherName}
            </div>
            <div className="text-sm">
              <span className="font-medium">時間:</span> {formatTime(elapsedTime)}
            </div>
            {activeStudent && (
              <>
                <div className="text-sm">
                  <span className="font-medium">進捗:</span>{" "}
                  {Object.entries(studentAnswers[activeStudent] || {}).filter(([_, answer]) => answer !== null).length}/
                  {questions.length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">合計点:</span> {calculateScore(activeStudent)}点
                </div>
              </>
            )}
          </div>
          <Button onClick={handleFinishEvaluation} size="sm" className="h-6 text-sm px-2">
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
                  activeStudentIndex === index
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-primary/50"
                }`}
              >
                {/* 名前（上部） */}
                <div className="font-medium text-sm mb-2 text-center truncate">{student.name}</div>

                {/* 出席、欠席、完了（中段） */}
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

                {/* 得点、進捗（下段） */}
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
        {/* Student evaluation header */}
        <div>
          <h2 className="text-lg font-semibold mb-1">{activeStudent?.name}の評価</h2>
          <p className="text-sm text-muted-foreground mb-1">
            {activeStudent?.studentId} - {answeredCount}/{questions.length}回答済み
          </p>
          <p className="text-sm font-medium">テスト: {selectedTest?.title || "評価シート"}</p>
        </div>

        {attendanceStatus[activeStudent?.id || ""] !== "present" && (
          <div className="text-center py-8 text-muted-foreground">出席ボタンを押してから入力してください</div>
        )}

        {attendanceStatus[activeStudent?.id || ""] === "present" && (
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
                        const isAnswered = studentAnswersData[question.id] !== undefined
                        const selectedOption = studentAnswersData[question.id]
                        const isAlertTarget = question.isAlertTarget

                        return (
                          <div
                            key={question.id}
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
                                  onClick={() => handleAnswerChange(question.id, option)}
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
              {!isCompleted && (
                <Button
                  onClick={() => handleMarkComplete(activeStudent.id)}
                  disabled={answeredCount !== questions.length || attendanceStatus[activeStudent.id] !== "present"}
                  className="flex-1"
                >
                  入力完了 ({answeredCount}/{questions.length})
                </Button>
              )}
              {isCompleted && (
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
