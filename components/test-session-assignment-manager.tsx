"use client"

/**
 * ADR-007 Phase C-5: 試験セッション割当管理 UI
 *
 * 教員/患者役の canonical 一覧から、この試験セッションへの割当 (どの部屋を担当するか) を
 * 設定する。学生は別画面 (/admin/register-students の「過去学生から登録」タブ) で対応済。
 *
 * 動作:
 *   - canonical な teachers/patients を全件読み込み (fetched 1 回)
 *   - 既存 assignments を読み込み、初期値として展開
 *   - 各教員/患者役の行に部屋セレクト (未割当 / S101 / ...)
 *   - 「保存」 → PUT で全置換
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Home, ArrowLeft, Save, Users } from "lucide-react"
import { useSession } from "@/lib/auth/use-session"
import {
  loadTeachers, loadPatients, loadRooms, loadTestSessions,
  type Teacher, type Patient, type Room, type TestSession,
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

  useEffect(() => {
    if (isSessionLoading || !session) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const universityCode = session.universityCode || undefined

        const [allSessions, canonicalTeachers, canonicalPatients, canonicalRooms, teacherAssignsRes, patientAssignsRes] =
          await Promise.all([
            loadTestSessions(universityCode),
            loadTeachers(universityCode, undefined, undefined),  // canonical (no session filter)
            loadPatients(universityCode, undefined, undefined),  // canonical
            loadRooms(universityCode, undefined, undefined),
            fetch(`/api/test-sessions/${sessionId}/teacher-assignments`, { credentials: "same-origin" }),
            fetch(`/api/test-sessions/${sessionId}/patient-assignments`, { credentials: "same-origin" }),
          ])

        const ts = (Array.isArray(allSessions) ? allSessions : []).find((s) => s.id === sessionId) || null
        setTestSession(ts)
        setTeachers(Array.isArray(canonicalTeachers) ? canonicalTeachers : [])
        setPatients(Array.isArray(canonicalPatients) ? canonicalPatients : [])
        setRooms(Array.isArray(canonicalRooms) ? canonicalRooms : [])

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
      } catch (err) {
        console.error("[assignment-manager] fetch error:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
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

  const renderStudentTab = () => (
    <div className="space-y-3">
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-base">学生の割当</CardTitle>
          <CardDescription>
            学生の割当は <Link href="/admin/register-students" className="underline text-blue-600">学生登録ページ</Link>
            の「過去学生から登録」タブで行えます。フィルタ(大学・学年・教科)で絞り込んで複数学生を一括 import できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/admin/register-students">
            <Button variant="outline">
              <Users className="w-4 h-4 mr-2" />
              学生登録ページを開く
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )

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
