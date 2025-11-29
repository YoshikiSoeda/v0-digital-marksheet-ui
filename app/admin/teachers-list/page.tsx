"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Home, Download, Trash2, Search, Edit, AlertTriangle } from "lucide-react"
import { loadTeachers, saveTeachers, loadRooms, type Teacher } from "@/lib/data-storage"

export default function TeachersListPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [rooms, setRooms] = useState<Array<{ roomNumber: string; roomName: string }>>([])
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "general" as "general" | "admin",
    assignedStudents: "",
    roomNumber: "",
  })

  useEffect(() => {
    setTeachers(loadTeachers())
    setRooms(loadRooms())
  }, [])

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setEditForm({
      name: teacher.name,
      email: teacher.email,
      password: teacher.password,
      role: teacher.role,
      assignedStudents: teacher.assignedStudents.join(", "),
      roomNumber: teacher.roomNumber,
    })
  }

  const handleSaveEdit = () => {
    if (!editingTeacher) return

    const updatedTeachers = teachers.map((t) =>
      t.id === editingTeacher.id
        ? {
            ...t,
            name: editForm.name,
            email: editForm.email,
            password: editForm.password,
            role: editForm.role,
            assignedStudents: editForm.assignedStudents
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            roomNumber: editForm.roomNumber,
          }
        : t,
    )

    saveTeachers(updatedTeachers)
    setTeachers(updatedTeachers)
    setEditingTeacher(null)
    alert("教員情報を更新しました")
  }

  const handleDelete = (id: string) => {
    if (confirm("この教員を削除しますか？")) {
      const updated = teachers.filter((t) => t.id !== id)
      saveTeachers(updated)
      setTeachers(updated)
    }
  }

  const handleDeleteAll = () => {
    if (confirm("全ての教員データを削除しますか？この操作は取り消せません。")) {
      saveTeachers([])
      setTeachers([])
      alert("全ての教員データを削除しました")
    }
  }

  const handleExportCSV = () => {
    const csv = [
      [
        "氏名",
        "メールアドレス（ログインID）",
        "ログインパスワード",
        "評価対象の学生（IDをセミコロン区切り）",
        "担当部屋番号",
        "権限",
      ],
      ...teachers.map((t) => [
        t.name,
        t.email,
        t.password,
        t.assignedStudents.join(";"),
        t.roomNumber || "",
        t.role === "admin" ? "管理者" : "一般",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `教員一覧_${new Date().toISOString().split("T")[0]}.csv`
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
            <h1 className="text-3xl font-bold text-primary">教員一覧</h1>
            <p className="text-muted-foreground">登録済み教員: {teachers.length}名</p>
          </div>
          <div className="flex gap-2">
            {teachers.length > 0 && (
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
            <CardTitle>教員データ</CardTitle>
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
                    <th className="text-left p-2">評価対象の学生</th>
                    <th className="text-left p-2">担当部屋番号</th>
                    <th className="text-center p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-muted-foreground">
                        登録されている教員がいません
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="border-b hover:bg-accent/50">
                        <td className="p-2">{teacher.name}</td>
                        <td className="p-2">{teacher.email}</td>
                        <td className="p-2">{"*".repeat(8)}</td>
                        <td className="p-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              teacher.role === "admin"
                                ? "bg-primary/10 text-primary"
                                : "bg-secondary text-secondary-foreground"
                            }`}
                          >
                            {teacher.role === "admin" ? "管理者" : "一般"}
                          </span>
                        </td>
                        <td className="p-2">{teacher.assignedStudents.join("; ") || "-"}</td>
                        <td className="p-2">
                          <span
                            className={
                              teacher.roomNumber && !isValidRoom(teacher.roomNumber) ? "text-red-600 font-bold" : ""
                            }
                          >
                            {teacher.roomNumber || "-"}
                            {teacher.roomNumber && !isValidRoom(teacher.roomNumber) && (
                              <AlertTriangle className="w-3 h-3 inline ml-1" />
                            )}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(teacher)}>
                              <Edit className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(teacher.id)}>
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

      {editingTeacher && (
        <Dialog open={!!editingTeacher} onOpenChange={() => setEditingTeacher(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>教員情報の編集</DialogTitle>
              <DialogDescription>教員の登録情報を編集できます</DialogDescription>
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "general" | "admin" })}
                >
                  <option value="general">一般</option>
                  <option value="admin">管理者</option>
                </select>
                <p className="text-xs text-muted-foreground">一般: 採点機能のみ / 管理者: 全機能アクセス可</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-students">評価対象の学生（カンマ区切り）</Label>
                <Input
                  id="edit-students"
                  placeholder="2024001, 2024002, 2024003"
                  value={editForm.assignedStudents}
                  onChange={(e) => setEditForm({ ...editForm, assignedStudents: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-room">担当部屋番号</Label>
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
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTeacher(null)}>
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
