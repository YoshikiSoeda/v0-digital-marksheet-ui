"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
  loadAttendanceRecords,
  loadTests,
  loadSubjects,
} from "@/lib/data-storage"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
    id: string
    name: string
    status: string
    isCompleted: boolean
    totalScore: number
    alertCount: number
  }>
  universityCode: string
}

interface RoleStats {
  completedCount: number
  alertCount: number
  averageScore: number
}

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
  teacherStats: RoleStats
  patientStats: RoleStats
  students: Array<{ id: string; name: string; status: string; isCompleted: boolean; totalScore: number; alertCount: number }>
  universityCode?: string
}

interface Student {
  studentId: string
  name: string
  email?: string
  roomNumber: string
  universityCode?: string
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
  testId: string
  hasAlert: boolean
  isCompleted: boolean
}

interface University {
  code: string
  name: string
}

interface TestSession {
  id: string
  description: string
  universityCode: string
  testDate: string
}

const AdminDashboard = () => {
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [patients, setPatients] = useState<PatientRole[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const selectedRoomData = selectedRoom ? rooms.find((r) => r.roomNumber === selectedRoom) : null
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [updateCounter, setUpdateCounter] = useState(0)
  const [accountType, setAccountType] = useState<string | null>(null)
  const [universities, setUniversities] = useState<University[]>([])
  const [testSessions, setTestSessions] = useState<TestSession[]>([])
  const [selectedUniversity, setSelectedUniversity] = useState<string>("")
  const [selectedTestCode, setSelectedTestCode] = useState<string>("all")
  const [tests, setTests] = useState<any[]>([])
  const [isTeacherLogin, setIsTeacherLogin] = useState(false)
  const [assignedSubjectName, setAssignedSubjectName] = useState<string>("")
  const hasSetDefaultUniversity = useRef(false)

  useEffect(() => {
    const fetchData = async () => {
      const loginInfo = sessionStorage.getItem("loginInfo")

      if (!loginInfo) {
        router.push("/admin/login")
        return
      }

      const parsedLoginInfo = JSON.parse(loginInfo)
      const universityCodes = parsedLoginInfo.universityCodes || ["dentshowa"]
      const isMasterAdmin = universityCodes.includes("ALL")

      // userRole は "admin" を設定（ダッシュボードのアクセス許可用）
      // loginType が admin/teacher_admin、または role が admin/master_admin/university_admin/subject_admin
      setUserRole("admin")

      const storedAccountType = sessionStorage.getItem("accountType")
      setAccountType(storedAccountType || "admin")

      // teacherRole を取得（教員ログインからの管理画面アクセス時に使用）
      const storedTeacherRole = sessionStorage.getItem("teacherRole") || ""
      const storedTeacherId = sessionStorage.getItem("teacherId") || ""
      if (storedTeacherId) {
        setIsTeacherLogin(true)
      }
      // subject_admin の場合、subjectCode でフィルタリング
      if (storedTeacherRole === "subject_admin") {
        const subjectCode = sessionStorage.getItem("subjectCode") || ""
        if (subjectCode) {
          sessionStorage.setItem("filterSubjectCode", subjectCode)
        }
      }

      // アカウントに割り当てられた教科名を取得
      const mySubjectCode = sessionStorage.getItem("subjectCode") || ""
      if (mySubjectCode) {
        try {
          const allSubjects = await loadSubjects()
          const mySubject = allSubjects.find((s: any) => s.subjectCode === mySubjectCode)
          if (mySubject) {
            setAssignedSubjectName(mySubject.subjectName)
          }
        } catch (e) {
          console.error("[v0] Failed to load subjects for name:", e)
        }
      }

      if (storedAccountType === "special_master") {
        console.log("[v0] Fetching universities for special master")
        try {
          const response = await fetch("/api/universities")
          console.log("[v0] Universities API response status:", response.status)
          if (response.ok) {
            const universitiesData = await response.json()
            console.log("[v0] Fetched universities raw:", universitiesData)

            const transformedUniversities = universitiesData.map((uni: any) => ({
              code: uni.university_code,
              name: uni.university_name,
            }))
            console.log("[v0] Transformed universities:", transformedUniversities)
            setUniversities(transformedUniversities)

            if (!hasSetDefaultUniversity.current && transformedUniversities.length > 0) {
              setSelectedUniversity(transformedUniversities[0].code)
              hasSetDefaultUniversity.current = true
            }
          }
        } catch (error) {
          console.error("[v0] Error fetching universities:", error)
        }

        try {
          const response = await fetch("/api/test-sessions")
          console.log("[v0] Test sessions API response status:", response.status)
          if (response.ok) {
            const sessionsData = await response.json()
            console.log("[v0] Fetched test sessions raw:", sessionsData)

            // Transform snake_case to camelCase
            const transformedSessions = Array.isArray(sessionsData)
              ? sessionsData.map((session: any) => ({
                  id: session.id,
                  description: session.description || "(名称未設定)",
                  universityCode: session.university_code,
                  testDate: session.test_date,
                }))
              : []

            console.log("[v0] Transformed test sessions:", transformedSessions)
            setTestSessions(transformedSessions)
          } else {
            console.error("[v0] Test sessions API error:", response.statusText)
            setTestSessions([])
          }
        } catch (error) {
          console.error("[v0] Test sessions fetch error:", error)
          setTestSessions([])
        }
      } else {
        // special_master以外でもテストセッションを取得
        try {
          const response = await fetch("/api/test-sessions")
          if (response.ok) {
            const sessionsData = await response.json()
            const transformedSessions = Array.isArray(sessionsData)
              ? sessionsData.map((session: any) => ({
                  id: session.id,
                  description: session.description || "(名称未設定)",
                  universityCode: session.university_code,
                  testDate: session.test_date,
                }))
              : []
            setTestSessions(transformedSessions)
          }
        } catch (error) {
          console.error("[v0] Test sessions fetch error:", error)
        }
      }

      try {
        const universityCode = isMasterAdmin ? undefined : universityCodes[0]

        const testsData = await loadTests(universityCode)
        console.log("[v0] Fetched tests:", testsData)
        setTests(Array.isArray(testsData) ? testsData : [])

        const testSessionId = sessionStorage.getItem("testSessionId") || ""

        let evaluationsData: any[] = []
        try {
          evaluationsData = await loadEvaluationResults(universityCode, testSessionId)
        } catch (error) {
          console.error("[v0] Error loading evaluation results:", error)
        }

        const [studentsData, teachersData, patientsData, roomsData, attendanceData] = await Promise.all([
          loadStudents(universityCode, undefined, testSessionId),
          loadTeachers(universityCode, undefined, testSessionId),
          loadPatients(universityCode, undefined, testSessionId),
          loadRooms(universityCode, undefined, testSessionId),
          loadAttendanceRecords(universityCode, testSessionId),
        ])

        console.log("[v0] Login info:", parsedLoginInfo)
        console.log("[v0] Loaded evaluations data:", evaluationsData)
        console.log("[v0] Loaded attendance records data:", attendanceData)

        setStudents(Array.isArray(studentsData) ? studentsData : [])
        setTeachers(Array.isArray(teachersData) ? teachersData : [])
        setPatients(Array.isArray(patientsData) ? patientsData : [])
        setAttendanceRecords(Array.isArray(attendanceData) ? attendanceData : [])
        setEvaluations(Array.isArray(evaluationsData) ? evaluationsData : [])

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
            students: Array<{ id: string; name: string; status: string; isCompleted: boolean; totalScore: number; alertCount: number }>
            universityCode?: string
          }
        >()

        if (
          Array.isArray(roomsData) &&
          Array.isArray(studentsData) &&
          Array.isArray(evaluationsData) &&
          Array.isArray(attendanceData)
        ) {
          roomsData.forEach((room) => {
            const roomStudents = studentsData.filter((s) => s.roomNumber === room.roomNumber)

            const roomAttendanceRecords = attendanceData.filter((a) => a.roomNumber === room.roomNumber)

            const studentStatusMap = new Map<string, { status: string; isCompleted: boolean }>()

            roomAttendanceRecords.forEach((record) => {
              studentStatusMap.set(record.studentId, {
                status: record.status,
                isCompleted: false,
              })
            })

            const roomEvaluations = evaluationsData.filter((e) => e.roomNumber === room.roomNumber)
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
              // attendance records use student UUID (student.id), not student_id (student number)
              const statusInfo = studentStatusMap.get(student.id)
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

            // Split stats by evaluatorType (teacher/patient)
            const teacherEvals = roomEvaluations.filter((e) => e.evaluatorType === "teacher")
            const patientEvals = roomEvaluations.filter((e) => e.evaluatorType === "patient")

            const calcRoleStats = (evals: typeof roomEvaluations): RoleStats => {
              const completed = new Set<string>()
              const alerts = new Set<string>()
              const scoreMap = new Map<string, number>()
              evals.forEach((e) => {
                if (e.isCompleted) completed.add(e.studentId)
                if (e.hasAlert) alerts.add(e.studentId)
                if (e.isCompleted) scoreMap.set(e.studentId, e.totalScore || 0)
              })
              const scores = Array.from(scoreMap.values())
              const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
              return { completedCount: completed.size, alertCount: alerts.size, averageScore: avg }
            }

            const teacherStats = calcRoleStats(teacherEvals)
            const patientStats = calcRoleStats(patientEvals)

            const teacherForRoom = Array.isArray(teachersData)
              ? teachersData.find((t) => t.assignedRoomNumber === room.roomNumber)
              : undefined
            const patientForRoom = Array.isArray(patientsData)
              ? patientsData.find((p) => p.assignedRoomNumber === room.roomNumber)
              : undefined

            // Count alerts per student
            const studentAlertCountMap = new Map<string, number>()
            roomEvaluations.forEach((evaluation) => {
              if (evaluation.hasAlert === true) {
                studentAlertCountMap.set(evaluation.studentId, (studentAlertCountMap.get(evaluation.studentId) || 0) + 1)
              }
            })

            const studentsWithStatus = roomStudents.map((student) => {
              const statusInfo = studentStatusMap.get(student.id)
              const studentEvaluation = evaluationsData.find(
                (e) => e.studentId === student.id && e.roomNumber === room.roomNumber,
              )
              const totalScore = studentEvaluation?.totalScore || 0
              return {
                id: student.studentId,
                name: student.name,
                status: statusInfo?.status || "unknown",
                isCompleted: statusInfo?.isCompleted || false,
                totalScore: totalScore,
                alertCount: studentAlertCountMap.get(student.id) || 0,
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
              teacherStats,
              patientStats,
              students: studentsWithStatus,
              universityCode: room.universityCode,
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
      setTests([])

      const loginInfo = sessionStorage.getItem("loginInfo")
      if (!loginInfo) return

      const parsedLoginInfo = JSON.parse(loginInfo)
      const universityCodes = parsedLoginInfo.universityCodes || ["dentshowa"]
      const isMasterAdmin = universityCodes.includes("ALL")
      const universityCode = isMasterAdmin ? undefined : universityCodes[0]

      const testSessionId = sessionStorage.getItem("testSessionId") || ""
      let fetchedEvaluations = []
      try {
        fetchedEvaluations = await loadEvaluationResults(universityCode, testSessionId)
      } catch (error) {
        console.error("[v0] Error loading evaluation results:", error)
      }

      const [fetchedStudents, fetchedTeachers, fetchedPatients, fetchedRooms, fetchedAttendance, fetchedTests] =
        await Promise.all([
          loadStudents(universityCode, undefined, testSessionId),
          loadTeachers(universityCode, undefined, testSessionId),
          loadPatients(universityCode, undefined, testSessionId),
          loadRooms(universityCode, undefined, testSessionId),
          loadAttendanceRecords(universityCode, testSessionId),
          loadTests(universityCode),
        ])

      console.log("[v0] Refreshed teachers data:", fetchedTeachers)
      console.log("[v0] Refreshed patients data:", fetchedPatients)
      console.log("[v0] Refreshed rooms data:", fetchedRooms)

      const roomMap = new Map<string, RoomData>()

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
            // attendance records use student UUID (student.id), not student_id (student number)
            const statusInfo = studentStatusMap.get(student.id)
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

          // Split stats by evaluatorType
          const teacherEvalsP = roomEvaluations.filter((e) => e.evaluatorType === "teacher")
          const patientEvalsP = roomEvaluations.filter((e) => e.evaluatorType === "patient")

          const calcRoleStatsP = (evals: typeof roomEvaluations): RoleStats => {
            const completed = new Set<string>()
            const alerts = new Set<string>()
            const scoreMap = new Map<string, number>()
            evals.forEach((e) => {
              if (e.isCompleted) completed.add(e.studentId)
              if (e.hasAlert) alerts.add(e.studentId)
              if (e.isCompleted) scoreMap.set(e.studentId, e.totalScore || 0)
            })
            const scores = Array.from(scoreMap.values())
            const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
            return { completedCount: completed.size, alertCount: alerts.size, averageScore: avg }
          }

          const teacherStatsP = calcRoleStatsP(teacherEvalsP)
          const patientStatsP = calcRoleStatsP(patientEvalsP)

          const teacherForRoom = Array.isArray(fetchedTeachers)
            ? fetchedTeachers.find((t) => t.assignedRoomNumber === room.roomNumber)
            : undefined
          const patientForRoom = Array.isArray(fetchedPatients)
            ? fetchedPatients.find((p) => p.assignedRoomNumber === room.roomNumber)
            : undefined

          // Count alerts per student
          const studentAlertCountMap = new Map<string, number>()
          roomEvaluations.forEach((evaluation) => {
            if (evaluation.hasAlert === true) {
              studentAlertCountMap.set(evaluation.studentId, (studentAlertCountMap.get(evaluation.studentId) || 0) + 1)
            }
          })

          const studentsWithStatus = roomStudents.map((student) => {
            const statusInfo = studentStatusMap.get(student.id)
            const studentEvaluation = fetchedEvaluations.find(
              (e) => e.studentId === student.id && e.roomNumber === room.roomNumber,
            )
            const totalScore = studentEvaluation?.totalScore || 0
            return {
              id: student.studentId,
              name: student.name,
              status: statusInfo?.status || "unknown",
              isCompleted: statusInfo?.isCompleted || false,
              totalScore: totalScore,
              alertCount: studentAlertCountMap.get(student.id) || 0,
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
            teacherStats: teacherStatsP,
            patientStats: patientStatsP,
            students: studentsWithStatus,
            universityCode: room.universityCode,
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

  const filteredTestSessions = testSessions.filter(
    (session) => !selectedUniversity || session.universityCode === selectedUniversity,
  )

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesUniversity = !selectedUniversity || room.universityCode === selectedUniversity
    // 試験セッションが選択されている場合は、全部屋を表示
    // 実際のフィルタリングはevaluationsデータではなく、選択された試験セッションIDで行う
      return matchesUniversity
    })
  }, [rooms, selectedUniversity])

  const totalPresentCount = filteredRooms.reduce((sum, room) => sum + room.presentCount, 0)
  const totalCompletedCount = filteredRooms.reduce((sum, room) => sum + room.completedCount, 0)
  const totalAlertCount = filteredRooms.reduce((sum, room) => sum + room.alertCount, 0)
  const totalAbsentCount = filteredRooms.reduce((sum, room) => sum + room.absentCount, 0)

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
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-[#00417A]">管理者ダッシュボード</h1>

          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/")} variant="outline" size="sm">
              戻る
            </Button>

            {accountType === "special_master" && (
              <>
                <Select
                  value={selectedUniversity}
                  onValueChange={(value) => {
                    setSelectedUniversity(value)
                    setSelectedTestCode("all")
                  }}
                >
                  <SelectTrigger className="h-9 w-[200px]">
                    <SelectValue placeholder="大学を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((uni) => (
                      <SelectItem key={uni.code} value={uni.code}>
                        {uni.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedTestCode} onValueChange={setSelectedTestCode}>
                  <SelectTrigger className="h-9 w-[250px]">
                    <SelectValue placeholder="試験セッションを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての試験セッション</SelectItem>
                    {filteredTestSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm">
            {isRefreshing ? "更新中..." : "データを更新"}
          </Button>
          {/* マスター管理: マスター管理者・大学管理者のみ */}
          {(accountType === "special_master" || accountType === "university_master") && (
            <Button onClick={() => router.push("/admin/master-management")} variant="outline" size="sm">
              マスター管理
            </Button>
          )}
          {/* アカウント管理: マスター管理者・大学管理者のみ */}
          {(accountType === "special_master" || accountType === "university_master") && (
            <Button onClick={() => router.push("/admin/account-management")} variant="outline" size="sm">
              アカウント管理
            </Button>
          )}
          {/* 問題管理: 全管理者（subject_admin以上） */}
          <Button onClick={() => router.push("/admin/question-management")} variant="outline" size="sm">
            問題管理
          </Button>
          {/* 設定: マスター管理者・大学管理者のみ */}
          {(accountType === "special_master" || accountType === "university_master") && (
            <Button onClick={() => router.push("/admin/settings")} variant="outline" size="sm">
              設定
            </Button>
          )}
          {/* 教員ログインから来た場合に試験画面に戻るボタン */}
          {isTeacherLogin && (
            <Button onClick={() => router.push("/teacher/exam-info")} variant="outline" size="sm" className="border-blue-500 text-blue-700">
              試験画面に戻る
            </Button>
          )}
        </div>

  {(assignedSubjectName || sessionStorage.getItem("testSessionId")) && (
  <div className="mb-4 flex gap-4">
    {assignedSubjectName && (
      <div className="px-4 py-3 rounded-lg border bg-card shadow-sm shrink-0">
        <p className="text-xs text-muted-foreground font-medium">担当教科</p>
        <p className="text-base font-bold text-foreground">{assignedSubjectName}</p>
      </div>
    )}
    {testSessions.find((s) => s.id === (typeof window !== "undefined" ? sessionStorage.getItem("testSessionId") : "")) && (
      <div className="px-4 py-3 rounded-lg border bg-card shadow-sm flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">テスト名</p>
        <p className="text-base font-bold text-foreground truncate">
          {testSessions.find((s) => s.id === sessionStorage.getItem("testSessionId"))?.description}
        </p>
      </div>
    )}
  </div>
  )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">総受験者数</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{totalPresentCount}</div>
              <p className="text-xs text-muted-foreground mt-1">出席者のみ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">部屋数</CardTitle>
              <DoorOpen className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{filteredRooms.length}</div>
              <p className="text-xs text-muted-foreground mt-1">登録済み部屋</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">試験中</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{totalPresentCount - totalCompletedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">出席・未完了</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">提出済み</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{totalCompletedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">完了者数</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">要注意</CardTitle>
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{totalAlertCount}</div>
              <p className="text-xs text-muted-foreground mt-1">アラート対象</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>部屋別進捗状況</CardTitle>
            <CardDescription>各部屋の出席状況と進捗を確認</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRooms.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">表示する部屋がありません</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {filteredRooms.map((room) => (
                  <Card key={room.roomNumber} className={`transition-colors ${room.alertCount > 0 ? "bg-red-50 border-red-200 hover:bg-red-100" : "bg-accent/30 hover:bg-accent/50"}`}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-center border-b pb-2">
                          <div className="font-bold text-lg text-primary">部屋{room.roomNumber}</div>
                          {room.roomName && <div className="text-sm text-muted-foreground">{room.roomName}</div>}
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">教員:</span>
                            <span className="font-medium truncate ml-2">{room.teacherName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">患者:</span>
                            <span className="font-medium truncate ml-2">{room.patientName}</span>
                          </div>
                          <div className="border-t pt-2 mt-2 space-y-1">
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
                              <span className="font-semibold text-xs">
                                <span className="text-blue-600">教 {room.teacherStats.completedCount}</span>
                                <span className="mx-1 text-muted-foreground">/</span>
                                <span className="text-pink-600">患 {room.patientStats.completedCount}</span>
                              </span>
                            </div>
                            {(room.teacherStats.alertCount > 0 || room.patientStats.alertCount > 0) && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">アラート:</span>
                                <span className="font-semibold text-xs">
                                  <span className="text-red-600">教 {room.teacherStats.alertCount}</span>
                                  <span className="mx-1 text-muted-foreground">/</span>
                                  <span className="text-red-600">患 {room.patientStats.alertCount}</span>
                                </span>
                              </div>
                            )}
                            {(room.teacherStats.averageScore > 0 || room.patientStats.averageScore > 0) && (
                              <div className="pt-2 border-t mt-2 space-y-0.5">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">平均(教員):</span>
                                  <span className="font-bold text-blue-700">{room.teacherStats.averageScore}点</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">平均(患者):</span>
                                  <span className="font-bold text-pink-700">{room.patientStats.averageScore}点</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button size="sm" className="w-full mt-2" onClick={() => setSelectedRoom(room.roomNumber)}>
                          詳細
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>受験者一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                const params = new URLSearchParams()
                if (selectedUniversity) params.set("university", selectedUniversity)
                if (selectedTestCode && selectedTestCode !== "all") params.set("testSessionId", selectedTestCode)
                window.location.href = `/admin/students-detail?${params.toString()}`
              }}
              className="w-full"
            >
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
          {selectedRoom && !selectedRoomData && (
            <p className="text-muted-foreground">部屋情報が見つかりません</p>
          )}
          {selectedRoomData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">部屋名</p>
                  <p className="text-base">{selectedRoomData.roomName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">部屋番号</p>
                  <p className="text-base">{selectedRoomData.roomNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">担当教員</p>
                  <p className="text-base">{selectedRoomData.teacherName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">患者担当</p>
                  <p className="text-base">{selectedRoomData.patientName}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">進捗状況</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{selectedRoomData.presentCount}</p>
                    <p className="text-xs text-muted-foreground">出席</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{selectedRoomData.absentCount}</p>
                    <p className="text-xs text-muted-foreground">欠席</p>
                  </div>
                </div>
                <div className="mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 text-muted-foreground font-medium"></th>
                        <th className="text-center py-1 text-blue-700 font-medium">教員側</th>
                        <th className="text-center py-1 text-pink-700 font-medium">患者役側</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-1.5 text-muted-foreground">完了</td>
                        <td className="text-center font-bold text-blue-600">{selectedRoomData.teacherStats.completedCount}</td>
                        <td className="text-center font-bold text-pink-600">{selectedRoomData.patientStats.completedCount}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1.5 text-muted-foreground">アラート</td>
                        <td className="text-center font-bold text-red-600">{selectedRoomData.teacherStats.alertCount}</td>
                        <td className="text-center font-bold text-red-600">{selectedRoomData.patientStats.alertCount}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-muted-foreground">平均点</td>
                        <td className="text-center font-bold text-blue-700">{selectedRoomData.teacherStats.averageScore}点</td>
                        <td className="text-center font-bold text-pink-700">{selectedRoomData.patientStats.averageScore}点</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-2 bg-secondary/50 rounded text-center">
                  <span className="text-xs text-muted-foreground">合算平均: </span>
                  <span className="font-bold text-primary">{selectedRoomData.averageScore}点</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">学生一覧</h4>
                <div className="space-y-2">
                  {selectedRoomData.students && selectedRoomData.students.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">学籍番号</th>
                          <th className="text-left py-2">氏名</th>
                          <th className="text-center py-2">出欠</th>
                          <th className="text-center py-2">合計点</th>
                          <th className="text-center py-2">アラート</th>
                          <th className="text-center py-2">完了</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRoomData.students.map((student) => (
                          <tr key={student.id} className={`border-b ${student.alertCount > 0 ? "bg-red-50" : ""}`}>
                            <td className={`py-2 ${student.alertCount > 0 ? "text-red-900" : ""}`}>{student.id}</td>
                            <td className={`py-2 ${student.alertCount > 0 ? "text-red-900" : ""}`}>{student.name}</td>
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
                            <td className={`text-center py-2 font-medium ${student.alertCount > 0 ? "text-red-900" : ""}`}>{student.totalScore}点</td>
                            <td className="text-center py-2">
                              {student.alertCount > 0 ? (
                                <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800 font-semibold">{student.alertCount}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminDashboard
export { AdminDashboard }
