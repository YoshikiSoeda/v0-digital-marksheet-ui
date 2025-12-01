"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Clock, CheckCircle, XCircle, DoorOpen } from "lucide-react"
import {
  loadStudents,
  loadTeachers,
  loadPatients,
  loadRooms,
  loadEvaluationResults,
  loadAttendanceRecords, // Added import for loadAttendanceRecords
} from "@/lib/data-storage"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
  presentCount: number
  absentCount: number
  completedCount: number
  alertCount: number
  averageScore: number
  students: Array<{ id: string; name: string; status: string; isCompleted: boolean; totalScore: number }>
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

interface Evaluation {
  studentId: string
  roomNumber: string
  totalScore: number
}

export function AdminDashboard() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [patients, setPatients] = useState<PatientRole[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [updateCounter, setUpdateCounter] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      const loginInfo = sessionStorage.getItem("loginInfo")

      if (!loginInfo) {
        router.push("/admin/login")
        return
      }

      try {
        const info = JSON.parse(loginInfo)
        setUserRole(info.role)
        console.log("[v0] Login info:", info)

        setRooms([])
        setStudents([])
        setTeachers([])
        setPatients([])
        setAttendanceRecords([])
        setEvaluations([])

        const [
          fetchedStudents,
          fetchedTeachers,
          fetchedPatients,
          fetchedRooms,
          fetchedEvaluations,
          fetchedAttendanceRecords,
        ] = await Promise.all([
          loadStudents(),
          loadTeachers(),
          loadPatients(),
          loadRooms(),
          loadEvaluationResults(),
          loadAttendanceRecords(),
        ])

        console.log("[v0] Loaded evaluations data:", fetchedEvaluations)
        console.log("[v0] Loaded attendance records data:", fetchedAttendanceRecords)

        setStudents(Array.isArray(fetchedStudents) ? fetchedStudents : [])
        setTeachers(Array.isArray(fetchedTeachers) ? fetchedTeachers : [])
        setPatients(Array.isArray(fetchedPatients) ? fetchedPatients : [])
        setAttendanceRecords(Array.isArray(fetchedAttendanceRecords) ? fetchedAttendanceRecords : [])
        setEvaluations(Array.isArray(fetchedEvaluations) ? fetchedEvaluations : [])

        const roomMap = new Map<
          string,
          {
            roomNumber: string
            roomName: string
            teacherName: string
            patientName: string
            presentCount: number
            absentCount: number
            completedCount: number
            alertCount: number
            averageScore: number
            students: Array<{ id: string; name: string; status: string; isCompleted: boolean; totalScore: number }>
          }
        >()

        if (
          Array.isArray(fetchedRooms) &&
          Array.isArray(fetchedStudents) &&
          Array.isArray(fetchedEvaluations) &&
          Array.isArray(fetchedAttendanceRecords)
        ) {
          fetchedRooms.forEach((room) => {
            const roomStudents = fetchedStudents.filter((s) => s.roomNumber === room.roomNumber)

            const roomAttendanceRecords = fetchedAttendanceRecords.filter((a) => a.roomNumber === room.roomNumber)

            const studentStatusMap = new Map<string, { status: string; isCompleted: boolean }>()

            roomAttendanceRecords.forEach((record) => {
              studentStatusMap.set(record.studentId, {
                status: record.status,
                isCompleted: false,
              })
            })

            const roomEvaluations = fetchedEvaluations.filter((e) => e.roomNumber === room.roomNumber)
            roomEvaluations.forEach((evaluation) => {
              const existing = studentStatusMap.get(evaluation.studentId)
              if (existing && evaluation.isCompleted === true) {
                existing.isCompleted = true
              }
            })

            let presentCount = 0
            let absentCount = 0
            let completedCount = 0

            roomStudents.forEach((student) => {
              const statusInfo = studentStatusMap.get(student.studentId)
              if (statusInfo) {
                if (statusInfo.status === "present") {
                  presentCount++
                  if (statusInfo.isCompleted) {
                    completedCount++
                  }
                } else if (statusInfo.status === "absent") {
                  absentCount++
                }
              }
            })

            const studentsWithAlerts = new Set<string>()
            roomEvaluations.forEach((evaluation) => {
              if (evaluation.hasAlert === true) {
                studentsWithAlerts.add(evaluation.studentId)
              }
            })
            const alertCount = studentsWithAlerts.size

            const completedEvaluationsByStudent = new Map<string, number>()
            roomEvaluations.forEach((evaluation) => {
              if (evaluation.isCompleted === true) {
                completedEvaluationsByStudent.set(evaluation.studentId, evaluation.totalScore || 0)
              }
            })

            const totalScore = Array.from(completedEvaluationsByStudent.values()).reduce((sum, score) => sum + score, 0)
            const avgScore =
              completedEvaluationsByStudent.size > 0 ? Math.round(totalScore / completedEvaluationsByStudent.size) : 0

            const teacherForRoom = Array.isArray(fetchedTeachers)
              ? fetchedTeachers.find((t) => t.assignedRoomNumber === room.roomNumber)
              : undefined
            const patientForRoom = Array.isArray(fetchedPatients)
              ? fetchedPatients.find((p) => p.assignedRoomNumber === room.roomNumber)
              : undefined

            const studentsWithStatus = roomStudents.map((student) => {
              const statusInfo = studentStatusMap.get(student.studentId)
              const studentEvaluation = fetchedEvaluations.find(
                (e) => e.studentId === student.studentId && e.roomNumber === room.roomNumber,
              )
              const totalScore = studentEvaluation?.totalScore || 0
              return {
                id: student.studentId,
                name: student.name,
                status: statusInfo?.status || "unknown",
                isCompleted: statusInfo?.isCompleted || false,
                totalScore: totalScore,
              }
            })

            console.log(
              `[v0] Room ${room.roomNumber}: alertCount=${alertCount}, avgScore=${avgScore}, presentCount=${presentCount}, completedCount=${completedCount}`,
            )

            roomMap.set(room.roomNumber, {
              roomNumber: room.roomNumber,
              roomName: room.roomName,
              teacherName: teacherForRoom?.name || "未割当",
              patientName: patientForRoom?.name || "未割当",
              presentCount,
              absentCount,
              completedCount,
              alertCount,
              averageScore: avgScore,
              students: studentsWithStatus,
            })
          })
        }

        const roomList = Array.from(roomMap.values()).sort((a, b) => {
          const aNum = Number.parseInt(a.roomNumber) || 0
          const bNum = Number.parseInt(b.roomNumber) || 0
          return aNum - bNum
        })

        setRooms(roomList)
        setUpdateCounter((prev) => prev + 1)
        console.log("[v0] Room statistics calculated:", roomList)
        console.log("[v0] State updated, rooms count:", roomList.length)
      } catch (error) {
        console.error("[v0] Error loading data:", error)
      }
    }

    fetchData()
  }, [router])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    console.log("[v0] Refresh button clicked, fetching latest data...")

    try {
      setRooms([])
      setStudents([])
      setTeachers([])
      setPatients([])
      setAttendanceRecords([])
      setEvaluations([])

      const [fetchedStudents, fetchedTeachers, fetchedPatients, fetchedRooms, fetchedEvaluations, fetchedAttendance] =
        await Promise.all([
          loadStudents(),
          loadTeachers(),
          loadPatients(),
          loadRooms(),
          loadEvaluationResults(),
          loadAttendanceRecords(),
        ])

      console.log("[v0] Refreshed teachers data:", fetchedTeachers)
      console.log("[v0] Refreshed patients data:", fetchedPatients)
      console.log("[v0] Refreshed rooms data:", fetchedRooms)

      const roomMap = new Map<
        string,
        {
          roomNumber: string
          roomName: string
          teacherName: string
          patientName: string
          presentCount: number
          absentCount: number
          completedCount: number
          alertCount: number
          averageScore: number
          students: Array<{ id: string; name: string; status: string; isCompleted: boolean; totalScore: number }>
        }
      >()

      if (
        Array.isArray(fetchedRooms) &&
        Array.isArray(fetchedStudents) &&
        Array.isArray(fetchedEvaluations) &&
        Array.isArray(fetchedAttendance)
      ) {
        fetchedRooms.forEach((room) => {
          const roomStudents = fetchedStudents.filter((s) => s.roomNumber === room.roomNumber)

          const roomAttendanceRecords = fetchedAttendance.filter((a) => a.roomNumber === room.roomNumber)

          const studentStatusMap = new Map<string, { status: string; isCompleted: boolean }>()

          roomAttendanceRecords.forEach((record) => {
            studentStatusMap.set(record.studentId, {
              status: record.status,
              isCompleted: false,
            })
          })

          const roomEvaluations = fetchedEvaluations.filter((e) => e.roomNumber === room.roomNumber)
          roomEvaluations.forEach((evaluation) => {
            const existing = studentStatusMap.get(evaluation.studentId)
            if (existing && evaluation.isCompleted === true) {
              existing.isCompleted = true
            }
          })

          let presentCount = 0
          let absentCount = 0
          let completedCount = 0

          roomStudents.forEach((student) => {
            const statusInfo = studentStatusMap.get(student.studentId)
            if (statusInfo) {
              if (statusInfo.status === "present") {
                presentCount++
                if (statusInfo.isCompleted) {
                  completedCount++
                }
              } else if (statusInfo.status === "absent") {
                absentCount++
              }
            }
          })

          const studentsWithAlerts = new Set<string>()
          roomEvaluations.forEach((evaluation) => {
            if (evaluation.hasAlert === true) {
              studentsWithAlerts.add(evaluation.studentId)
            }
          })
          const alertCount = studentsWithAlerts.size

          const completedEvaluationsByStudent = new Map<string, number>()
          roomEvaluations.forEach((evaluation) => {
            if (evaluation.isCompleted === true) {
              completedEvaluationsByStudent.set(evaluation.studentId, evaluation.totalScore || 0)
            }
          })

          const totalScore = Array.from(completedEvaluationsByStudent.values()).reduce((sum, score) => sum + score, 0)
          const avgScore =
            completedEvaluationsByStudent.size > 0 ? Math.round(totalScore / completedEvaluationsByStudent.size) : 0

          const teacherForRoom = Array.isArray(fetchedTeachers)
            ? fetchedTeachers.find((t) => t.assignedRoomNumber === room.roomNumber)
            : undefined
          const patientForRoom = Array.isArray(fetchedPatients)
            ? fetchedPatients.find((p) => p.assignedRoomNumber === room.roomNumber)
            : undefined

          const studentsWithStatus = roomStudents.map((student) => {
            const statusInfo = studentStatusMap.get(student.studentId)
            const studentEvaluation = fetchedEvaluations.find(
              (e) => e.studentId === student.studentId && e.roomNumber === room.roomNumber,
            )
            const totalScore = studentEvaluation?.totalScore || 0
            return {
              id: student.studentId,
              name: student.name,
              status: statusInfo?.status || "unknown",
              isCompleted: statusInfo?.isCompleted || false,
              totalScore: totalScore,
            }
          })

          console.log(
            `[v0] Room ${room.roomNumber}: teacher=${teacherForRoom?.name || "未割当"}, patient=${patientForRoom?.name || "未割当"}`,
          )

          roomMap.set(room.roomNumber, {
            roomNumber: room.roomNumber,
            roomName: room.roomName,
            teacherName: teacherForRoom?.name || "未割当",
            patientName: patientForRoom?.name || "未割当",
            presentCount,
            absentCount,
            completedCount,
            alertCount,
            averageScore: avgScore,
            students: studentsWithStatus,
          })
        })
      }

      const roomList = Array.from(roomMap.values()).sort((a, b) => {
        const aNum = Number.parseInt(a.roomNumber) || 0
        const bNum = Number.parseInt(b.roomNumber) || 0
        return aNum - bNum
      })

      setRooms(roomList)
      setUpdateCounter((prev) => prev + 1)
      console.log("[v0] Refreshed room statistics:", roomList)
      console.log("[v0] Refresh complete, rooms count:", roomList.length)
    } catch (error) {
      console.error("[v0] Error refreshing data:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  console.log("[v0] Rendering AdminDashboard, rooms count:", rooms.length, "updateCounter:", updateCounter)

  if (rooms.length > 0) {
    rooms.slice(0, 3).forEach((room) => {
      console.log(`[v0] Room ${room.roomNumber}: teacher=${room.teacherName}, patient=${room.patientName}`)
    })
  }

  if (userRole === null) {
    return <div className="flex justify-center items-center min-h-screen">認証確認中...</div>
  }

  if (userRole !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">認証確認中...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">管理者ダッシュボード</h1>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm">
              {isRefreshing ? "更新中..." : "データを更新"}
            </Button>
            <Button onClick={() => (window.location.href = "/admin/account-management")} variant="outline" size="sm">
              アカウント管理
            </Button>
            <Button onClick={() => (window.location.href = "/admin/question-management")} variant="outline" size="sm">
              問題管理
            </Button>
            <Button onClick={() => (window.location.href = "/admin/room-management")} variant="outline" size="sm">
              部屋マスター管理
            </Button>
            <Button onClick={() => (window.location.href = "/admin/settings")} variant="outline" size="sm">
              設定
            </Button>
            <Button onClick={() => (window.location.href = "/")} variant="outline" size="sm">
              トップページ
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">総受験者数</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {rooms.reduce((sum, room) => sum + room.presentCount, 0)}
              </div>
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
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = "/admin/students-detail")} className="w-full">
              受験者一覧を表示
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>部屋 {selectedRoom} の詳細</DialogTitle>
          </DialogHeader>
          {selectedRoom &&
            (() => {
              const room = rooms.find((r) => r.roomNumber === selectedRoom)
              if (!room) return <p className="text-muted-foreground">部屋情報が見つかりません</p>

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">部屋名</p>
                      <p className="text-base">{room.roomName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">部屋番号</p>
                      <p className="text-base">{room.roomNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">担当教員</p>
                      <p className="text-base">{room.teacherName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">患者担当</p>
                      <p className="text-base">{room.patientName}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">進捗状況</h4>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-green-600">{room.presentCount}</p>
                        <p className="text-xs text-muted-foreground">出席</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{room.absentCount}</p>
                        <p className="text-xs text-muted-foreground">欠席</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{room.completedCount}</p>
                        <p className="text-xs text-muted-foreground">完了</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">{room.alertCount}</p>
                        <p className="text-xs text-muted-foreground">アラート</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">学生一覧</h4>
                    <div className="space-y-2">
                      {room.students && room.students.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">学籍番号</th>
                              <th className="text-left py-2">氏名</th>
                              <th className="text-center py-2">出欠</th>
                              <th className="text-center py-2">合計点</th>
                              <th className="text-center py-2">完了</th>
                            </tr>
                          </thead>
                          <tbody>
                            {room.students.map((student) => (
                              <tr key={student.id} className="border-b">
                                <td className="py-2">{student.id}</td>
                                <td className="py-2">{student.name}</td>
                                <td className="text-center py-2">
                                  <span
                                    className={`px-2 py-1 rounded text-xs ${
                                      student.status === "present"
                                        ? "bg-green-100 text-green-800"
                                        : student.status === "absent"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {student.status === "present"
                                      ? "出席"
                                      : student.status === "absent"
                                        ? "欠席"
                                        : "未確認"}
                                  </span>
                                </td>
                                <td className="text-center py-2 font-medium">{student.totalScore}点</td>
                                <td className="text-center py-2">
                                  {student.isCompleted ? (
                                    <span className="text-blue-600">✓</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">学生データがありません</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
