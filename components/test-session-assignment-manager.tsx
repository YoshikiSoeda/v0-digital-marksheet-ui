"use client"

/**
 * ADR-007 Phase C-5: 試験セッション割当管理 UI
 *
 * 教員 / 患者役 / 学生の canonical 一覧から、この試験セッションへの割当 (どの部屋を担当 /
 * 受験するか) を設定する。
 *
 * 教員/患者役: canonical 全件 + 既存 assignment を 1 画面で表示し、PUT で全置換。
 * 学生:        canonical 件数が多い想定のため、フィルタ駆動の 1 リスト UI。
 *              - 上部の大学/学年/教科/状態フィルタで絞り込み
 *              - 1 つの表に candidates + 状態 (割当済/未割当) を表示
 *              - 多選択 → 部屋を指定 → 「割当」(新規 or 移動) / 「割当解除」
 */

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Home, ArrowLeft, Save, UserPlus, Search, Trash2, UserMinus } from "lucide-react"
import { useSession } from "@/lib/auth/use-session"
import {
  loadTeachers, loadPatients, loadRooms, loadTestSessions,
  loadStudents, loadSubjects, saveStudents,
  type Teacher, type Patient, type Room, type TestSession,
  type Student, type Subject,
} from "@/lib/data-storage"

const UNASSIGNED = "__unassigned__"

interface Props {
  sessionId: string
}

