"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, LogOut, Clock, Target, Users, AlertTriangle, ArrowLeft } from "lucide-react"
import { loadEvaluationResults, loadStudents, loadAttendanceRecords } from "@/lib/data-storage"

export function ExamResultsScreen() {
  const router = useRouter()
  const [totalTime, setTotalTime] = useState("")
  const [roomNumber, setRoomNumber] = useState("")
  const [evaluatorType, setEvaluatorType] = useState<"teacher" | "patient">("teacher")
  const [studentDetails, setStudentDetails] = useState<any[]>([])

  const [roomStats, setRoomStats] = useState({
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
    completedCount: 0,
    alertCount: 0,
    averageScore: 0,
  })

  useEffect(() => {
    const loginInfo = sessionStorage.getItem("loginInfo")
    const startTime = sessionStorage.getItem("examStartTime")

    if (loginInfo) {
      const info = JSON.parse(loginInfo)
      setRoomNumber(info.assignedRoomNumber || "")
      setEvaluatorType(info.role === "teacher" ? "teacher" : "patient")
    }

    if (startTime) {
      const elapsed = Date.now() - Number(startTime)
      const minutes = Math.floor(elapsed / 60000)
      const seconds = Math.floor((elapsed % 60000) / 1000)
      setTotalTime(`${minutes}分${seconds}秒`)
    }

    loadRoomStatistics()
  }, [])

  const loadRoomStatistics = async () => {
    try {
      const loginInfo = sessionStorage.getItem("loginInfo")
      if (!loginInfo) return

      const info = JSON.parse(loginInfo)
      const currentRoomNumber = info.assignedRoomNumber

      const [students, evaluations, attendanceRecords] = await Promise.all([
        loadStudents(),
        loadEvaluationResults(),
        loadAttendanceRecords(),
      ])

      const roomStudents = students.filter((s) => s.roomNumber === currentRoomNumber)
      const roomEvaluations = evaluations.filter(
        (e) =>
          e.roomNumber === currentRoomNumber && e.evaluatorType === (info.role === "teacher" ? "teacher" : "patient"),
      )
      const roomAttendance = attendanceRecords.filter((a) => a.roomNumber === currentRoomNumber)

      const presentCount = roomAttendance.filter((a) => a.status === "present").length
      const absentCount = roomAttendance.filter((a) => a.status === "absent").length

      const completedEvaluations = roomEvaluations.filter((e) => e.isCompleted)
      const alertEvaluations = roomEvaluations.filter((e) => e.hasAlert)

      const totalScore = completedEvaluations.reduce((sum, e) => sum + (e.totalScore || 0), 0)
      const avgScore = completedEvaluations.length > 0 ? Math.round(totalScore / completedEvaluations.length) : 0

      setRoomStats({
        totalStudents: roomStudents.length,
        presentCount,
        absentCount,
        completedCount: completedEvaluations.length,
        alertCount: alertEvaluations.length,
        averageScore: avgScore,
      })

      const details = roomStudents.map((student) => {
        const attendance = roomAttendance.find((a) => a.studentId === student.id)
        const evaluation = roomEvaluations.find((e) => e.studentId === student.id)
        return {
          name: student.name,
          studentId: student.studentId,
          status: attendance?.status || "未記録",
          isCompleted: evaluation?.isCompleted || false,
          score: evaluation?.totalScore || 0,
        }
      })
      setStudentDetails(details)
    } catch (error) {
      console.error("[v0] Error loading room statistics:", error)
    }
  }

  const handleBackToExam = () => {
    router.back()
  }

  const handleExit = () => {
    sessionStorage.clear()
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={handleBackToExam} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            マークシートに戻る
          </Button>
          <h1 className="text-2xl font-bold">評価サマリー</h1>
          <div className="w-32" />
        </div>

        <Card>
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-3xl">評価サマリー</CardTitle>
            <p className="text-muted-foreground">部屋{roomNumber}の評価結果</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg">
                <Users className="w-5 h-5 text-primary mt-1" />
                <div>
                  <div className="text-sm text-muted-foreground">総学生数</div>
                  <div className="text-2xl font-bold">{roomStats.totalStudents}人</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                <div>
                  <div className="text-sm text-muted-foreground">出席</div>
                  <div className="text-2xl font-bold text-green-600">{roomStats.presentCount}人</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-1" />
                <div>
                  <div className="text-sm text-muted-foreground">欠席</div>
                  <div className="text-2xl font-bold text-orange-600">{roomStats.absentCount}人</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <div className="text-sm text-muted-foreground">完了</div>
                  <div className="text-2xl font-bold text-blue-600">{roomStats.completedCount}人</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg">
                <Target className="w-5 h-5 text-primary mt-1" />
                <div>
                  <div className="text-sm text-muted-foreground">平均点</div>
                  <div className="text-2xl font-bold">{roomStats.averageScore}点</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg">
                <Clock className="w-5 h-5 text-primary mt-1" />
                <div>
                  <div className="text-sm text-muted-foreground">解答時間</div>
                  <div className="text-xl font-bold">{totalTime}</div>
                </div>
              </div>
            </div>

            {studentDetails.length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">詳細（学生リスト）</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">学籍番号</th>
                        <th className="text-left p-3 text-sm font-medium">氏名</th>
                        <th className="text-center p-3 text-sm font-medium">出欠</th>
                        <th className="text-center p-3 text-sm font-medium">状態</th>
                        <th className="text-right p-3 text-sm font-medium">得点</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentDetails.map((student, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-3 text-sm">{student.studentId}</td>
                          <td className="p-3 text-sm">{student.name}</td>
                          <td className="p-3 text-sm text-center">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs ${
                                student.status === "present"
                                  ? "bg-green-100 text-green-700"
                                  : student.status === "absent"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {student.status === "present" ? "出席" : student.status === "absent" ? "欠席" : "未記録"}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-center">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs ${
                                student.isCompleted ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {student.isCompleted ? "完了" : "未完了"}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-right font-medium">{student.score}点</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button onClick={handleBackToExam} variant="outline" className="flex-1 bg-transparent" size="lg">
                <ArrowLeft className="w-4 h-4 mr-2" />
                マークシートに戻る
              </Button>
              <Button onClick={handleExit} className="flex-1" size="lg">
                <LogOut className="w-4 h-4 mr-2" />
                退出する
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
