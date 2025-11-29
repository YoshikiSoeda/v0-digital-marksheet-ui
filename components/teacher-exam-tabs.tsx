"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, User } from "lucide-react"

interface Answer {
  [key: number]: string
}

interface StudentData {
  id: string
  name: string
  room: number
  answers: Answer
  startTime: Date
}

const questions = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  text: `評価項目 ${i + 1}`,
}))

function getAssignedStudents(teacherId: string): StudentData[] {
  const teacherMatch = teacherId.match(/\d+/)
  const teacherNumber = teacherMatch ? Number.parseInt(teacherMatch[0]) : 1
  const studentsPerTeacher = 7
  const startStudent = (teacherNumber - 1) * studentsPerTeacher + 1

  return Array.from({ length: studentsPerTeacher }, (_, i) => ({
    id: `S${String(startStudent + i).padStart(3, "0")}`,
    name: `学生 ${startStudent + i}`,
    room: Math.ceil((startStudent + i) / 7),
    answers: {},
    startTime: new Date(),
  }))
}

function calculateScore(answers: Answer) {
  return Object.values(answers).reduce((sum, val) => sum + (Number.parseInt(val) || 0), 0)
}

function getAnsweredCount(answers: Answer) {
  return Object.keys(answers).length
}

export function TeacherExamTabs() {
  const [teacherId, setTeacherId] = useState("teacher01")
  const [students, setStudents] = useState<StudentData[]>([])
  const [activeStudentIndex, setActiveStudentIndex] = useState(0)
  const [studentAnswers, setStudentAnswers] = useState<{ [studentId: string]: Answer }>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = sessionStorage.getItem("teacherId") || "teacher01"
      setTeacherId(storedId)
      const assignedStudents = getAssignedStudents(storedId)
      setStudents(assignedStudents)

      const initialAnswers: { [studentId: string]: Answer } = {}
      assignedStudents.forEach((student) => {
        initialAnswers[student.id] = {}
      })
      setStudentAnswers(initialAnswers)
      setIsLoading(false)
    }
  }, [])

  const handleAnswerChange = (studentId: string, questionId: number, answer: string) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [questionId]: answer,
      },
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">初期化中...</p>
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-lg">学生データがありません</p>
        <p className="text-sm text-muted-foreground">教員ID: {teacherId}</p>
      </div>
    )
  }

  const currentStudent = students[activeStudentIndex]
  const currentAnswers = studentAnswers[currentStudent?.id] || {}

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with student tabs */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold text-primary">全身の医療面接評価シート</h1>
              <p className="text-xs text-muted-foreground">
                教員ID: {teacherId} | 担当学生数: {students.length}人
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{currentStudent?.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>
                  {getAnsweredCount(currentAnswers)}/{questions.length}
                </span>
              </div>
              <div className="font-semibold">合計: {calculateScore(currentAnswers)}点</div>
            </div>
          </div>

          <div className="flex gap-1 flex-wrap p-2 bg-muted/30 rounded">
            {students.map((student, index) => {
              const answered = getAnsweredCount(studentAnswers[student.id] || {})
              const score = calculateScore(studentAnswers[student.id] || {})
              const isComplete = answered === questions.length
              const isActive = activeStudentIndex === index

              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setActiveStudentIndex(index)}
                  className={`flex flex-col items-start gap-0.5 px-3 py-1.5 rounded text-left transition-colors ${
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-background hover:bg-accent border"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{student.name}</span>
                    {isComplete && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  </div>
                  <div className="text-xs opacity-80">
                    {answered}/{questions.length} | {score}点
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Question list */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4">
          <div className="space-y-1">
            {questions.map((question) => {
              const selectedAnswer = currentAnswers[question.id]
              const hasAnswer = selectedAnswer !== undefined

              return (
                <div
                  key={question.id}
                  className="flex items-center gap-2 p-1.5 rounded border bg-card hover:bg-accent/50 transition-colors"
                >
                  {/* Question number badge */}
                  <div
                    className={`flex-shrink-0 w-8 h-6 rounded flex items-center justify-center text-xs font-medium ${
                      hasAnswer ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {question.id}
                  </div>

                  {/* Question text */}
                  <div className="flex-1 text-sm font-medium min-w-0">{question.text}</div>

                  {/* Answer options */}
                  <div className="flex gap-1">
                    {["0", "1", "2", "3"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleAnswerChange(currentStudent.id, question.id, option)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                          selectedAnswer === option
                            ? "bg-primary text-primary-foreground"
                            : "bg-background hover:bg-accent border"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  {/* Check indicator */}
                  <div className="w-5 flex items-center justify-center">
                    {hasAnswer && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
