"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Home, Download, Trash2, Search, Edit, AlertTriangle } from "lucide-react"
import { loadPatients, savePatients, loadRooms, type Patient } from "@/lib/data-storage"

export default function PatientsListPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [rooms, setRooms] = useState<Array<{ roomNumber: string; roomName: string }>>([])
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "general" as "general" | "admin",
    roomNumber: "",
  })

  useEffect(() => {
    setPatients(loadPatients())
    setRooms(loadRooms())
  }, [])

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient)
    setEditForm({
      name: patient.name,
      email: patient.email,
      password: patient.password,
      role: patient.role,
      roomNumber: patient.assignedRoomNumber || "",
    })
  }

  const handleSaveEdit = () => {
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
            role: editForm.role,
            assignedRoomNumber: editForm.roomNumber,
          }
        : p,
    )

    savePatients(updatedPatients)
    setPatients(updatedPatients)
    setEditingPatient(null)
    alert("患者役情報を更新しました")
  }

  const handleDelete = (id: string) => {
    if (confirm("この患者役を削除しますか？")) {
      const updated = patients.filter((p) => p.id !== id)
      savePatients(updated)
      setPatients(updated)
    }
  }

  const handleDeleteAll = () => {
    if (confirm("全ての患者役データを削除しますか？この操作は取り消せません。")) {
      savePatients([])
      setPatients([])
      alert("全ての患者役データを削除しました")
    }
  }

  const handleExportCSV = () => {
    const csv = [
      ["氏名", "メールアドレス（ログインID）", "ログインパスワード", "権限", "担当部屋番号"],
      ...patients.map((p) => [
        p.name,
        p.email,
        p.password,
        p.role === "admin" ? "管理者" : "一般",
        p.assignedRoomNumber || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

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
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
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
                      <td colSpan={6} className="text-center p-8 text-muted-foreground">
                        登録されている患者役がいません
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((patient) => (
                      <tr key={patient.id} className="border-b hover:bg-accent/50">
                        <td className="p-2">{patient.name}</td>
                        <td className="p-2">{patient.email}</td>
                        <td className="p-2">{"*".repeat(8)}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              patient.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {patient.role === "admin" ? "管理者" : "一般"}
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
                    ))
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
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "general" | "admin" })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="general">一般</option>
                  <option value="admin">管理者</option>
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
