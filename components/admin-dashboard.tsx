"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Users, Clock, CheckCircle, XCircle, FileText, Settings, DoorOpen, Home, Building2 } from "lucide-react"
import {
  loadStudents,
  loadTeachers,
  loadPatients,
  loadAttendanceRecords,
  loadEvaluationResults,
  loadRooms,
} from "@/lib/data-storage"

interface RoomData {
  roomNumber: string
  roomName: string
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

interface Room {
  roomNumber: string
  roomName?: string
  teacherName: string
  patientName: string
}

interface Student {
  studentId: string
  name: string
  email?: string
  roomNumber: string
}

interface Teacher {
  name: string
  assignedRoomNumber: string
}

interface PatientRole {
  name: string
  assignedRoomNumber: string
}

interface AttendanceRecord {
  studentId: string
  status: string
}

export function AdminDashboard() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<"admin" | "general" | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [patients, setPatients] = useState<PatientRole[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      const loginInfo = sessionStorage.getItem("loginInfo")
      if (!loginInfo) {
        router.push("/admin/login")
        return
      }

      try {
        const parsedLoginInfo = JSON.parse(loginInfo)
        setUserRole(parsedLoginInfo.role || "admin")
      } catch (e) {
        console.error("[v0] Failed to parse loginInfo:", e)
        setUserRole("admin") // Default to admin for backward compatibility
      }

      console.log("[v0] Loading admin dashboard data...")

      const fetchedStudents = await loadStudents()
      const fetchedTeachers = await loadTeachers()
      const fetchedPatients = await loadPatients()
      const fetchedAttendanceRecords = await loadAttendanceRecords()
      const fetchedEvaluationResults = await loadEvaluationResults()
      const fetchedRooms = await loadRooms()

      console.log("[v0] Loaded students data:", fetchedStudents)
      console.log("[v0] Loaded teachers data:", fetchedTeachers)
      console.log("[v0] Loaded patients data:", fetchedPatients)
      console.log("[v0] Loaded rooms data:", fetchedRooms)

      console.log("[v0] Fetched data types:", {
        students: Array.isArray(fetchedStudents),
        teachers: Array.isArray(fetchedTeachers),
        patients: Array.isArray(fetchedPatients),
        rooms: Array.isArray(fetchedRooms),
      })

      setStudents(fetchedStudents)
      setTeachers(fetchedTeachers)
      setPatients(fetchedPatients)
      setAttendanceRecords(fetchedAttendanceRecords)

      const roomNameMap = new Map<string, string>()
      if (Array.isArray(fetchedRooms)) {
        fetchedRooms.forEach((room) => {
          roomNameMap.set(room.roomNumber, room.roomName)
        })
      }

      const roomMap = new Map<string, RoomData>()

      if (Array.isArray(fetchedTeachers)) {
        fetchedTeachers.forEach((teacher) => {
          if (!teacher.assignedRoomNumber) return

          if (!roomMap.has(teacher.assignedRoomNumber)) {
            roomMap.set(teacher.assignedRoomNumber, {
              roomNumber: teacher.assignedRoomNumber,
              roomName: roomNameMap.get(teacher.assignedRoomNumber) || "",
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
            const room = roomMap.get(teacher.assignedRoomNumber)!
            room.teacherName = teacher.name
          }
        })
      }

      if (Array.isArray(fetchedPatients)) {
        fetchedPatients.forEach((patient) => {
          if (!patient.assignedRoomNumber) return

          if (roomMap.has(patient.assignedRoomNumber)) {
            const room = roomMap.get(patient.assignedRoomNumber)!
            room.patientName = patient.name
          }
        })
      }

      let totalPresent = 0
      let totalInProgress = 0
      let totalCompleted = 0
      let totalAbsent = 0

      if (Array.isArray(fetchedStudents)) {
        fetchedStudents.forEach((student) => {
          const attendanceRecord = fetchedAttendanceRecords.find((a) => a.studentId === student.studentId)
          const status = attendanceRecord?.status || "pending"
          const roomNumber = student.roomNumber

          if (!roomMap.has(roomNumber)) {
            roomMap.set(roomNumber, {
              roomNumber,
              roomName: roomNameMap.get(roomNumber) || "",
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
          const studentEvaluations = fetchedEvaluationResults.filter((e) => e.studentId === student.studentId)
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
      }

      roomMap.forEach((room) => {
        const presentStudents = room.students.filter((s) => s.status === "present")
        if (presentStudents.length > 0) {
          const totalScore = presentStudents.reduce((sum, s) => sum + s.score, 0)
          room.averageScore = Math.round(totalScore / presentStudents.length)
        }
      })

      const roomList = Array.from(roomMap.values()).sort((a, b) => {
        const aNum = Number.parseInt(a.roomNumber) || 0
        const bNum = Number.parseInt(b.roomNumber) || 0
        return aNum - bNum
      })

      setRooms(roomList)
      setAttendanceRecords(fetchedAttendanceRecords)

      console.log("[v0] Admin dashboard data loaded successfully")
    }

    fetchData()
  }, [router])

  const presentStudents = rooms.flatMap((room) => room.students.filter((s) => s.status === "present"))

  const selectedRoomStudents = selectedRoom
    ? rooms.find((room) => room.roomNumber === selectedRoom)?.students || []
    : []

  if (userRole === null) {
    return (
      <div className="min-h-screen bg-secondary/30 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">認証確認中...</div>
        </div>
      </div>
    )
  }

  if (userRole === "general") {
    return (
      <div className="min-h-screen bg-secondary/30 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>アクセス権限がありません</CardTitle>
            <CardDescription>この画面は管理者権限が必要です</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">一般ユーザーは採点画面のみ利用できます。</p>
            <div className="flex gap-2 flex-wrap">
              <Link href="/teacher/exam-info" className="flex-1">
                <Button className="w-full">採点画面へ</Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent">
                  トップページ
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">管理者ダッシュボード</h1>
            <p className="text-muted-foreground">試験の進行状況を管理</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="w-4 h-4 mr-2" />
                トップページ
              </Button>
            </Link>
            <Link href="/admin/account-management">
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                アカウント管理
              </Button>
            </Link>
            <Link href="/admin/question-management">
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                問題管理
              </Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                設定
              </Button>
            </Link>
            <Link href="/admin/room-management">
              <Button variant="outline" size="sm">
                <Building2 className="w-4 h-4 mr-2" />
                部屋マスター管理
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">総受験者数</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{presentStudents.length}</div>
              <p className="text-xs text-muted-foreground mt-1">出席者のみ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">部屋数</CardTitle>
              <DoorOpen className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{rooms.length}</div>
              <p className="text-xs text-muted-foreground mt-1">登録済み部屋</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">試験中</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {rooms.reduce((sum, room) => sum + room.presentCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">出席・未完了</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">提出済み</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {rooms.reduce((sum, room) => sum + room.completedCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">評価完了</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">欠席</CardTitle>
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {rooms.reduce((sum, room) => sum + room.absentCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">欠席者</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>部屋別進捗状況</CardTitle>
            <CardDescription>各部屋の出席状況と評価進捗を表示</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-[800px] overflow-y-auto">
              {rooms.map((room) => (
                <Card key={room.roomNumber} className="bg-accent/30 hover:bg-accent/50 transition-colors">
                  <CardContent className="p-2">
                    <div className="space-y-1.5">
                      <div className="text-center border-b pb-1">
                        <div className="font-bold text-base text-primary">
                          部屋{room.roomNumber} {room.roomName || ""}
                        </div>
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">教員:</span>
                          <span className="font-medium truncate ml-1">{room.teacherName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">患者:</span>
                          <span className="font-medium truncate ml-1">{room.patientName}</span>
                        </div>
                        <div className="border-t pt-1 mt-1 space-y-0.5">
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
                              <span className="text-muted-foreground text-xs">平均: </span>
                              <span className="font-bold text-primary text-xs">{room.averageScore}点</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-1.5 text-xs py-1"
                        onClick={() => setSelectedRoom(room.roomNumber)}
                      >
                        詳細
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

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
                      <td className="py-2">{student.roomNumber}</td>
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

      <Dialog open={selectedRoom !== null} onOpenChange={() => setSelectedRoom(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>部屋 {selectedRoom} - 詳細</DialogTitle>
            <DialogDescription>
              教員: {rooms.find((room) => room.roomNumber === selectedRoom)?.teacherName} / 患者役:{" "}
              {rooms.find((room) => room.roomNumber === selectedRoom)?.patientName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {rooms.find((room) => room.roomNumber === selectedRoom)?.presentCount}
                </div>
                <div className="text-xs text-muted-foreground">出席</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">
                  {rooms.find((room) => room.roomNumber === selectedRoom)?.absentCount}
                </div>
                <div className="text-xs text-muted-foreground">欠席</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {rooms.find((room) => room.roomNumber === selectedRoom)?.completedCount}
                </div>
                <div className="text-xs text-muted-foreground">完了</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-primary">
                  {rooms.find((room) => room.roomNumber === selectedRoom)?.averageScore}
                </div>
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
                    {selectedRoomStudents.map((student, index) => (
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
