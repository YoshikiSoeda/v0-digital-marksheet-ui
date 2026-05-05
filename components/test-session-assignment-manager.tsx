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

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Home, ArrowLeft, Save, UserPlus, Search, Trash2, UserMinus, CheckCircle2, RotateCcw } from "lucide-react"
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

  // ADR-007 C-5 v3: ステージング (確定前の保留変更)
  // 各 studentId に対して未保存の変更を保持する:
  //   string => その部屋に割当(新規 or 移動)
  //   null   => 割当解除
  //   キーが存在しない => 変更なし(現在の DB 状態のまま)
  const [pendingMap, setPendingMap] = useState<Record<string, string | null>>({})
  // shift+クリックで範囲選択するための「直前にクリックされた行 index」
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null)
  // shift キー押下中フラグ (Radix Checkbox の onCheckedChange は event を受け取らないため
  // window レベルの keydown/keyup で track する)
  const isShiftDownRef = useRef(false)

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

  // shift キー押下を window レベルで監視 (Radix Checkbox 経由で取れないため)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      isShiftDownRef.current = e.shiftKey
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKey)
    }
  }, [])

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

  // === 学生タブ handler (v3: ステージング+確定パターン) ===

  // ある学生の effective room (pending 反映後の "見た目" 上の部屋)
  // saved を返すか pending を返すか、または null (解除予定 / 未割当)
  const getEffective = (id: string): { savedRoom: string; effectiveRoom: string; hasPending: boolean; pendingKind: "none" | "new" | "move" | "unassign" | "noop" } => {
    const savedRoom = assignmentMap[id] || ""
    if (id in pendingMap) {
      const pending = pendingMap[id]
      if (pending === null) {
        return savedRoom
          ? { savedRoom, effectiveRoom: "", hasPending: true, pendingKind: "unassign" }
          : { savedRoom, effectiveRoom: "", hasPending: false, pendingKind: "noop" }
      }
      // pending is a string
      if (!savedRoom) return { savedRoom, effectiveRoom: pending, hasPending: true, pendingKind: "new" }
      if (savedRoom !== pending) return { savedRoom, effectiveRoom: pending, hasPending: true, pendingKind: "move" }
      return { savedRoom, effectiveRoom: savedRoom, hasPending: false, pendingKind: "noop" }
    }
    return { savedRoom, effectiveRoom: savedRoom, hasPending: false, pendingKind: "none" }
  }

  // 状態フィルタ適用後の visible list (render 時に絞り込み)
  // 「割当済 / 未割当」は effective (pending 反映後) で判定する
  const filteredStudentList = studentList.filter((s) => {
    const eff = getEffective(s.id)
    const isEffectivelyAssigned = !!eff.effectiveRoom
    if (studentSearchStatus === "assigned" && !isEffectivelyAssigned) return false
    if (studentSearchStatus === "unassigned" && isEffectivelyAssigned) return false
    return true
  })
  const visibleStudentIds = filteredStudentList.map((s) => s.id)
  const allVisibleSelected =
    visibleStudentIds.length > 0 && visibleStudentIds.every((id) => selectedStudentIds.has(id))
  const assignedCount = studentList.filter((s) => !!getEffective(s.id).effectiveRoom).length
  const unassignedCount = studentList.length - assignedCount

  // 保留中の有効な変更件数(noop は除外)
  const meaningfulPendingCount = Object.keys(pendingMap).filter((id) => {
    const eff = getEffective(id)
    return eff.hasPending
  }).length

  const handleSearchStudents = async () => {
    if (meaningfulPendingCount > 0) {
      if (!confirm("保留中の変更があります。検索しなおすと選択は解除されます。続けますか?")) return
    }
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
      setLastClickedIdx(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[assignment-manager] student search failed:", msg, error)
      alert(`学生検索に失敗しました: ${msg}`)
    } finally {
      setStudentSearching(false)
    }
  }

  // shift+クリックで範囲選択。filteredStudentList の表示順での range を toggle する。
  const toggleStudent = (id: string, checked: boolean) => {
    const idx = filteredStudentList.findIndex((s) => s.id === id)
    if (
      isShiftDownRef.current &&
      lastClickedIdx !== null &&
      idx !== -1 &&
      idx !== lastClickedIdx
    ) {
      const [from, to] = lastClickedIdx < idx ? [lastClickedIdx, idx] : [idx, lastClickedIdx]
      setSelectedStudentIds((prev) => {
        const next = new Set(prev)
        for (let i = from; i <= to; i++) {
          const sid = filteredStudentList[i]?.id
          if (!sid) continue
          if (checked) next.add(sid)
          else next.delete(sid)
        }
        return next
      })
    } else {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev)
        if (checked) next.add(id)
        else next.delete(id)
        return next
      })
    }
    setLastClickedIdx(idx)
  }

  const toggleAllVisibleStudents = (checked: boolean) => {
    setSelectedStudentIds(checked ? new Set(visibleStudentIds) : new Set())
    setLastClickedIdx(null)
  }

  // 「選択した N 名を [部屋] に追加」: pending に積むのみ (DB 書込は無し)
  // 同じ部屋に既保存(saved) と一致する変更は noop として無視する。
  const handleStageBulkAssign = () => {
    if (selectedStudentIds.size === 0) {
      alert("対象の学生を選択してください")
      return
    }
    if (!studentTargetRoom) {
      alert("登録先の部屋番号を選択してください")
      return
    }
    setPendingMap((prev) => {
      const next = { ...prev }
      for (const id of selectedStudentIds) {
        const saved = assignmentMap[id] || ""
        if (saved === studentTargetRoom) {
          // saved と同じなので pending は不要 (既存 pending があれば消す)
          delete next[id]
        } else {
          next[id] = studentTargetRoom
        }
      }
      return next
    })
    // 選択をクリアして次の操作に移れるようにする (target room はそのまま残す)
    setSelectedStudentIds(new Set())
    setLastClickedIdx(null)
    setStudentResultMsg("")
  }

  // 「選択した N 名の割当を解除」: pending null を積むのみ
  const handleStageBulkUnassign = () => {
    if (selectedStudentIds.size === 0) {
      alert("対象の学生を選択してください")
      return
    }
    setPendingMap((prev) => {
      const next = { ...prev }
      for (const id of selectedStudentIds) {
        const saved = assignmentMap[id] || ""
        if (!saved) {
          // 元から未割当なら解除は無意味 → pending を消す (もし新規割当 pending があった場合の取り消し)
          delete next[id]
        } else {
          next[id] = null
        }
      }
      return next
    })
    setSelectedStudentIds(new Set())
    setLastClickedIdx(null)
    setStudentResultMsg("")
  }

  // 1 行の保留変更を取り消す (元の状態に戻す)
  const handleRevertOneRow = (studentId: string) => {
    setPendingMap((prev) => {
      if (!(studentId in prev)) return prev
      const next = { ...prev }
      delete next[studentId]
      return next
    })
  }

  // 行ごとの 🗑 ボタン: 保留にして解除予定とする (saved がある場合のみ意味がある)
  const handleStageRowUnassign = (studentId: string) => {
    const saved = assignmentMap[studentId] || ""
    if (!saved) return
    setPendingMap((prev) => ({ ...prev, [studentId]: null }))
  }

  const handleDiscardPending = () => {
    if (meaningfulPendingCount === 0) return
    if (!confirm(`保留中の ${meaningfulPendingCount} 件の変更をすべて取り消します。よろしいですか?`)) return
    setPendingMap({})
    setStudentResultMsg("")
  }

  // 確定: pendingMap の中身を DB に反映する
  // - 部屋指定の pending → POST /api/students (upsert: register_student_canonical RPC)
  // - null pending → DELETE assignment
  const handleCommitChanges = async () => {
    if (meaningfulPendingCount === 0) {
      alert("保留中の変更がありません")
      return
    }
    setStudentProcessing(true)
    setStudentResultMsg("")
    try {
      // 1. 部屋指定 pending を抽出 → bulk POST
      const toAssign: Array<{ student: Student; room: string }> = []
      const toUnassign: string[] = []
      for (const [id, val] of Object.entries(pendingMap)) {
        const eff = getEffective(id)
        if (!eff.hasPending) continue
        if (val === null) {
          toUnassign.push(id)
        } else if (typeof val === "string") {
          const s = studentList.find((x) => x.id === id)
          if (s) toAssign.push({ student: s, room: val })
        }
      }

      let assigned = 0
      let unassigned = 0
      let failed = 0

      // 部屋ごとにまとめて 1 回ずつ POST するのも考えられるが、register_student_canonical は
      // 1 件ずつしか受けないため、items 配列でまとめて 1 リクエストに送る方がよい。
      if (toAssign.length > 0) {
        try {
          const items = toAssign.map(({ student, room }) => ({
            ...student,
            roomNumber: room,
            testSessionId: sessionId,
          }))
          await saveStudents(items)
          assigned = items.length
        } catch (e) {
          failed += toAssign.length
          console.error("[assignment-manager] bulk assign commit failed:", e)
        }
      }

      if (toUnassign.length > 0) {
        const results = await Promise.allSettled(
          toUnassign.map((id) =>
            fetch(
              `/api/test-sessions/${sessionId}/student-assignments?studentId=${encodeURIComponent(id)}`,
              { method: "DELETE", credentials: "same-origin" },
            ).then(async (r) => {
              if (!r.ok) {
                const err = await r.json().catch(() => null)
                throw new Error(err?.error || `${r.status}`)
              }
            }),
          ),
        )
        const ok = results.filter((r) => r.status === "fulfilled").length
        unassigned = ok
        failed += results.length - ok
      }

      const parts: string[] = []
      if (assigned > 0) parts.push(`${assigned} 件の割当`)
      if (unassigned > 0) parts.push(`${unassigned} 件の解除`)
      const summary = parts.length > 0 ? parts.join(" / ") : "(変更なし)"
      setStudentResultMsg(failed > 0
        ? `⚠ ${summary} を保存しましたが ${failed} 件失敗しました`
        : `✅ ${summary} を保存しました`)

      // pending を全クリアして DB から再取得
      setPendingMap({})
      await refreshStudentAssignments()
      setSelectedStudentIds(new Set())
      setLastClickedIdx(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[assignment-manager] commit failed:", msg, error)
      alert(`確定に失敗しました: ${msg}`)
    } finally {
      setStudentProcessing(false)
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

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">学生の割当</CardTitle>
          <CardDescription>
            上部のフィルタで対象学生を絞り込み、行のチェックボックス(Shift で範囲選択可)で選択してから、
            「[部屋] に追加」で保留中リストに積みます。連続して別の部屋を割当でき、
            最後に <strong>「確定」</strong> ボタンで一括保存します。確定するまで DB は変更されません。
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
                      const eff = getEffective(s.id)
                      const subjName =
                        subjects.find((sub) => sub.subjectCode === s.subjectCode)?.subjectName ||
                        s.subjectCode ||
                        "—"
                      // 行の背景色: pending 種別ごとに薄い色
                      const rowBg =
                        eff.pendingKind === "new" ? "bg-green-50" :
                        eff.pendingKind === "move" ? "bg-amber-50" :
                        eff.pendingKind === "unassign" ? "bg-red-50" :
                        ""
                      return (
                        <tr key={s.id} className={`border-t hover:bg-muted/20 ${rowBg}`}>
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
                            {eff.pendingKind === "new" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-200 text-green-800">新規(保留)</span>
                            )}
                            {eff.pendingKind === "move" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-800">移動(保留)</span>
                            )}
                            {eff.pendingKind === "unassign" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-red-200 text-red-800">解除(保留)</span>
                            )}
                            {!eff.hasPending && eff.savedRoom && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">割当済</span>
                            )}
                            {!eff.hasPending && !eff.savedRoom && (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">未割当</span>
                            )}
                          </td>
                          <td className="p-2 font-mono text-xs">
                            {eff.pendingKind === "move" ? (
                              <span>
                                <span className="line-through text-muted-foreground">{eff.savedRoom}</span>
                                {" → "}
                                <span className="font-semibold">{eff.effectiveRoom}</span>
                              </span>
                            ) : eff.pendingKind === "new" ? (
                              <span className="font-semibold">{eff.effectiveRoom}</span>
                            ) : eff.pendingKind === "unassign" ? (
                              <span className="line-through text-muted-foreground">{eff.savedRoom}</span>
                            ) : (
                              eff.savedRoom || "—"
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {eff.hasPending ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevertOneRow(s.id)}
                                title="この行の保留変更を取り消す"
                              >
                                <RotateCcw className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            ) : eff.savedRoom ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStageRowUnassign(s.id)}
                                title="この学生の割当を保留で解除"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 1 段目: ステージ操作 (保留に積む) */}
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
                  onClick={handleStageBulkUnassign}
                  disabled={studentProcessing || selectedStudentIds.size === 0}
                  title="選択した学生の割当を保留で解除する(確定で反映)"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  選択した {selectedStudentIds.size} 名を保留解除
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleStageBulkAssign}
                  disabled={
                    studentProcessing ||
                    selectedStudentIds.size === 0 ||
                    !studentTargetRoom
                  }
                  title="選択した学生を保留で部屋に追加する(確定で反映)"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {studentTargetRoom
                    ? `選択した ${selectedStudentIds.size} 名を ${studentTargetRoom} に追加`
                    : `選択した ${selectedStudentIds.size} 名を追加`}
                </Button>
              </div>
            </div>

            {/* 2 段目: 確定 / キャンセル */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t bg-muted/40 -mx-6 px-6 py-3 mt-3 rounded-b">
              <div className="text-sm">
                {meaningfulPendingCount > 0 ? (
                  <span className="font-medium text-amber-700">
                    保留中の変更: {meaningfulPendingCount} 件
                  </span>
                ) : (
                  <span className="text-muted-foreground">保留中の変更はありません</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleDiscardPending}
                  disabled={studentProcessing || meaningfulPendingCount === 0}
                  title="保留中の変更をすべて取り消す"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  キャンセル
                </Button>
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleCommitChanges}
                  disabled={studentProcessing || meaningfulPendingCount === 0}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {studentProcessing
                    ? "保存中..."
                    : meaningfulPendingCount > 0
                      ? `確定 (${meaningfulPendingCount} 件を保存)`
                      : "確定"}
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
