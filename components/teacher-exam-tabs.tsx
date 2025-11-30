"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Clock, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  loadStudents,
  loadAttendanceRecords,
  saveAttendanceRecords,
  loadEvaluationResults,
  saveEvaluationResults,
  loadTests,
  loadRooms, // Added loadRooms to fetch room names
  type AttendanceRecord,
  type EvaluationResult,
  type Test,
  type Question,
} from "@/lib/data-storage"

interface Answer {
  [key: number]: number
}

interface StudentData {
  id: string
  name: string
}

interface QuestionWithMeta extends Question {
  sheetTitle: string
  categoryTitle: string
  categoryNumber: number
  displayNumber: number
}

const TeacherExamTabs = () => {
  const getAssignedStudents = () => {
    if (typeof window === "undefined") return []

    const teacherRoom = sessionStorage.getItem("teacherRoom")
    if (!teacherRoom) {
      console.warn("[v0] No teacher room found in session")
      return []
    }

    const allStudents = loadStudents()
    return allStudents
      .filter((student) => student.roomNumber === teacherRoom)
      .map((student) => ({
        id: student.studentId,
        name: student.name,
      }))
  }

  const [assignedStudents, setAssignedStudents] = useState<Array<{ id: string; name: string }>>([])
  const [activeStudentIndex, setActiveStudentIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(3600)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, Record<number, number>>>({})
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, "present" | "absent" | "pending">>({})
  const [loginInfo, setLoginInfo] = useState<{
    email: string
    roomNumber: string
    name: string
    roomName: string
  } | null>(null) // Added roomName to loginInfo
  const [selectedTest, setSelectedTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<QuestionWithMeta[]>([])
  const router = useRouter()

  useEffect(() => {
    const testId = sessionStorage.getItem("teacher_selected_test")
    if (!testId) {
      console.error("[v0] No test selected")
      router.push("/teacher/exam-info")
      return
    }

    const tests = loadTests()
    const test = tests.find((t) => t.id === testId)

    if (!test) {
      console.error("[v0] Test not found")
      router.push("/teacher/exam-info")
      return
    }

    setSelectedTest(test)

    const flatQuestions: QuestionWithMeta[] = []
    let displayNumber = 1

    test.sheets.forEach((sheet) => {
      sheet.categories.forEach((category) => {
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

    const students = getAssignedStudents()
    setAssignedStudents(students)

    const teacherEmail = sessionStorage.getItem("teacherEmail")
    const teacherRoom = sessionStorage.getItem("teacherRoom")
    const teacherName = sessionStorage.getItem("teacherName")
    if (teacherEmail && teacherRoom && teacherName) {
      const rooms = loadRooms()
      const roomData = rooms.find((r) => r.roomNumber === teacherRoom)

      setLoginInfo({
        email: teacherEmail,
        roomNumber: teacherRoom,
        name: teacherName,
        roomName: roomData?.roomName || "未設定",
      })
    }

    if (students.length === 0) {
      console.warn("[v0] No assigned students found")
      return
    }

    const attendanceRecords = loadAttendanceRecords()
    const initialAttendance: Record<string, "present" | "absent" | "pending"> = {}
    students.forEach((student) => {
      const record = attendanceRecords.find((r) => r.studentId === student.id)
      initialAttendance[student.id] = record?.status || "pending"
    })
    setAttendanceStatus(initialAttendance)

    const evaluations = loadEvaluationResults()
    const initialAnswers: Record<string, Record<number, number>> = {}
    students.forEach((student) => {
      const evaluation = evaluations.find((e) => e.studentId === student.id && e.evaluatorType === "teacher")
      initialAnswers[student.id] = evaluation?.answers || {}
    })
    setStudentAnswers(initialAnswers)

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  if (!selectedTest || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">テストを読み込んでいます...</p>
        </div>
      </div>
    )
  }

  if (assignedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">評価対象の学生が割り当てられていません</p>
          <p className="text-sm text-muted-foreground mt-2">管理者にお問い合わせください</p>
        </div>
      </div>
    )
  }

  const answers = studentAnswers[assignedStudents[activeStudentIndex].id] || {}

  const handleAnswerChange = (questionId: number, value: number) => {
    const activeStudent = assignedStudents[activeStudentIndex]

    if (attendanceStatus[activeStudent.id] !== "present") {
      return
    }

    setStudentAnswers((prev) => ({
      ...prev,
      [activeStudent.id]: {
        ...(prev[activeStudent.id] || {}),
        [questionId]: value,
      },
    }))

    if (!loginInfo) return

    const evaluations = loadEvaluationResults()
    const activeStudentAnswers = {
      ...(studentAnswers[activeStudent.id] || {}),
      [questionId]: value,
    }
    const totalScore = Object.values(activeStudentAnswers).reduce((sum, val) => sum + val, 0)

    const existingIndex = evaluations.findIndex(
      (e) => e.studentId === activeStudent.id && e.evaluatorType === "teacher" && e.evaluatorId === loginInfo.email,
    )

    const newEvaluation: EvaluationResult = {
      studentId: activeStudent.id,
      evaluatorId: loginInfo.email,
      evaluatorType: "teacher",
      roomNumber: loginInfo.roomNumber,
      answers: activeStudentAnswers,
      totalScore,
      answeredCount: Object.keys(activeStudentAnswers).length,
      isCompleted: Object.keys(activeStudentAnswers).length === questions.length,
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? evaluations[existingIndex].createdAt : new Date().toISOString(),
    }

    if (existingIndex >= 0) {
      evaluations[existingIndex] = newEvaluation
    } else {
      evaluations.push(newEvaluation)
    }

    saveEvaluationResults(evaluations)
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

  const answeredCount = Object.keys(answers).length
  const totalScore = calculateScore(assignedStudents[activeStudentIndex].id)

  const activeStudent = assignedStudents[activeStudentIndex]

  const handleComplete = () => {
    router.push("/teacher/results")
  }

  const handleAttendanceChange = (studentId: string, status: "present" | "absent") => {
    if (!loginInfo) return

    setAttendanceStatus((prev) => ({
      ...prev,
      [studentId]: status,
    }))

    const attendanceRecords = loadAttendanceRecords()
    const existingIndex = attendanceRecords.findIndex((r) => r.studentId === studentId)

    const newRecord: AttendanceRecord = {
      studentId,
      status,
      markedBy: loginInfo.email,
      markedByType: "teacher",
      roomNumber: loginInfo.roomNumber,
      timestamp: new Date().toISOString(),
    }

    if (existingIndex >= 0) {
      attendanceRecords[existingIndex] = newRecord
    } else {
      attendanceRecords.push(newRecord)
    }

    saveAttendanceRecords(attendanceRecords)
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            {loginInfo && (
              <>
                <span className="text-sm font-medium">
                  部屋{loginInfo.roomNumber}: {loginInfo.roomName}
                </span>
                <span className="text-sm text-muted-foreground">教員: {loginInfo.name}</span>
              </>
            )}
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">残り時間: {formatTime(timeRemaining)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">
              回答済み: {answeredCount}/{questions.length}
            </span>
            <span className="text-sm font-medium">合計点: {totalScore}点</span>
            <Button size="sm" onClick={handleComplete}>
              評価完了
            </Button>
          </div>
        </div>

        {/* Student tabs */}
        <div className="max-w-7xl mx-auto px-4 border-t bg-blue-50 py-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">👥 医学生タブ - {assignedStudents.length}人を評価</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {assignedStudents.map((student, index) => {
              const studentAnswersData = studentAnswers[student.id] || {}
              const studentAnswered = Object.keys(studentAnswersData).length
              const studentScore = calculateScore(student.id)
              const isActive = index === activeStudentIndex
              const isComplete = studentAnswered === questions.length
              const attendance = attendanceStatus[student.id] || "pending"

              const bgColor =
                attendance === "absent"
                  ? "bg-gray-300 text-gray-600"
                  : isActive
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-white hover:bg-gray-100 border border-gray-200"

              return (
                <div key={student.id} className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-center">{student.name}</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAttendanceChange(student.id, "present")}
                      className={`px-2 py-1 text-xs rounded ${
                        attendance === "present" ? "bg-green-600 text-white" : "bg-gray-200 hover:bg-green-100"
                      }`}
                    >
                      出席
                    </button>
                    <button
                      onClick={() => handleAttendanceChange(student.id, "absent")}
                      className={`px-2 py-1 text-xs rounded ${
                        attendance === "absent" ? "bg-red-600 text-white" : "bg-gray-200 hover:bg-red-100"
                      }`}
                    >
                      欠席
                    </button>
                  </div>
                  <button
                    onClick={() => setActiveStudentIndex(index)}
                    disabled={attendance === "absent"}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${bgColor}`}
                  >
                    {`${isComplete ? "✓ " : ""}(${studentAnswered}/${questions.length} | ${studentScore}点)`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {attendanceStatus[activeStudent.id] === "absent" && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">この学生は欠席です。評価を入力できません。</p>
          </div>
        )}

        {attendanceStatus[activeStudent.id] === "pending" && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium">出席・欠席ボタンを押してください。</p>
          </div>
        )}

        <div className="mb-4">
          <h2 className="text-xl font-bold">{activeStudent.name}の評価</h2>
          <p className="text-sm text-muted-foreground">
            {activeStudent.id} - {answeredCount}/{questions.length}回答済み
          </p>
          <p className="text-sm font-medium text-primary mt-1">テスト: {selectedTest.title}</p>
        </div>

        <div className="space-y-6">
          {groupedQuestions.map((sheet, sheetIndex) => (
            <div key={sheetIndex} className="space-y-4">
              <div className="bg-primary/10 p-3 rounded-lg border-l-4 border-primary">
                <h3 className="font-bold text-lg">{sheet.sheetTitle}</h3>
              </div>

              {sheet.categories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="space-y-2 ml-4">
                  <div className="bg-secondary/50 p-2 rounded-md">
                    <h4 className="font-semibold text-base">
                      カテゴリ {category.categoryNumber}: {category.categoryTitle}
                    </h4>
                  </div>

                  <div className="space-y-1 ml-4">
                    {category.questions.map((question) => {
                      const selectedAnswer = answers[question.displayNumber]
                      const isAnswered = selectedAnswer !== undefined
                      const isDisabled = attendanceStatus[activeStudent.id] !== "present"

                      return (
                        <div
                          key={question.displayNumber}
                          className={`border rounded-md p-2 bg-card hover:bg-accent/5 transition-colors ${
                            question.isAlertTarget ? "border-l-4 border-l-red-500" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-bold ${
                                isAnswered ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {question.displayNumber}
                            </div>

                            <div className="flex-1 flex items-center gap-4">
                              <span className="text-sm font-medium min-w-[200px]">{question.text}</span>

                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((optionValue) => (
                                  <button
                                    key={optionValue}
                                    onClick={() => handleAnswerChange(question.displayNumber, optionValue)}
                                    disabled={isDisabled}
                                    className={`w-9 h-9 rounded text-sm font-medium transition-all ${
                                      isDisabled
                                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                        : selectedAnswer === optionValue
                                          ? "bg-primary text-primary-foreground shadow-sm"
                                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                    }`}
                                  >
                                    {optionValue}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {isAnswered && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                            {question.isAlertTarget && (
                              <span className="text-xs text-red-600 font-medium flex-shrink-0">アラート対象</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default TeacherExamTabs
