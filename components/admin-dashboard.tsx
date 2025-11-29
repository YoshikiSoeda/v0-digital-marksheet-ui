"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Users, Clock, CheckCircle, XCircle, FileText, Settings, DoorOpen, Home } from "lucide-react"
import {
  loadStudents,
  loadTeachers,
  loadPatients,
  loadAttendanceRecords,
  loadEvaluationResults,
} from "@/lib/data-storage"

interface RoomData {
  roomNumber: string
  teacherName: string
  patientName: string
  presentCount: number
  absentCount: number
  completedCount: number
  alertCount: number
  averageScore: number
  students: Array<{
    studentId: string
    name: string
    email?: string
    status: "present" | "absent" | "pending"
    progress: number
    score: number
    statusText: string
  }>
}

export function AdminDashboard() {
  const [roomData, setRoomData] = useState<RoomData[]>([])
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalRooms: 0,
    inProgress: 0,
    completed: 0,
    absent: 0,
  })

  useEffect(() => {
    const students = loadStudents()
    const teachers = loadTeachers()
    const patients = loadPatients()
    const attendance = loadAttendanceRecords()
    const evaluations = loadEvaluationResults()

    const roomMap = new Map<string, RoomData>()

    // Initialize rooms from teachers and patients
    teachers.forEach((teacher) => {
      if (!roomMap.has(teacher.roomNumber)) {
        roomMap.set(teacher.roomNumber, {
          roomNumber: teacher.roomNumber,
          teacherName: teacher.name,
          patientName: "",
          presentCount: 0,
          absentCount: 0,
          completedCount: 0,
          alertCount: 0,
          averageScore: 0,
          students: [],
        })
      } else {
        const room = roomMap.get(teacher.roomNumber)!
        room.teacherName = teacher.name
      }
    })

    patients.forEach((patient) => {
      if (!roomMap.has(patient.roomNumber)) {
        roomMap.set(patient.roomNumber, {
          roomNumber: patient.roomNumber,
          teacherName: "",
          patientName: patient.name,
          presentCount: 0,
          absentCount: 0,
          completedCount: 0,
          alertCount: 0,
          averageScore: 0,
          students: [],
        })
      } else {
        const room = roomMap.get(patient.roomNumber)!
        room.patientName = patient.name
      }
    })

    // Process attendance and evaluations
    let totalPresent = 0
    let totalInProgress = 0
    let totalCompleted = 0
    let totalAbsent = 0

    students.forEach((student) => {
      const attendanceRecord = attendance.find((a) => a.studentId === student.studentId)
      const status = attendanceRecord?.status || "pending"
      const roomNumber = student.roomNumber

      if (!roomMap.has(roomNumber)) {
        roomMap.set(roomNumber, {
          roomNumber,
          teacherName: "未割当",
          patientName: "未割当",
          presentCount: 0,
          absentCount: 0,
          completedCount: 0,
          alertCount: 0,
          averageScore: 0,
          students: [],
        })
      }

      const room = roomMap.get(roomNumber)!
      const studentEvaluations = evaluations.filter((e) => e.studentId === student.studentId)
      const teacherEval = studentEvaluations.find((e) => e.evaluatorType === "teacher")
      const patientEval = studentEvaluations.find((e) => e.evaluatorType === "patient")

      const isCompleted = teacherEval?.isCompleted && patientEval?.isCompleted
      const progress = teacherEval ? teacherEval.answeredCount : 0
      const score = teacherEval ? teacherEval.totalScore : 0

      let statusText = "未着手"
      if (status === "present") {
        totalPresent++
        room.presentCount++
        if (isCompleted) {
          totalCompleted++
          room.completedCount++
          statusText = "完了"
        } else if (progress > 0) {
          totalInProgress++
          statusText = "進行中"
        } else {
          statusText = "未着手"
        }
      } else if (status === "absent") {
        totalAbsent++
        room.absentCount++
        statusText = "欠席"
      }

      // Alert if present but no progress after certain time
      if (status === "present" && progress === 0) {
        room.alertCount++
      }

      room.students.push({
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        status,
        progress,
        score,
        statusText,
      })
    })

    // Calculate average scores per room
    roomMap.forEach((room) => {
      const presentStudents = room.students.filter((s) => s.status === "present")
      if (presentStudents.length > 0) {
        const totalScore = presentStudents.reduce((sum, s) => sum + s.score, 0)
        room.averageScore = Math.round(totalScore / presentStudents.length)
      }
    })

    const rooms = Array.from(roomMap.values()).sort((a, b) => {
      const aNum = Number.parseInt(a.roomNumber) || 0
      const bNum = Number.parseInt(b.roomNumber) || 0
      return aNum - bNum
    })

    setRoomData(rooms)
    setStats({
      totalPresent,
      totalRooms: rooms.length,
      inProgress: totalInProgress,
      completed: totalCompleted,
      absent: totalAbsent,
    })
  }, [])

  const presentStudents = roomData.flatMap((room) => room.students.filter((s) => s.status === "present"))

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">管理者ダッシュボード</h1>
            <p className="text-muted-foreground">試験の進行状況を管理</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/">
              <Button variant="outline">
                <Home className="w-4 h-4 mr-2" />
                トップページ
              </Button>
            </Link>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5" />
                ダッシュボード
              </CardTitle>
              <CardDescription>統計情報と進捗確認</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">現在表示中</p>
            </CardContent>
          </Card>

          <Link href="/admin/account-management">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  アカウント管理
                </CardTitle>
                <CardDescription>学生・教員・患者役</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">登録と一覧管理</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/questions">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  問題管理
                </CardTitle>
                <CardDescription>問題の登録と管理</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">手動・CSV取込</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/settings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  設定
                </CardTitle>
                <CardDescription>システム設定</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">各種設定の変更</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Stats cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">総受験者数</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.totalPresent}</div>
              <p className="text-xs text-muted-foreground mt-1">出席者のみ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">部屋数</CardTitle>
              <DoorOpen className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.totalRooms}</div>
              <p className="text-xs text-muted-foreground mt-1">登録済み部屋</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">試験中</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground mt-1">出席・未完了</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">提出済み</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-muted-foreground mt-1">評価完了</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">欠席</CardTitle>
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{stats.absent}</div>
              <p className="text-xs text-muted-foreground mt-1">欠席者</p>
            </CardContent>
          </Card>
        </div>

        {/* Room progress */}
        <Card>
          <CardHeader>
            <CardTitle>部屋別進捗状況</CardTitle>
            <CardDescription>各部屋の出席状況と評価進捗を表示</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
              {roomData.map((room) => (
                <Card key={room.roomNumber} className="bg-accent/30 hover:bg-accent/50 transition-colors">
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="font-bold text-lg text-primary text-center">部屋 {room.roomNumber}</div>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">教員:</span>
                          <span className="font-medium">{room.teacherName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">患者役:</span>
                          <span className="font-medium">{room.patientName}</span>
                        </div>
                        <div className="border-t pt-1 mt-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">出席:</span>
                            <span className="font-semibold text-green-600">{room.presentCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">欠席:</span>
                            <span className="font-semibold text-orange-600">{room.absentCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">完了:</span>
                            <span className="font-semibold text-blue-600">{room.completedCount}</span>
                          </div>
                          {room.alertCount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">アラート:</span>
                              <span className="font-semibold text-red-600">{room.alertCount}</span>
                            </div>
                          )}
                          {room.averageScore > 0 && (
                            <div className="text-center pt-1 border-t">
                              <span className="text-muted-foreground">平均: </span>
                              <span className="font-bold text-primary">{room.averageScore}点</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-2" onClick={() => setSelectedRoom(room)}>
                        詳細
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Student list */}
        <Card>
          <CardHeader>
            <CardTitle>受験者一覧</CardTitle>
            <CardDescription>出席者のみ表示</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-2 font-medium">学籍番号</th>
                    <th className="pb-2 font-medium">氏名</th>
                    <th className="pb-2 font-medium">部屋</th>
                    <th className="pb-2 font-medium">メールアドレス</th>
                    <th className="pb-2 font-medium">進捗</th>
                    <th className="pb-2 font-medium">点数</th>
                    <th className="pb-2 font-medium">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {presentStudents.map((student, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2">{student.studentId}</td>
                      <td className="py-2">{student.name}</td>
                      <td className="py-2">
                        {roomData.find((r) => r.students.some((s) => s.studentId === student.studentId))?.roomNumber}
                      </td>
                      <td className="py-2">{student.email || "-"}</td>
                      <td className="py-2">{student.progress}/100</td>
                      <td className="py-2 font-medium">{student.score}点</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            student.statusText === "完了"
                              ? "bg-green-100 text-green-800"
                              : student.statusText === "進行中"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {student.statusText}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Details Modal */}
      <Dialog open={selectedRoom !== null} onOpenChange={() => setSelectedRoom(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>部屋 {selectedRoom?.roomNumber} - 詳細</DialogTitle>
            <DialogDescription>
              教員: {selectedRoom?.teacherName} / 患者役: {selectedRoom?.patientName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">{selectedRoom?.presentCount}</div>
                <div className="text-xs text-muted-foreground">出席</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">{selectedRoom?.absentCount}</div>
                <div className="text-xs text-muted-foreground">欠席</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">{selectedRoom?.completedCount}</div>
                <div className="text-xs text-muted-foreground">完了</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-primary">{selectedRoom?.averageScore}</div>
                <div className="text-xs text-muted-foreground">平均点</div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">受験者一覧</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-medium">学籍番号</th>
                      <th className="pb-2 font-medium">氏名</th>
                      <th className="pb-2 font-medium">状態</th>
                      <th className="pb-2 font-medium">進捗</th>
                      <th className="pb-2 font-medium">点数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRoom?.students.map((student, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">{student.studentId}</td>
                        <td className="py-2">{student.name}</td>
                        <td className="py-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              student.status === "present"
                                ? "bg-green-100 text-green-800"
                                : student.status === "absent"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {student.status === "present" ? "出席" : student.status === "absent" ? "欠席" : "未確認"}
                          </span>
                        </td>
                        <td className="py-2">{student.progress}/100</td>
                        <td className="py-2 font-medium">{student.score}点</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
