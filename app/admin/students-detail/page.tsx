"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
  const [filterUniversity, setFilterUniversity] = useState<string>("")
  const [filterTestCode, setFilterTestCode] = useState<string>("")

  useEffect(() => {
    // URLパラメータを取得
    const params = new URLSearchParams(window.location.search)
    const university = params.get("university") || ""
    const testCode = params.get("testCode") || ""

    setFilterUniversity(university)
    setFilterTestCode(testCode)

    const fetchData = async () => {
      try {
        const [studentsData, evaluationsData, attendanceData, testsData, testSessionsData] = await Promise.all([
          loadStudents(university || undefined),
          loadEvaluationResults(university || undefined),
          loadAttendanceRecords(university || undefined),
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
        console.error("[v0] Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredTests = filterTestCode
    ? tests.filter((test) => {
        const session = testSessions.find((s) => s.id === test.testSessionId)
        return session?.test_code === filterTestCode
      })
    : tests

  const getStudentData = (student: Student) => {
    const studentAttendance = attendanceRecords.find((a) => a.studentId === student.studentId)

    const studentEvaluations = evaluations.filter((e) => {
      if (e.studentId !== student.studentId) return false
      if (!filterTestCode) return true

      // テストコードでフィルタ
      const test = tests.find((t) => t.id === e.testId)
      if (!test) return false

      const session = testSessions.find((s) => s.id === test.testSessionId)
      return session?.test_code === filterTestCode
    })

    const completedEvaluations = studentEvaluations.filter((e) => e.isCompleted)
    const totalScore = completedEvaluations.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    const averageScore = completedEvaluations.length > 0 ? Math.round(totalScore / completedEvaluations.length) : 0

    const testTitle = filteredTests.length > 0 ? filteredTests[0].title : ""

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
      status,
    }
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
            <h1 className="text-3xl font-bold">受験者一覧</h1>
            {(filterUniversity || filterTestCode) && (
              <p className="text-sm text-muted-foreground mt-1">
                {filterUniversity && `大学: ${filterUniversity}`}
                {filterUniversity && filterTestCode && " / "}
                {filterTestCode && `テストコード: ${filterTestCode}`}
              </p>
            )}
          </div>
          <Button onClick={() => (window.location.href = "/admin/dashboard")} variant="outline">
            ダッシュボードに戻る
          </Button>
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
