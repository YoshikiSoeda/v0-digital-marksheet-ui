"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Home, Download, Trash2, Search, Edit } from "lucide-react"
import { loadStudents, saveStudents, type Student } from "@/lib/data-storage"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function StudentsListPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [editForm, setEditForm] = useState({
    studentId: "",
    name: "",
    email: "",
    department: "",
    roomNumber: "",
  })

  useEffect(() => {
    setStudents(loadStudents())
  }, [])

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setEditForm({
      studentId: student.studentId,
      name: student.name,
      email: student.email || "",
      department: student.department,
      roomNumber: student.roomNumber,
    })
  }

  const handleSaveEdit = () => {
    if (!editingStudent) return

    const updated = students.map((s) =>
      s.id === editingStudent.id
        ? {
            ...s,
            studentId: editForm.studentId,
            name: editForm.name,
            email: editForm.email,
            department: editForm.department,
            roomNumber: editForm.roomNumber,
          }
        : s,
    )
    saveStudents(updated)
    setStudents(updated)
    setEditingStudent(null)
  }

  const handleDelete = (id: string) => {
    if (confirm("この学生を削除しますか？")) {
      const updated = students.filter((s) => s.id !== id)
      saveStudents(updated)
      setStudents(updated)
    }
  }

  const handleResetAllData = () => {
    if (confirm("全ての学生データを削除しますか？この操作は取り消せません。")) {
      saveStudents([])
      setStudents([])
      alert("全ての学生データを削除しました")
    }
  }

  const handleExportCSV = () => {
    const csv = [
      ["No.", "学籍番号", "氏名", "メールアドレス", "学部・学科", "部屋番号"],
      ...students.map((s, index) => [
        (index + 1).toString(),
        s.studentId,
        s.name,
        s.email || "",
        s.department,
        s.roomNumber,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `students_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">学生一覧</h1>
            <p className="text-muted-foreground">登録済み学生: {students.length}名</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              CSV出力
            </Button>
            <Button onClick={handleResetAllData} variant="destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              全削除
            </Button>
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
            <CardDescription>学生ID、氏名、部屋番号で検索</CardDescription>
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
            <CardTitle>学生データ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">No.</th>
                    <th className="text-left p-2">学籍番号</th>
                    <th className="text-left p-2">氏名</th>
                    <th className="text-left p-2">メールアドレス</th>
                    <th className="text-left p-2">学部・学科</th>
                    <th className="text-left p-2">部屋番号</th>
                    <th className="text-center p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-muted-foreground">
                        登録されている学生がいません
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, index) => (
                      <tr key={student.id} className="border-b hover:bg-accent/50">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2">{student.studentId}</td>
                        <td className="p-2">{student.name}</td>
                        <td className="p-2">{student.email || "-"}</td>
                        <td className="p-2">{student.department || "-"}</td>
                        <td className="p-2">{student.roomNumber}</td>
                        <td className="p-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(student)}>
                              <Edit className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(student.id)}>
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

      <Dialog open={!!editingStudent} onOpenChange={() => setEditingStudent(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>学生情報の編集</DialogTitle>
            <DialogDescription>学生の登録情報を編集します</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-studentId">学籍番号</Label>
              <Input
                id="edit-studentId"
                value={editForm.studentId}
                onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">氏名</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">メールアドレス（任意）</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">学部・学科</Label>
              <Input
                id="edit-department"
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-roomNumber">部屋番号</Label>
              <Input
                id="edit-roomNumber"
                value={editForm.roomNumber}
                onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value.replace(/\D/g, "") })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStudent(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
