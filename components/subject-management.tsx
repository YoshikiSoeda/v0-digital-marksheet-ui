"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Plus, Edit, Trash2, BookOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface Subject {
  id: string
  subject_code: string
  subject_name: string
  university_code: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface University {
  university_code: string
  university_name: string
}

export function SubjectManagement() {
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [universities, setUniversities] = useState<University[]>([])
  const [selectedUniversity, setSelectedUniversity] = useState<string>("all")
  const [accountType, setAccountType] = useState<string | null>(null)
  const [userUniversityCode, setUserUniversityCode] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    subject_code: "",
    subject_name: "",
    university_code: "",
    description: "",
    is_active: true,
  })

  useEffect(() => {
    const storedAccountType = sessionStorage.getItem("accountType")
    const storedUniversityCode = sessionStorage.getItem("universityCode")
    setAccountType(storedAccountType)
    setUserUniversityCode(storedUniversityCode)

    if (storedAccountType !== "special_master" && storedUniversityCode) {
      setSelectedUniversity(storedUniversityCode)
    }

    loadUniversities()
    loadSubjects()
  }, [])

  useEffect(() => {
    if (selectedUniversity !== "all") {
      loadSubjects()
    }
  }, [selectedUniversity])

  const loadUniversities = async () => {
    try {
      const response = await fetch("/api/universities")
      const data = await response.json()
      setUniversities(data)
    } catch (error) {
      console.error("Failed to load universities:", error)
      toast.error("大学データの読み込みに失敗しました")
    }
  }

  const loadSubjects = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/subjects")
      const data = await response.json()

      // Filter by selected university
      const filtered =
        selectedUniversity !== "all" ? data.filter((s: Subject) => s.university_code === selectedUniversity) : data

      setSubjects(filtered)
    } catch (error) {
      console.error("Failed to load subjects:", error)
      toast.error("教科データの読み込みに失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.subject_code || !formData.subject_name || !formData.university_code) {
      toast.error("教科コード、教科名、大学を入力してください")
      return
    }

    try {
      const url = editingSubject ? `/api/subjects/${editingSubject.id}` : "/api/subjects"
      const method = editingSubject ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingSubject ? "教科を更新しました" : "教科を登録しました")
        setIsDialogOpen(false)
        resetForm()
        loadSubjects()
      } else {
        throw new Error("Failed to save subject")
      }
    } catch (error) {
      console.error("Failed to save subject:", error)
      toast.error("教科の保存に失敗しました")
    }
  }

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      subject_code: subject.subject_code,
      subject_name: subject.subject_name,
      university_code: subject.university_code,
      description: subject.description || "",
      is_active: subject.is_active,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("この教科を削除してもよろしいですか？")) {
      return
    }

    try {
      const response = await fetch(`/api/subjects/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("教科を削除しました")
        loadSubjects()
      } else {
        throw new Error("Failed to delete subject")
      }
    } catch (error) {
      console.error("Failed to delete subject:", error)
      toast.error("教科の削除に失敗しました")
    }
  }

  const resetForm = () => {
    setFormData({
      subject_code: "",
      subject_name: "",
      university_code: selectedUniversity !== "all" ? selectedUniversity : "",
      description: "",
      is_active: true,
    })
    setEditingSubject(null)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => router.push("/admin/master-management")} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            マスター管理へ戻る
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-green-500" />
              <div>
                <CardTitle>教科マスター管理</CardTitle>
                <CardDescription>教科の登録・編集・削除を行います</CardDescription>
              </div>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  教科を追加
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingSubject ? "教科を編集" : "教科を追加"}</DialogTitle>
                  <DialogDescription>
                    教科情報を入力してください。教科コードは一意である必要があります。
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject_code">教科コード *</Label>
                      <Input
                        id="subject_code"
                        value={formData.subject_code}
                        onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                        placeholder="例: MATH101"
                        required
                        disabled={!!editingSubject}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject_name">教科名 *</Label>
                      <Input
                        id="subject_name"
                        value={formData.subject_name}
                        onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                        placeholder="例: 数学"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="university_code">大学 *</Label>
                    <Select
                      value={formData.university_code}
                      onValueChange={(value) => setFormData({ ...formData, university_code: value })}
                      disabled={accountType !== "special_master"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="大学を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {universities.map((uni) => (
                          <SelectItem key={uni.university_code} value={uni.university_code}>
                            {uni.university_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">説明</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="教科の説明を入力"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="is_active">アクティブ</Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                      キャンセル
                    </Button>
                    <Button type="submit">{editingSubject ? "更新" : "登録"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {accountType === "special_master" && (
            <div className="mb-4">
              <Label htmlFor="university-filter">大学でフィルタ</Label>
              <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
                <SelectTrigger>
                  <SelectValue placeholder="全ての大学" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全ての大学</SelectItem>
                  {universities.map((uni) => (
                    <SelectItem key={uni.university_code} value={uni.university_code}>
                      {uni.university_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              教科が登録されていません。「教科を追加」ボタンから登録してください。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>教科コード</TableHead>
                  <TableHead>教科名</TableHead>
                  {accountType === "special_master" && <TableHead>大学</TableHead>}
                  <TableHead>説明</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-mono">{subject.subject_code}</TableCell>
                    <TableCell className="font-medium">{subject.subject_name}</TableCell>
                    {accountType === "special_master" && (
                      <TableCell>
                        {universities.find((u) => u.university_code === subject.university_code)?.university_name ||
                          subject.university_code}
                      </TableCell>
                    )}
                    <TableCell className="max-w-xs truncate">{subject.description || "-"}</TableCell>
                    <TableCell>
                      {subject.is_active ? (
                        <span className="text-green-600 font-medium">アクティブ</span>
                      ) : (
                        <span className="text-gray-400">非アクティブ</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(subject)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(subject.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