export function TestSessionAssignmentManager({ sessionId }: Props) {
  const router = useRouter()
  const { session, isLoading: isSessionLoading } = useSession()

  const [testSession, setTestSession] = useState<TestSession | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [teacherRooms, setTeacherRooms] = useState<Record<string, string>>({}) // teacher.id → roomNumber("" = unassigned)
  const [patientRooms, setPatientRooms] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string>("")

  // 学生タブ用 state (ADR-007 C-5 補強 v2 — 1 リスト+フィルタ駆動)
  const [universities, setUniversities] = useState<Record<string, string>>({})
  const [subjects, setSubjects] = useState<Subject[]>([])
  // フィルタ
  const [studentSearchUniv, setStudentSearchUniv] = useState<string>("")
  const [studentSearchGrade, setStudentSearchGrade] = useState<string>("all")
  const [studentSearchSubject, setStudentSearchSubject] = useState<string>("all")
  const [studentSearchStatus, setStudentSearchStatus] = useState<"all" | "assigned" | "unassigned">("all")
  // 検索結果(canonical 学生 list、フィルタ反映済)
  const [studentList, setStudentList] = useState<Student[]>([])
  // この試験セッションでの割当 map: studentId → roomNumber("" は割当無し)
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string>>({})
  // 一括操作
  const [studentTargetRoom, setStudentTargetRoom] = useState<string>("")
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  // 進行状態
  const [studentSearching, setStudentSearching] = useState(false)
  const [studentProcessing, setStudentProcessing] = useState(false)
  const [studentResultMsg, setStudentResultMsg] = useState<string>("")
  const [removingStudentId, setRemovingStudentId] = useState<string>("")

  // 試験セッションでの学生 assignments を再取得して assignmentMap を更新
  const refreshStudentAssignments = useCallback(async (): Promise<Record<string, string>> => {
    const res = await fetch(`/api/test-sessions/${sessionId}/student-assignments`, {
      credentials: "same-origin",
    })
    if (!res.ok) return {}
    const j = await res.json()
    const map: Record<string, string> = {}
    for (const a of j.items || []) {
      map[a.studentId] = (a.roomNumber as string) || ""
    }
    setAssignmentMap(map)
    return map
  }, [sessionId])

  useEffect(() => {
    if (isSessionLoading || !session) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const universityCode = session.universityCode || undefined

        const [
          allSessions,
          canonicalTeachers,
          canonicalPatients,
          canonicalRooms,
          subjectsData,
          teacherAssignsRes,
          patientAssignsRes,
          universitiesRes,
          studentAssignsMap,
        ] = await Promise.all([
          loadTestSessions(universityCode),
          loadTeachers(universityCode, undefined, undefined),  // canonical (no session filter)
          loadPatients(universityCode, undefined, undefined),  // canonical
          loadRooms(universityCode, undefined, undefined),
          loadSubjects(),
          fetch(`/api/test-sessions/${sessionId}/teacher-assignments`, { credentials: "same-origin" }),
          fetch(`/api/test-sessions/${sessionId}/patient-assignments`, { credentials: "same-origin" }),
          fetch(`/api/universities`, { credentials: "same-origin" }),
          refreshStudentAssignments(),
        ])

        const ts = (Array.isArray(allSessions) ? allSessions : []).find((s) => s.id === sessionId) || null
        setTestSession(ts)
        setTeachers(Array.isArray(canonicalTeachers) ? canonicalTeachers : [])
        setPatients(Array.isArray(canonicalPatients) ? canonicalPatients : [])
        setRooms(Array.isArray(canonicalRooms) ? canonicalRooms : [])
        setSubjects(Array.isArray(subjectsData) ? subjectsData : [])

        // 学生フィルタの初期値を session 文脈から
        const initUniv = session.universityCode || ""
        if (initUniv) setStudentSearchUniv(initUniv)
        const initSubject =
          session.accountType === "subject_admin" && session.subjectCode ? session.subjectCode : "all"
        setStudentSearchSubject(initSubject)

        if (universitiesRes.ok) {
          const data = await universitiesRes.json()
          const map: Record<string, string> = {}
          if (Array.isArray(data)) {
            for (const u of data) map[u.university_code] = u.university_name
          }
          setUniversities(map)
        }

        if (teacherAssignsRes.ok) {
          const tj = await teacherAssignsRes.json()
          const map: Record<string, string> = {}
          for (const a of tj.items || []) {
            map[a.teacherId] = a.assignedRoomNumber || ""
          }
          setTeacherRooms(map)
        }
        if (patientAssignsRes.ok) {
          const pj = await patientAssignsRes.json()
          const map: Record<string, string> = {}
          for (const a of pj.items || []) {
            map[a.patientId] = a.assignedRoomNumber || ""
          }
          setPatientRooms(map)
        }

        // 初回 auto-search: 初期フィルタで学生 list をロード(status は render 時に絞る)
        // assignmentMap は別変数で受けているが、render はその後に流れるので順序問題なし
        void studentAssignsMap
        try {
          const initData = await loadStudents(
            initUniv || undefined,
            initSubject === "all" ? undefined : initSubject || undefined,
            undefined,
            undefined,
          )
          setStudentList(Array.isArray(initData) ? initData : [])
        } catch (e) {
          console.error("[assignment-manager] initial student load failed:", e)
        }
      } catch (err) {
        console.error("[assignment-manager] fetch error:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isSessionLoading, sessionId])

  const handleTeacherRoomChange = (teacherId: string, roomNumber: string) => {
    setTeacherRooms((prev) => ({
      ...prev,
      [teacherId]: roomNumber === UNASSIGNED ? "" : roomNumber,
    }))
    setSavedMsg("")
  }
  const handlePatientRoomChange = (patientId: string, roomNumber: string) => {
    setPatientRooms((prev) => ({
      ...prev,
      [patientId]: roomNumber === UNASSIGNED ? "" : roomNumber,
    }))
    setSavedMsg("")
  }

  const handleSaveTeachers = async () => {
    setSaving(true)
    setSavedMsg("")
    try {
      const items = Object.entries(teacherRooms)
        .filter(([, room]) => room !== "") // 「未割当」は送らない (削除扱い)
        .map(([teacherId, room]) => ({ teacherId, assignedRoomNumber: room }))
      const res = await fetch(`/api/test-sessions/${sessionId}/teacher-assignments`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || `${res.status}`)
      }
      const json = await res.json()
      setSavedMsg(`教員 ${json.count} 件の割当を保存しました`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      alert(`教員割当の保存に失敗: ${msg}`)
    } finally {
      setSaving(false)
    }
  }
  const handleSavePatients = async () => {
    setSaving(true)
    setSavedMsg("")
    try {
      const items = Object.entries(patientRooms)
        .filter(([, room]) => room !== "")
        .map(([patientId, room]) => ({ patientId, assignedRoomNumber: room }))
      const res = await fetch(`/api/test-sessions/${sessionId}/patient-assignments`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || `${res.status}`)
      }
      const json = await res.json()
      setSavedMsg(`患者役 ${json.count} 件の割当を保存しました`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      alert(`患者役割当の保存に失敗: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  // === 学生タブ handler (1 リスト+フィルタ駆動 v2) ===

  // 状態フィルタ適用後の visible list (render 時に絞り込み)
  const filteredStudentList = studentList.filter((s) => {
    const isAssigned = !!assignmentMap[s.id]
    if (studentSearchStatus === "assigned" && !isAssigned) return false
    if (studentSearchStatus === "unassigned" && isAssigned) return false
    return true
  })
  const visibleStudentIds = filteredStudentList.map((s) => s.id)
  const allVisibleSelected =
    visibleStudentIds.length > 0 && visibleStudentIds.every((id) => selectedStudentIds.has(id))
  const assignedCount = studentList.filter((s) => !!assignmentMap[s.id]).length
  const unassignedCount = studentList.length - assignedCount

  const handleSearchStudents = async () => {
    setStudentSearching(true)
    setStudentResultMsg("")
    try {
      const univ = studentSearchUniv || undefined
      const subj = studentSearchSubject === "all" ? undefined : studentSearchSubject || undefined
      const grade = studentSearchGrade === "all" ? undefined : studentSearchGrade || undefined
      const [data] = await Promise.all([
        loadStudents(univ, subj, undefined, grade),
        refreshStudentAssignments(),
      ])
      setStudentList(Array.isArray(data) ? data : [])
      setSelectedStudentIds(new Set())
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[assignment-manager] student search failed:", msg, error)
      alert(`学生検索に失敗しました: ${msg}`)
    } finally {
      setStudentSearching(false)
    }
  }

  const toggleStudent = (id: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAllVisibleStudents = (checked: boolean) => {
    setSelectedStudentIds(checked ? new Set(visibleStudentIds) : new Set())
  }

  // 選択した学生 (canonical 行) を取得
  const selectedStudents = (): Student[] =>
    studentList.filter((s) => selectedStudentIds.has(s.id))

  const handleBulkAssignStudents = async () => {
    const selected = selectedStudents()
    if (selected.length === 0) {
      alert("対象の学生を選択してください")
      return
    }
    if (!studentTargetRoom) {
      alert("登録先の部屋番号を選択してください")
      return
    }
    setStudentProcessing(true)
    setStudentResultMsg("")
    try {
      // upsert (既割当は移動扱い、未割当は新規割当)
      const items = selected.map((s) => ({
        ...s,
        roomNumber: studentTargetRoom,
        testSessionId: sessionId,
      }))
      await saveStudents(items)
      const newlyAssigned = selected.filter((s) => !assignmentMap[s.id]).length
      const moved = selected.length - newlyAssigned
      const parts: string[] = []
      if (newlyAssigned > 0) parts.push(`${newlyAssigned} 名を新規割当`)
      if (moved > 0) parts.push(`${moved} 名を ${studentTargetRoom} へ移動`)
      setStudentResultMsg(`✅ ${parts.join(" / ") || `${selected.length} 名を割当`}`)
      await refreshStudentAssignments()
      setSelectedStudentIds(new Set())
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[assignment-manager] student bulk assign failed:", msg, error)
      alert(`学生の割当に失敗しました: ${msg}`)
    } finally {
      setStudentProcessing(false)
    }
  }

  const handleBulkUnassignStudents = async () => {
    const selected = selectedStudents().filter((s) => !!assignmentMap[s.id])
    if (selected.length === 0) {
      alert("割当解除する学生(割当済の中から)を選択してください")
      return
    }
    if (!confirm(`選択した ${selected.length} 名の割当を解除しますか?(canonical な学生情報は残ります)`)) return
    setStudentProcessing(true)
    setStudentResultMsg("")
    try {
      // 並列削除 (件数想定: 数十件まで)
      const results = await Promise.allSettled(
        selected.map((s) =>
          fetch(
            `/api/test-sessions/${sessionId}/student-assignments?studentId=${encodeURIComponent(s.id)}`,
            { method: "DELETE", credentials: "same-origin" },
          ).then(async (r) => {
            if (!r.ok) {
              const err = await r.json().catch(() => null)
              throw new Error(err?.error || `${r.status}`)
            }
          }),
        ),
      )
      const failed = results.filter((r) => r.status === "rejected").length
      const ok = selected.length - failed
      setStudentResultMsg(failed > 0
        ? `⚠ ${ok} 名の割当を解除しました(${failed} 名失敗)`
        : `✅ ${ok} 名の割当を解除しました`)
      await refreshStudentAssignments()
      setSelectedStudentIds(new Set())
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[assignment-manager] student bulk unassign failed:", msg, error)
      alert(`学生の割当解除に失敗しました: ${msg}`)
    } finally {
      setStudentProcessing(false)
    }
  }

  const handleRemoveAssignedStudent = async (studentId: string) => {
    if (!confirm("この学生の割当を解除しますか?(canonical な学生情報は残ります)")) return
    setRemovingStudentId(studentId)
    try {
      const res = await fetch(
        `/api/test-sessions/${sessionId}/student-assignments?studentId=${encodeURIComponent(studentId)}`,
        { method: "DELETE", credentials: "same-origin" },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || `${res.status}`)
      }
      await refreshStudentAssignments()
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      alert(`学生 assignment の削除に失敗: ${msg}`)
    } finally {
      setRemovingStudentId("")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!testSession) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>試験セッションが見つかりません</CardTitle>
            <CardDescription>指定された試験セッションは存在しないか、アクセス権限がありません。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/admin/dashboard")}>
              <Home className="w-4 h-4 mr-2" />ダッシュボードに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderTeacherTab = () => (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        canonical な教員 {teachers.length} 名から、この試験で担当する部屋を選んでください。
        「未割当」を選ぶと割当解除です。
      </div>
      <div className="border rounded-md max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="text-left p-2">氏名</th>
              <th className="text-left p-2">メール</th>
              <th className="text-left p-2">権限</th>
              <th className="text-left p-2 w-48">担当部屋</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 ? (
              <tr><td colSpan={4} className="text-center p-6 text-muted-foreground">登録済み教員がありません</td></tr>
            ) : (
              teachers.map((t) => (
                <tr key={t.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-medium">{t.name}</td>
                  <td className="p-2 font-mono text-xs">{t.email}</td>
                  <td className="p-2 text-xs text-muted-foreground">{t.role}</td>
                  <td className="p-2">
                    <Select
                      value={teacherRooms[t.id] || UNASSIGNED}
                      onValueChange={(v) => handleTeacherRoomChange(t.id, v)}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue placeholder="未割当" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>(未割当)</SelectItem>
                        {rooms.map((r) => (
                          <SelectItem key={r.id} value={r.roomNumber}>
                            {r.roomNumber} - {r.roomName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSaveTeachers} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "保存中..." : "教員の割当を保存"}
        </Button>
      </div>
    </div>
  )

  const renderPatientTab = () => (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        canonical な患者役 {patients.length} 名から、この試験で担当する部屋を選んでください。
      </div>
      <div className="border rounded-md max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="text-left p-2">氏名</th>
              <th className="text-left p-2">メール</th>
              <th className="text-left p-2 w-48">担当部屋</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr><td colSpan={3} className="text-center p-6 text-muted-foreground">登録済み患者役がありません</td></tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="p-2 font-mono text-xs">{p.email}</td>
                  <td className="p-2">
                    <Select
                      value={patientRooms[p.id] || UNASSIGNED}
                      onValueChange={(v) => handlePatientRoomChange(p.id, v)}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue placeholder="未割当" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>(未割当)</SelectItem>
                        {rooms.map((r) => (
                          <SelectItem key={r.id} value={r.roomNumber}>
                            {r.roomNumber} - {r.roomName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSavePatients} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "保存中..." : "患者役の割当を保存"}
        </Button>
      </div>
    </div>
  )

  const renderStudentTab = () => {
    const accountType = session?.accountType || ""
    const selectedAssignedCount = filteredStudentList
      .filter((s) => selectedStudentIds.has(s.id) && !!assignmentMap[s.id]).length

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">学生の割当</CardTitle>
          <CardDescription>
            上部のフィルタで対象学生を絞り込み、行のチェックボックスで選択してから、画面下部で「部屋に割当」または「割当解除」を実行してください。
            すでにこの試験に割当済の学生は「割当済」バッジ + 部屋番号で表示されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* フィルタ */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">大学</Label>
              {accountType === "special_master" ? (
                <Select
                  value={studentSearchUniv || "all"}
                  onValueChange={(v) => setStudentSearchUniv(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {Object.entries(universities).map(([code, name]) => (
                      <SelectItem key={code} value={code}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center h-9 px-3 bg-muted rounded-md text-sm">
                  {universities[studentSearchUniv] || studentSearchUniv || "未設定"}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">学年</Label>
              <Select value={studentSearchGrade} onValueChange={setStudentSearchGrade}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="1年">1年</SelectItem>
                  <SelectItem value="2年">2年</SelectItem>
                  <SelectItem value="3年">3年</SelectItem>
                  <SelectItem value="4年">4年</SelectItem>
                  <SelectItem value="5年">5年</SelectItem>
                  <SelectItem value="6年">6年</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">教科</Label>
              {accountType === "subject_admin" ? (
                <div className="flex items-center h-9 px-3 bg-muted rounded-md text-sm">
                  {subjects.find((s) => s.subjectCode === studentSearchSubject)?.subjectName ||
                    studentSearchSubject ||
                    "未設定"}
                </div>
              ) : (
                <Select value={studentSearchSubject} onValueChange={setStudentSearchSubject}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.subjectCode} value={s.subjectCode}>
                        {s.subjectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">状態</Label>
              <Select
                value={studentSearchStatus}
                onValueChange={(v) => setStudentSearchStatus(v as "all" | "assigned" | "unassigned")}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="assigned">割当済のみ</SelectItem>
                  <SelectItem value="unassigned">未割当のみ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSearchStudents} disabled={studentSearching}>
              <Search className="w-4 h-4 mr-2" />
              {studentSearching ? "検索中..." : "検索"}
            </Button>
          </div>

          {/* 一覧 */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(v) => toggleAllVisibleStudents(Boolean(v))}
                  disabled={visibleStudentIds.length === 0}
                />
                <span>
                  全選択({selectedStudentIds.size} / {visibleStudentIds.length} 名選択中)
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                表示 {filteredStudentList.length} 名(該当 {studentList.length} 名: 割当済 {assignedCount} / 未割当 {unassignedCount})
              </div>
            </div>

            <div className="border rounded-md max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="w-10 p-2"></th>
                    <th className="p-2 text-left">学籍番号</th>
                    <th className="p-2 text-left">氏名</th>
                    <th className="p-2 text-left">学年</th>
                    <th className="p-2 text-left">教科</th>
                    <th className="p-2 text-left">状態</th>
                    <th className="p-2 text-left">部屋</th>
                    <th className="p-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudentList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-6 text-muted-foreground">
                        {studentSearching
                          ? "検索中..."
                          : studentList.length === 0
                            ? "条件に該当する学生がいません。フィルタを変えて再検索してください。"
                            : "現在のフィルタでは表示する学生がありません(状態フィルタを変えてみてください)"}
                      </td>
                    </tr>
                  ) : (
                    filteredStudentList.map((s) => {
                      const room = assignmentMap[s.id] || ""
                      const isAssigned = !!room
                      const subjName =
                        subjects.find((sub) => sub.subjectCode === s.subjectCode)?.subjectName ||
                        s.subjectCode ||
                        "—"
                      return (
                        <tr key={s.id} className="border-t hover:bg-muted/20">
                          <td className="p-2">
                            <Checkbox
                              checked={selectedStudentIds.has(s.id)}
                              onCheckedChange={(v) => toggleStudent(s.id, Boolean(v))}
                            />
                          </td>
                          <td className="p-2 font-mono">{s.studentId}</td>
                          <td className="p-2">{s.name}</td>
                          <td className="p-2">{s.grade || "—"}</td>
                          <td className="p-2">{subjName}</td>
                          <td className="p-2">
                            {isAssigned ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">割当済</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">未割当</span>
                            )}
                          </td>
                          <td className="p-2 font-mono text-xs">{room || "—"}</td>
                          <td className="p-2 text-right">
                            {isAssigned && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveAssignedStudent(s.id)}
                                disabled={removingStudentId === s.id}
                                title="この学生の割当を解除"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 一括操作 */}
            <div className="flex flex-wrap items-end justify-between gap-3 pt-3 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">登録先 部屋番号(割当 / 移動)</Label>
                <Select value={studentTargetRoom} onValueChange={setStudentTargetRoom}>
                  <SelectTrigger className="h-9 w-56">
                    <SelectValue placeholder="部屋を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.roomNumber}>
                        {r.roomNumber} - {r.roomName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBulkUnassignStudents}
                  disabled={studentProcessing || selectedAssignedCount === 0}
                  title="選択した学生の割当を解除"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  {studentProcessing
                    ? "処理中..."
                    : `選択した ${selectedAssignedCount} 名の割当を解除`}
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleBulkAssignStudents}
                  disabled={
                    studentProcessing ||
                    selectedStudentIds.size === 0 ||
                    !studentTargetRoom
                  }
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {studentProcessing
                    ? "処理中..."
                    : `選択した ${selectedStudentIds.size} 名を割当`}
                </Button>
              </div>
            </div>

            {studentResultMsg && (
              <div className="p-3 rounded-md bg-green-50 text-sm border border-green-200">
                {studentResultMsg}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-primary">試験セッション割当管理</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium">{testSession.description || "(名称未設定)"}</span>
              {testSession.testDate && ` — ${new Date(testSession.testDate).toLocaleDateString("ja-JP")}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-1" />戻る
            </Button>
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm"><Home className="w-4 h-4 mr-1" />ダッシュボード</Button>
            </Link>
          </div>
        </div>

        {savedMsg && (
          <div className="p-3 rounded-md bg-green-50 border border-green-200 text-sm text-green-800">
            ✅ {savedMsg}
          </div>
        )}

        <Tabs defaultValue="teachers" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="teachers">教員</TabsTrigger>
            <TabsTrigger value="patients">患者役</TabsTrigger>
            <TabsTrigger value="students">学生</TabsTrigger>
          </TabsList>
          <TabsContent value="teachers" className="mt-4">{renderTeacherTab()}</TabsContent>
          <TabsContent value="patients" className="mt-4">{renderPatientTab()}</TabsContent>
          <TabsContent value="students" className="mt-4">{renderStudentTab()}</TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
