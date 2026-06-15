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

import { useEffect, useState, useCallback, useRef, Fragment } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Home, ArrowLeft, Save, Search, Trash2, CheckCircle2, RotateCcw } from "lucide-react"
import { useSession } from "@/lib/auth/use-session"
import {
  loadTeachers, loadPatients, loadRooms, loadTestSessions,
  loadStudents, loadSubjects, saveStudents, loadTests,
  type Teacher, type Patient, type Room, type TestSession,
  type Student, type Subject, type Test,
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

  // 2026-05-19 副田さん仕様変更 B-1 Step 2:
  // セッションに含まれる tests から slot 数を決める。
  //   roleType=teacher の数 = 教員 slot 列数
  //   roleType=patient の数 = 患者役 slot 列数
  // 例: 教員側テスト 1 つだけのセッションでは「教員①, 権限」のみ。
  // 副田さん上限指示 (Step 1 質問) は 教員②/患者役1 だが、tests 構成に応じて
  // 動的に増減させるのが本仕様。
  const [sessionTests, setSessionTests] = useState<Test[]>([])
  const teacherSlotCount = sessionTests.filter((t) => (t.roleType || "teacher") === "teacher").length
  const patientSlotCount = sessionTests.filter((t) => t.roleType === "patient").length
  // inline edit が走っているセル (重複保存防止)
  const [savingSlot, setSavingSlot] = useState<string | null>(null)

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
  // チェック付き学生(確定対象を絞り込むため)
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
          allTests,
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
          loadTests(universityCode),
        ])

        const ts = (Array.isArray(allSessions) ? allSessions : []).find((s) => s.id === sessionId) || null
        setTestSession(ts)
        setTeachers(Array.isArray(canonicalTeachers) ? canonicalTeachers : [])
        setPatients(Array.isArray(canonicalPatients) ? canonicalPatients : [])
        setRooms(Array.isArray(canonicalRooms) ? canonicalRooms : [])
        setSubjects(Array.isArray(subjectsData) ? subjectsData : [])
        // 本セッションに紐づく tests のみ抽出 (副田さん B-1 Step 2)
        const myTests = Array.isArray(allTests)
          ? allTests.filter((t) => (t as Test & { testSessionId?: string }).testSessionId === sessionId)
          : []
        setSessionTests(myTests as Test[])

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

  // 2026-05-19 B-1 Step 2: inline edit ハンドラ
  // 任意の部屋 R の N 番目 slot (メール昇順) の教員 / 患者役 を入れ替える。
  //   - new = "" / null → 旧 slot 教員を unassign のみ
  //   - new = teacherId → 旧 slot 教員を外し、新教員を同じ R に assign
  // 即時 PUT で全教員 (or 全患者役) の割当を再送信する。
  const persistTeacherRooms = async (next: Record<string, string>) => {
    const items = Object.entries(next)
      .filter(([, room]) => room !== "")
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
  }
  const persistPatientRooms = async (next: Record<string, string>) => {
    const items = Object.entries(next)
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
  }

  // 教員 slot inline edit: room の slot N (メール昇順) の教員を newId に置き換え
  const handleSlotChangeTeacher = async (
    room: string,
    slotIndex: number,
    newTeacherId: string | null,
  ) => {
    if (!room) return
    const key = `t:${room}:${slotIndex}`
    setSavingSlot(key)
    setSavedMsg("")
    try {
      const existing = teachers
        .filter((t) => teacherRooms[t.id] === room)
        .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
      const old = existing[slotIndex]
      const next = { ...teacherRooms }
      if (old) {
        // 旧 slot N の教員を unassign (この room から外す)
        next[old.id] = ""
      }
      if (newTeacherId) {
        // 新教員を同 room に (他部屋にいたら移動)
        next[newTeacherId] = room
      }
      await persistTeacherRooms(next)
      setTeacherRooms(next)
      setSavedMsg(`部屋 ${room} の教員${slotIndex + 1}を更新しました`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      alert(`教員割当の更新に失敗: ${msg}`)
    } finally {
      setSavingSlot(null)
    }
  }

  const handleSlotChangePatient = async (
    room: string,
    slotIndex: number,
    newPatientId: string | null,
  ) => {
    if (!room) return
    const key = `p:${room}:${slotIndex}`
    setSavingSlot(key)
    setSavedMsg("")
    try {
      const existing = patients
        .filter((p) => patientRooms[p.id] === room)
        .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
      const old = existing[slotIndex]
      const next = { ...patientRooms }
      if (old) next[old.id] = ""
      if (newPatientId) next[newPatientId] = room
      await persistPatientRooms(next)
      setPatientRooms(next)
      setSavedMsg(`部屋 ${room} の患者役${slotIndex + 1}を更新しました`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      alert(`患者役割当の更新に失敗: ${msg}`)
    } finally {
      setSavingSlot(null)
    }
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

  // 2026-05-19 B-1 Step 3: 行ごと部屋セル Select の onValueChange
  // 「(未割当)」を選んだ場合と部屋を選んだ場合で pending を更新する。
  // saved と同じ部屋を選んだ場合は pending を消す (差分なしを示す)。
  const handleStageRowAssign = (studentId: string, roomNumber: string) => {
    setPendingMap((prev) => {
      const next = { ...prev }
      const saved = assignmentMap[studentId] || ""
      if (!roomNumber) {
        // (未割当)
        if (!saved) {
          delete next[studentId]
        } else {
          next[studentId] = null
        }
      } else {
        if (saved === roomNumber) {
          delete next[studentId]
        } else {
          next[studentId] = roomNumber
        }
      }
      return next
    })
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

  // 確定: チェックを付けた学生に紐づく pending のみ DB に反映する
  // - 部屋指定の pending → POST /api/students (upsert: register_student_canonical RPC)
  // - null pending → DELETE assignment
  const handleCommitChanges = async () => {
    if (selectedStudentIds.size === 0) {
      alert("確定対象の学生にチェックを付けてください")
      return
    }
    // チェック付き学生のうち pending を持つ ID 集合
    const targetIds = Array.from(selectedStudentIds).filter((id) => {
      const eff = getEffective(id)
      return eff.hasPending
    })
    if (targetIds.length === 0) {
      alert("チェックを付けた学生に保留中の変更がありません")
      return
    }
    setStudentProcessing(true)
    setStudentResultMsg("")
    try {
      // 1. 部屋指定 pending を抽出 → bulk POST
      const toAssign: Array<{ student: Student; room: string }> = []
      const toUnassign: string[] = []
      for (const id of targetIds) {
        const val = pendingMap[id]
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
      const failureReasons: string[] = []

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
          const msg = e instanceof Error ? e.message : String(e)
          failureReasons.push(`割当 ${toAssign.length} 件: ${msg}`)
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
        const rejections = results.filter(
          (r): r is PromiseRejectedResult => r.status === "rejected",
        )
        failed += rejections.length
        // 同じ理由が並びがちなので最大 3 件・重複排除して表示する
        const uniqueReasons = Array.from(
          new Set(
            rejections.map((r) =>
              r.reason instanceof Error ? r.reason.message : String(r.reason),
            ),
          ),
        ).slice(0, 3)
        for (const reason of uniqueReasons) {
          failureReasons.push(`解除: ${reason}`)
        }
      }

      const parts: string[] = []
      if (assigned > 0) parts.push(`${assigned} 件の割当`)
      if (unassigned > 0) parts.push(`${unassigned} 件の解除`)
      const summary = parts.length > 0 ? parts.join(" / ") : "(変更なし)"
      if (failed > 0) {
        const detail = failureReasons.length > 0 ? ` / 失敗理由: ${failureReasons.join("; ")}` : ""
        setStudentResultMsg(`⚠ ${summary} を保存しましたが ${failed} 件失敗しました${detail}`)
      } else {
        setStudentResultMsg(`✅ ${summary} を保存しました`)
      }

      // 確定対象の pending をクリアして DB から再取得
      setPendingMap((prev) => {
        const next = { ...prev }
        for (const id of targetIds) delete next[id]
        return next
      })
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
            行の「部屋」プルダウンで部屋を選び、対象学生のチェックボックスをオン(Shift で範囲選択可)にしてから
            <strong>「確定」</strong> ボタンで一括保存します。確定するまで DB は変更されません。
            教員/患者役のプルダウンはセル選択と同時に保存されます。
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

            <div className="border rounded-md max-h-[60vh] overflow-auto bg-white">
              <table className="min-w-full text-sm bg-white">
                <thead className="sticky top-0 bg-white border-b z-10">
                  <tr>
                    <th className="w-10 p-2"></th>
                    <th className="p-2 text-left whitespace-nowrap">学籍番号</th>
                    <th className="p-2 text-left whitespace-nowrap">氏名</th>
                    <th className="p-2 text-left whitespace-nowrap">メール</th>
                    <th className="p-2 text-left whitespace-nowrap">学年</th>
                    <th className="p-2 text-left whitespace-nowrap">部屋</th>
                    {/* 2026-05-19 B-1 Step 2: teacherSlotCount に応じて動的に列を生成
                        副田さん指示: 教員側テスト 1 つだけなら教員①のみ、2 つなら教員①② */}
                    {Array.from({ length: teacherSlotCount }, (_, i) => (
                      <Fragment key={`th-teacher-${i}`}>
                        <th className="p-2 text-left whitespace-nowrap">
                          教員{["①", "②", "③", "④", "⑤"][i] || `(${i + 1})`}
                        </th>
                        <th className="p-2 text-left whitespace-nowrap">
                          教員{["①", "②", "③", "④", "⑤"][i] || `(${i + 1})`}の権限
                        </th>
                      </Fragment>
                    ))}
                    {Array.from({ length: patientSlotCount }, (_, i) => (
                      <th key={`th-patient-${i}`} className="p-2 text-left whitespace-nowrap">
                        患者役{patientSlotCount > 1 ? ["①", "②", "③"][i] || `(${i + 1})` : ""}
                      </th>
                    ))}
                    <th className="p-2 text-left whitespace-nowrap">状態</th>
                    <th className="p-2 w-12"></th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredStudentList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6 + teacherSlotCount * 2 + patientSlotCount + 2}
                        className="text-center p-6 text-muted-foreground"
                      >
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
                      // 行の背景色: pending 種別ごとに薄い色
                      const rowBg =
                        eff.pendingKind === "new" ? "bg-green-50" :
                        eff.pendingKind === "move" ? "bg-amber-50" :
                        eff.pendingKind === "unassign" ? "bg-red-50" :
                        "bg-white"
                      // 2026-05-19: その学生の effective room に assign されている
                      // 教員(メール昇順) / 患者役 を slot N で表示
                      const room = eff.effectiveRoom
                      const teachersHere = room
                        ? teachers
                            .filter((t) => teacherRooms[t.id] === room)
                            .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
                        : []
                      const patientsHere = room
                        ? patients
                            .filter((p) => patientRooms[p.id] === room)
                            .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
                        : []
                      const roleLabel = (role: string | undefined): string => {
                        switch (role) {
                          case "master_admin": return "マスター管理者"
                          case "university_admin": return "大学管理者"
                          case "university_master": return "大学管理者"
                          case "subject_admin": return "教科管理者"
                          case "general": return "一般"
                          default: return role || ""
                        }
                      }
                      return (
                        <tr key={s.id} className={`border-t hover:bg-blue-50/40 ${rowBg}`}>
                          <td className="p-2">
                            <Checkbox
                              checked={selectedStudentIds.has(s.id)}
                              onCheckedChange={(v) => toggleStudent(s.id, Boolean(v))}
                            />
                          </td>
                          <td className="p-2 font-mono whitespace-nowrap">{s.studentId}</td>
                          <td className="p-2 whitespace-nowrap">{s.name}</td>
                          <td className="p-2 text-xs font-mono text-muted-foreground whitespace-nowrap">{s.email || "—"}</td>
                          <td className="p-2 whitespace-nowrap">{s.grade || "—"}</td>
                          <td className="p-1.5 whitespace-nowrap">
                            <Select
                              value={eff.effectiveRoom || UNASSIGNED}
                              onValueChange={(v) =>
                                handleStageRowAssign(s.id, v === UNASSIGNED ? "" : v)
                              }
                            >
                              <SelectTrigger
                                className={`h-8 w-32 text-xs bg-white ${
                                  eff.pendingKind === "move"
                                    ? "border-amber-500"
                                    : eff.pendingKind === "new"
                                      ? "border-green-500"
                                      : eff.pendingKind === "unassign"
                                        ? "border-red-500"
                                        : ""
                                }`}
                              >
                                <SelectValue placeholder="(未割当)" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px] overflow-y-auto">
                                <SelectItem value={UNASSIGNED}>(未割当)</SelectItem>
                                {rooms.map((r) => (
                                  <SelectItem key={r.id} value={r.roomNumber}>
                                    {r.roomNumber} - {r.roomName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          {/* 教員 slot N: 名前 + 権限ペア (動的) */}
                          {Array.from({ length: teacherSlotCount }, (_, i) => {
                            const slotKey = `t:${room}:${i}`
                            const tHere = teachersHere[i]
                            const currentId = tHere?.id || ""
                            const candidates = teachers
                              .slice()
                              .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
                            const disabled = !room || savingSlot === slotKey
                            return (
                              <Fragment key={`td-teacher-${s.id}-${i}`}>
                                <td className="p-1.5 whitespace-nowrap">
                                  <Select
                                    value={currentId || UNASSIGNED}
                                    disabled={disabled}
                                    onValueChange={(v) =>
                                      handleSlotChangeTeacher(room, i, v === UNASSIGNED ? null : v)
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-40 text-xs bg-white">
                                      <SelectValue placeholder={room ? "(未割当)" : "(部屋未定)"} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px] overflow-y-auto">
                                      <SelectItem value={UNASSIGNED}>(未割当)</SelectItem>
                                      {candidates.map((tt) => (
                                        <SelectItem key={tt.id} value={tt.id}>
                                          {tt.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                                  {tHere ? roleLabel(tHere.role) : "—"}
                                </td>
                              </Fragment>
                            )
                          })}
                          {/* 患者役 slot N (動的) */}
                          {Array.from({ length: patientSlotCount }, (_, i) => {
                            const slotKey = `p:${room}:${i}`
                            const pHere = patientsHere[i]
                            const currentId = pHere?.id || ""
                            const candidates = patients
                              .slice()
                              .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
                            const disabled = !room || savingSlot === slotKey
                            return (
                              <td key={`td-patient-${s.id}-${i}`} className="p-1.5 whitespace-nowrap">
                                <Select
                                  value={currentId || UNASSIGNED}
                                  disabled={disabled}
                                  onValueChange={(v) =>
                                    handleSlotChangePatient(room, i, v === UNASSIGNED ? null : v)
                                  }
                                >
                                  <SelectTrigger className="h-8 w-40 text-xs bg-white">
                                    <SelectValue placeholder={room ? "(未割当)" : "(部屋未定)"} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px] overflow-y-auto">
                                    <SelectItem value={UNASSIGNED}>(未割当)</SelectItem>
                                    {candidates.map((pp) => (
                                      <SelectItem key={pp.id} value={pp.id}>
                                        {pp.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            )
                          })}
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

            {/* 確定 / キャンセル */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t bg-muted/40 -mx-6 px-6 py-3 mt-3 rounded-b">
              <div className="text-sm">
                {meaningfulPendingCount > 0 ? (
                  <span className="font-medium text-amber-700">
                    保留中の変更: {meaningfulPendingCount} 件
                    {selectedStudentIds.size > 0 && (
                      <span className="ml-2 text-muted-foreground">
                        (チェック付き: {selectedStudentIds.size} 名)
                      </span>
                    )}
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
                  disabled={studentProcessing || selectedStudentIds.size === 0}
                  title="チェックを付けた学生の保留中変更を保存します"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {studentProcessing
                    ? "保存中..."
                    : selectedStudentIds.size > 0
                      ? `確定 (${selectedStudentIds.size} 名)`
                      : "確定"}
                </Button>
              </div>
            </div>

            {studentResultMsg && (
              <div
                className={
                  studentResultMsg.startsWith("⚠")
                    ? "p-3 rounded-md bg-amber-50 text-sm border border-amber-200 text-amber-900 break-words"
                    : "p-3 rounded-md bg-green-50 text-sm border border-green-200"
                }
              >
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
      <div className="max-w-[1400px] mx-auto space-y-6">
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

        {/* 2026-05-19 副田さん仕様変更: 教員/患者役/学生 3 タブを学生中心 1 テーブルに統合
            Step 1: 学生テーブルに 教員①/②/患者役 を read-only カラムとして表示
            Step 2 (次 PR): 各セル inline edit ドロップダウン */}
        {renderStudentTab()}
      </div>
    </div>
  )
}
