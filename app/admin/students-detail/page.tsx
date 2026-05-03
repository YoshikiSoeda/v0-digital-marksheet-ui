"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Download, StopCircle } from "lucide-react"
import {
  loadStudents,
  loadEvaluationResults,
  loadAttendanceRecords,
  loadTests,
  type Student,
  type EvaluationResult,
  type AttendanceRecord,
  type Test,
} from "@/lib/data-storage"

export default function StudentsDetailPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [testSessions, setTestSessions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEndingTest, setIsEndingTest] = useState(false)
  const [filterUniversity, setFilterUniversity] = useState<string>("")
  const [filterTestSessionId, setFilterTestSessionId] = useState<string>("")

  useEffect(() => {
    // URLパラメータを取得
    const params = new URLSearchParams(window.location.search)
    const university = params.get("university") || ""
    const testSessionId = params.get("testSessionId") || ""

    setFilterUniversity(university)
    setFilterTestSessionId(testSessionId)

    const fetchData = async () => {
      try {
        const testSessionId = sessionStorage.getItem("testSessionId") || ""
        const [studentsData, evaluationsData, attendanceData, testsData, testSessionsData] = await Promise.all([
          loadStudents(university || undefined, undefined, testSessionId),
          loadEvaluationResults(university || undefined, testSessionId),
          loadAttendanceRecords(university || undefined, testSessionId),
          loadTests(university || undefined),
          fetch("/api/test-sessions")
            .then((res) => res.json())
            .catch(() => []),
        ])

        setStudents(Array.isArray(studentsData) ? studentsData : [])
        setEvaluations(Array.isArray(evaluationsData) ? evaluationsData : [])
        setAttendanceRecords(Array.isArray(attendanceData) ? attendanceData : [])
        setTests(Array.isArray(testsData) ? testsData : [])
        setTestSessions(Array.isArray(testSessionsData) ? testSessionsData : [])
      } catch (error) {
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredTests = filterTestSessionId
    ? tests.filter((test) => test.testSessionId === filterTestSessionId)
    : tests

  const getStudentData = (student: Student) => {
    const studentAttendance = attendanceRecords.find((a) => a.studentId === student.id) // ADR-005 F5: UUID でマッチ

    const studentEvaluations = evaluations.filter((e) => {
      if (e.studentId !== student.id) return false // ADR-005 F5: UUID でマッチ
      if (!filterTestSessionId) return true

      // 試験セッションIDでフィルタ
      const test = tests.find((t) => t.id === e.testId)
      if (!test) return false

      return test.testSessionId === filterTestSessionId
    })

    const completedEvaluations = studentEvaluations.filter((e) => e.isCompleted)
    const totalScore = completedEvaluations.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    const averageScore = completedEvaluations.length > 0 ? Math.round(totalScore / completedEvaluations.length) : 0

    // Calculate teacher and patient scores separately
    const teacherEvals = completedEvaluations.filter((e: any) => e.evaluatorType === "teacher")
    const patientEvals = completedEvaluations.filter((e: any) => e.evaluatorType === "patient")
    const teacherScore = teacherEvals.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    const patientScore = patientEvals.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    const combinedScore = teacherScore + patientScore

    // Pass/fail check
    const currentSessionId = sessionStorage.getItem("testSessionId") || filterTestSessionId
    const currentSession = testSessions.find((s: any) => s.id === currentSessionId)
    const passingScore = currentSession?.passing_score
    let passResult: "合格" | "不合格" | "" = ""
    if (passingScore != null && passingScore > 0 && completedEvaluations.length > 0) {
      passResult = combinedScore >= passingScore ? "合格" : "不合格"
    }

    const testTitle = (currentSession || testSessions.find((s: any) => s.id === filterTestSessionId))?.description || "" // ADR-005 F5: 試験セッション名を表示

    let status = "未受験"
    if (studentAttendance?.status === "present") {
      if (completedEvaluations.length > 0) {
        status = "完了"
      } else {
        status = "進行中"
      }
    } else if (studentAttendance?.status === "absent") {
      status = "欠席"
    }

    const progress = completedEvaluations.length > 0 ? "完了" : studentAttendance?.status === "present" ? "進行中" : ""

    return {
      testTitle,
      progress,
      score: averageScore > 0 ? averageScore : "",
      teacherScore: teacherEvals.length > 0 ? teacherScore : "",
      patientScore: patientEvals.length > 0 ? patientScore : "",
      passResult,
      status,
    }
  }

  const currentSessionId = typeof window !== "undefined" ? (sessionStorage.getItem("testSessionId") || filterTestSessionId) : filterTestSessionId
  const currentSession = testSessions.find((s: any) => s.id === currentSessionId)
  const sessionStatus = currentSession?.status || "not_started"

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "not_started": return "未実施"
      case "in_progress": return "実施中"
      case "completed": return "テスト終了"
      default: return status
    }
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": return "destructive"
      case "in_progress": return "default"
      default: return "outline"
    }
  }

  const handleEndTest = async () => {
    if (!currentSessionId) return
    setIsEndingTest(true)
    try {
      const res = await fetch(`/api/test-sessions/${currentSessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      })
      if (res.ok) {
        setTestSessions((prev) =>
          prev.map((s) => (s.id === currentSessionId ? { ...s, status: "completed" } : s))
        )
      } else {
      }
    } catch (error) {
    } finally {
      setIsEndingTest(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ["学籍番号", "氏名", "部屋", "メールアドレス", "テスト名", "進捗", "点数", "教員", "患者", "合否", "ステータス"]
    const rows = students.map((student) => {
      const data = getStudentData(student)
      return [
        student.studentId,
        student.name,
        student.roomNumber || "",
        student.email || "",
        data.testTitle || "",
        data.progress || "",
        data.score !== "" ? String(data.score) : "",
        data.teacherScore !== "" ? String(data.teacherScore) : "",
        data.patientScore !== "" ? String(data.patientScore) : "",
        data.passResult || "",
        data.status,
      ]
    })

    const bom = "\uFEFF"
    const csvContent = bom + [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const sessionDesc = currentSession?.description || "students"
    link.download = `${sessionDesc}_受験者一覧.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">データ読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">受験者一覧</h1>
              <Badge variant={getStatusVariant(sessionStatus)} className="text-sm px-3 py-1">
                {getStatusLabel(sessionStatus)}
              </Badge>
            </div>
            {(filterUniversity || filterTestSessionId) && (
              <p className="text-sm text-muted-foreground mt-1">
                {filterUniversity && `大学: ${filterUniversity}`}
                {filterUniversity && filterTestSessionId && " / "}
                {filterTestSessionId && (() => {
                  const session = testSessions.find((s: any) => s.id === filterTestSessionId)
                  return `試験: ${session?.description || filterTestSessionId}`
                })()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              CSV出力
            </Button>

            {sessionStatus !== "completed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex items-center gap-2" disabled={isEndingTest}>
                    <StopCircle className="w-4 h-4" />
                    テスト終了
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>テストを終了しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      この操作により、テストセッションのステータスが「テスト終了」に変更されます。この操作は取り消せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndTest} disabled={isEndingTest}>
                      {isEndingTest ? "処理中..." : "テスト終了"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button onClick={() => (window.location.href = "/admin/dashboard")} variant="outline">
              ダッシュボードに戻る
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>全受験者</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>学籍番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>部屋</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>タイトル１</TableHead>
                    <TableHead>進捗</TableHead>
                    <TableHead>点数</TableHead>
                    <TableHead>教員</TableHead>
                    <TableHead>患者</TableHead>
                    <TableHead>合否</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const data = getStudentData(student)
                    return (
                      <TableRow key={student.id}>
                        <TableCell>{student.studentId}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.roomNumber || "-"}</TableCell>
                        <TableCell>{student.email || "-"}</TableCell>
                        <TableCell>{data.testTitle || "-"}</TableCell>
                        <TableCell>{data.progress || "-"}</TableCell>
                        <TableCell>{data.score || "-"}</TableCell>
                        <TableCell>{data.teacherScore !== "" ? data.teacherScore : "-"}</TableCell>
                        <TableCell>{data.patientScore !== "" ? data.patientScore : "-"}</TableCell>
                        <TableCell>
                          {data.passResult ? (
                            <span className={`font-semibold ${data.passResult === "合格" ? "text-red-600" : "text-blue-600"}`}>
                              {data.passResult}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              data.status === "完了"
                                ? "default"
                                : data.status === "進行中"
                                  ? "secondary"
                                  : data.status === "欠席"
                                    ? "destructive"
                                    : "outline"
                            }
                          >
                            {data.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
