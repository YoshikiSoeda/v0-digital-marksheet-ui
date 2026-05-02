"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Home, Download, Trash2, Search, Edit, AlertTriangle } from "lucide-react"
import { loadPatients, savePatients, loadRooms, loadSubjects, type Patient, type Subject } from "@/lib/data-storage"
import { useSession } from "@/lib/auth/use-session"

export default function PatientsListPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [rooms, setRooms] = useState<Array<{ roomNumber: string; roomName: string }>>([])
  const [accountType, setAccountType] = useState<string>("")
  const [universities, setUniversities] = useState<Record<string, string>>({})
  const [universitiesList, setUniversitiesList] = useState<Array<{ university_code: string; university_name: string }>>(
    [],
  )
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all")
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "general",
    roomNumber: "",
    university_code: "",
    subjectCode: "",
  })

  // Phase 9b-β2d: sessionStorage("accountType") を useSession() に置換
  const { session, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading || !session) return
    const fetchData = async () => {
      const storedAccountType = session.accountType || ""
      setAccountType(storedAccountType)

      if (storedAccountType === "special_master") {
        try {
          const response = await fetch("/api/universities")
          if (response.ok) {
            const data = await response.json()
            setUniversitiesList(Array.isArray(data) ? data : [])
            const universityMap: Record<string, string> = {}
            if (Array.isArray(data)) {
              data.forEach((uni: any) => {
                universityMap[uni.university_code] = uni.university_name
              })
            }
            setUniversities(universityMap)
          }
        } catch (error) {
        }
      }

      const testSessionId = sessionStorage.getItem("testSessionId") || ""
      // 案 Y: subject_admin は自教科のみ表示
      const subjectScope = session.accountType === "subject_admin" ? session.subjectCode : undefined
      const [loadedPatients, loadedRooms, loadedSubjects] = await Promise.all([
        loadPatients(undefined, subjectScope, testSessionId),
        loadRooms(undefined, undefined, testSessionId),
        loadSubjects(),
      ])
      setPatients(Array.isArray(loadedPatients) ? loadedPatients : [])
      setRooms(Array.isArray(loadedRooms) ? loadedRooms : [])
      setSubjects(Array.isArray(loadedSubjects) ? loadedSubjects : [])
    }
    fetchData()
  }, [session, isSessionLoading])

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSubject = selectedSubjectFilter === "all" || p.subjectCode === selectedSubjectFilter
    return matchesSearch && matchesSubject
  })

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient)
    setEditForm({
      name: patient.name,
      email: patient.email,
      password: patient.password,
      role: patient.role,
      roomNumber: patient.assignedRoomNumber || "",
      university_code: patient.universityCode || "",
      subjectCode: patient.subjectCode || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingPatient) return

    if (editForm.roomNumber && !/^\d+$/.test(editForm.roomNumber)) {
      alert("部屋番号は数字のみで入力してください")
      return
    }

    const updatedPatients = patients.map((p) =>
      p.id === editingPatient.id
        ? {
            ...p,
            name: editForm.name,
            email: editForm.email,
            password: editForm.password,
            role: editForm.role as "general",
            assignedRoomNumber: editForm.roomNumber,
            universityCode: editForm.university_code,
          }
        : p,
    )

    await savePatients(updatedPatients)
    setPatients(updatedPatients)
    setEditingPatient(null)
    alert("患者役情報を更新しました")
  }

  const handleDelete = async (id: string) => {
    if (confirm("この患者役を削除しますか？")) {
      const updated = patients.filter((p) => p.id !== id)
      await savePatients(updated)
      setPatients(updated)
    }
  }

  const handleDeleteAll = async () => {
    if (confirm("全ての患者役データを削除しますか？この操作は取り消せません。")) {
      await savePatients([])
      setPatients([])
      alert("全ての患者役データを削除しました")
    }
  }

  const handleExportCSV = () => {
    const headers =
      accountType === "special_master"
        ? ["大学名", "氏名", "メールアドレス（ログインID）", "ログインパスワード", "権限", "担当部屋番号"]
        : ["氏名", "メールアドレス（ログインID）", "ログインパスワード", "権限", "担当部屋番号"]

    const rows = patients.map((p) => {
      const baseRow = [
        ...(accountType === "special_master" ? [universities[p.universityCode || ""] || ""] : []),
        p.name,
        p.email,
        p.password,
        "一般",
        p.assignedRoomNumber || "",
      ]
      return baseRow
    })

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `患者役一覧_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const isValidRoom = (roomNumber: string) => {
    if (!roomNumber) return true
    return rooms.some((r) => r.roomNumber === roomNumber)
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">患者役一覧</h1>
            <p className="text-muted-foreground">登録済み患者役: {patients.length}名</p>
          </div>
          <div className="flex gap-2">
            {patients.length > 0 && (
              <>
                <Button onClick={handleExportCSV} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  CSV出力
                </Button>
                <Button onClick={handleDeleteAll} variant="destructive">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  全削除
                </Button>
              </>
            )}
            <Link href="/admin/account-management">
              <Button variant="outline">
                <Home className="w-4 h-4 mr-2" />
                戻る
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>検索</CardTitle>
            <CardDescription>氏名、メールアドレスで検索</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="flex h-10 rounded-md border border-blue-500 bg-background px-3 py-2 text-sm"
              >
                <option value="all">全教科</option>
                {subjects.map((s) => (
                  <option key={s.subjectCode} value={s.subjectCode}>
                    {s.subjectName}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>患者役データ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {accountType === "special_master" && <th className="text-left p-2">大学名</th>}
                    <th className="text-left p-2">氏名</th>
                    <th className="text-left p-2">メールアドレス（ログインID）</th>
                    <th className="text-left p-2">ログインパスワード</th>
                    <th className="text-left p-2">権限</th>
                    <th className="text-left p-2">担当部屋番号</th>
                    <th className="text-center p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td
                        colSpan={accountType === "special_master" ? 7 : 6}
                        className="text-center p-8 text-muted-foreground"
                      >
                        登録されている患者役がいません
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((patient) => {
                      const universityCode = patient.universityCode || ""
                      const universityName = universities[universityCode] || "-"

                      return (
                        <tr key={patient.id} className="border-b hover:bg-accent/50">
                          {accountType === "special_master" && <td className="p-2">{universityName}</td>}
                          <td className="p-2">{patient.name}</td>
                          <td className="p-2">{patient.email}</td>
                          <td className="p-2">{"********"}</td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                "bg-blue-100 text-blue-800"
                              }`}
                            >
                              一般
                            </span>
                          </td>
                          <td className="p-2">
                            <span
                              className={
                                patient.assignedRoomNumber && !isValidRoom(patient.assignedRoomNumber)
                                  ? "text-red-600 font-bold"
                                  : ""
                              }
                            >
                              {patient.assignedRoomNumber || "-"}
                              {patient.assignedRoomNumber && !isValidRoom(patient.assignedRoomNumber) && (
                                <AlertTriangle className="w-3 h-3 inline ml-1" />
                              )}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex justify-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(patient)}>
                                <Edit className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(patient.id)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {editingPatient && (
        <Dialog open={!!editingPatient} onOpenChange={() => setEditingPatient(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>患者役情報の編集</DialogTitle>
              <DialogDescription>患者役の登録情報を編集できます</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {accountType === "special_master" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-university">大学名 *</Label>
                  {universitiesList.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      大学が登録されていません。先に大学マスターを登録してください。
                    </div>
                  ) : (
                    <select
                      id="edit-university"
                      value={editForm.university_code}
                      onChange={(e) => setEditForm({ ...editForm, university_code: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">選択してください</option>
                      {universitiesList.map((uni) => (
                        <option key={uni.university_code} value={uni.university_code}>
                          {uni.university_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-name">氏名 *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">メールアドレス（ログインID） *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">ログインパスワード *</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">権限 *</Label>
                <select
                  id="edit-role"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "general" })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="general">一般</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-room">担当部屋番号 *</Label>
                {rooms.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    部屋が登録されていません。先に部屋マスターを登録してください。
                  </div>
                ) : (
                  <select
                    id="edit-room"
                    value={editForm.roomNumber}
                    onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">選択してください</option>
                    {rooms.map((room) => (
                      <option key={room.roomNumber} value={room.roomNumber}>
                        {room.roomNumber} - {room.roomName}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-muted-foreground">この部屋に属する学生が自動的に評価対象になります</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPatient(null)}>
                キャンセル
              </Button>
              <Button onClick={handleSaveEdit}>保存</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
