"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Home, UserPlus, Upload, Download, Trash2, ArrowLeft } from "lucide-react"
import { saveStudents, loadStudents, loadRooms, loadSubjects, type Student, type Room, type Subject } from "@/lib/data-storage"

export function StudentRegistration() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [rooms, setRooms] = useState<Room[]>([]) // Add rooms state
  const [isLoading, setIsLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [formData, setFormData] = useState({
    name: "",
    studentId: "",
    email: "",
    department: "",
    roomNumber: "",
    university_code: "",
    subjectCode: "",
  })
  const [isDragging, setIsDragging] = useState(false)
  const [accountType, setAccountType] = useState<string>("")
  const [universities, setUniversities] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const accountType = sessionStorage.getItem("accountType") || ""
        setAccountType(accountType as any)

        try {
          const response = await fetch("/api/universities")

          if (response.ok) {
            const data = await response.json()

            const universityMap: Record<string, string> = {}
            if (Array.isArray(data)) {
              data.forEach((uni: any) => {
                universityMap[uni.university_code] = uni.university_name
              })
            }
            setUniversities(universityMap)
          }
        } catch (error) {
          console.error("Error fetching universities:", error)
        }

        const testSessionId = sessionStorage.getItem("testSessionId") || ""
        const [studentsData, roomsData, subjectsData] = await Promise.all([loadStudents(undefined, undefined, testSessionId), loadRooms(undefined, undefined, testSessionId), loadSubjects()])
        setSubjects(Array.isArray(subjectsData) ? subjectsData : [])
        setStudents(Array.isArray(studentsData) ? studentsData : [])
        setRooms(Array.isArray(roomsData) ? roomsData : [])
      } catch (error) {
        console.error("Error loading data:", error)
        setStudents([])
        setRooms([])
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleAddStudent = () => {
    if (!formData.name || !formData.studentId || !formData.department || !formData.roomNumber) {
      alert("学籍番号、氏名、学部・学科、部屋番号は必須です")
      return
    }

    const roomExists = rooms.some((r) => r.roomNumber === formData.roomNumber)
    if (!roomExists) {
      alert("選択された部屋番号が部屋マスターに存在しません")
      return
    }

  const newStudent: Student = {
  id: crypto.randomUUID(),
  studentId: formData.studentId,
  name: formData.name,
  email: formData.email || undefined,
  department: formData.department,
  roomNumber: formData.roomNumber,
  university_code: formData.university_code,
  testSessionId: sessionStorage.getItem("testSessionId") || "",
  createdAt: new Date().toISOString(),
  }

    setStudents([...students, newStudent])
    setFormData({ name: "", studentId: "", email: "", department: "", roomNumber: "", university_code: "" })
  }

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter((s) => s.id !== id))
  }

  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter((line) => line.trim())
    const newStudents: Student[] = []
    const invalidRooms: string[] = []
    const testSessionId = sessionStorage.getItem("testSessionId") || ""

    for (let i = 1; i < lines.length; i++) {
      const [studentId, name, email, department, roomNumber, university_code] = lines[i].split(",").map((s) => s.trim())
      if (studentId && name && department && roomNumber) {
        const roomExists = rooms.some((r) => r.roomNumber === roomNumber)
        if (!roomExists) {
          invalidRooms.push(roomNumber)
        }

        newStudents.push({
          id: crypto.randomUUID(),
          studentId,
          name,
          email: email || undefined,
          department,
          roomNumber,
          university_code: university_code || "",
          testSessionId,
          createdAt: new Date().toISOString(),
        })
      }
    }

    setStudents([...students, ...newStudents])

    if (invalidRooms.length > 0) {
      alert(
        `${newStudents.length}名の学生を追加しました\n\n警告: 以下の部屋番号が部屋マスターに存在しません:\n${[...new Set(invalidRooms)].join(", ")}\n\n部屋マスターに登録後、学生一覧から修正してください。`,
      )
    } else {
      alert(`${newStudents.length}名の学生を追加しました`)
    }
  }

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      parseCSV(text)
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith(".csv")) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        parseCSV(text)
      }
      reader.readAsText(file)
    } else {
      alert("CSVファイルをアップロードしてください")
    }
  }

  const handleFileSelectClick = () => {
    document.getElementById("csv-upload")?.click()
  }

  const handleExportCSV = () => {
    let csvContent
    if (accountType === "special_master") {
      csvContent =
        "No.,学籍番号,大学名,氏名,メールアドレス,学部・学科,部屋番号\n" +
        students
          .map(
            (s, index) =>
              `${index + 1},${s.studentId},${universities[s.university_code || ""] || ""},${s.name},${s.email || ""},${s.department},${s.roomNumber}`,
          )
          .join("\n")
    } else {
      csvContent =
        "No.,学籍番号,氏名,メールアドレス,学部・学科,部屋番号\n" +
        students
          .map((s, index) => `${index + 1},${s.studentId},${s.name},${s.email || ""},${s.department},${s.roomNumber}`)
          .join("\n")
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `学生一覧_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const handleDownloadTemplate = () => {
    const template =
      "学籍番号,氏名,メールアドレス,学部・学科,部屋番号,大学コード\n2024001,山田太郎,yamada@example.com,医学部医学科,1,UNI001\n2024002,佐藤花子,,看護学部看護学科,2,UNI002"
    const blob = new Blob(["\uFEFF" + template], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "学生登録テンプレート.csv"
    link.click()
  }

  const handleConfirmRegistration = async () => {
    if (students.length === 0) {
      alert("登録する学生がいません")
      return
    }

    try {
      await saveStudents(students)
      alert(`${students.length}名の学生情報を保存しました`)
      router.push("/admin/account-management")
    } catch (error) {
      console.error("Error saving students:", error)
      alert("学生情報の保存中にエラーが発生しました")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">学生登録</h1>
            <p className="text-muted-foreground">受験者情報を登録・管理</p>
          </div>
          <div className="flex gap-2">
            {accountType === "special_master" && (
              <Link href="/admin/account-management">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  戻る
                </Button>
              </Link>
            )}
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm">
                <Home className="mr-2 h-4 w-4" />
                ダッシュボード
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">手動登録</TabsTrigger>
            <TabsTrigger value="csv">CSV一括登録</TabsTrigger>
          </TabsList>

          {/* Manual Registration */}
          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>学生情報入力</CardTitle>
                <CardDescription>1名ずつ手動で学生情報を登録できます</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentId">学籍番号 *</Label>
                    <Input
                      id="studentId"
                      placeholder="2024001"
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">氏名 *</Label>
                    <Input
                      id="name"
                      placeholder="山田太郎"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス（任意）</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">学部・学科 *</Label>
                    <Input
                      id="department"
                      placeholder="医学部医学科"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roomNumber">部屋番号 *</Label>
                    {rooms.length === 0 ? (
                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        部屋が登録されていません。先に部屋マスターで部屋を登録してください。
                      </div>
                    ) : (
                      <select
                        id="roomNumber"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={formData.roomNumber}
                        onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      >
                        <option value="">部屋を選択してください</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.roomNumber}>
                            {room.roomNumber} - {room.roomName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subjectCode">教科</Label>
                    <select
                      id="subjectCode"
                      className="flex h-10 w-full rounded-md border border-blue-500 bg-background px-3 py-2 text-sm"
                      value={formData.subjectCode}
                      onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                    >
                      <option value="">選択してください</option>
                      {subjects.map((s) => (
                        <option key={s.subjectCode} value={s.subjectCode}>
                          {s.subjectName}
                        </option>
                      ))}
                    </select>
                  </div>
                  {accountType === "special_master" && (
                    <div className="grid gap-2">
                      <Label htmlFor="university">大学</Label>
                      <select
                        id="university"
                        value={formData.university_code}
                        onChange={(e) => setFormData({ ...formData, university_code: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-blue-500 bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">選択してください</option>
                        {Object.entries(universities).map(([code, name]) => (
                          <option key={code} value={code}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <Button onClick={handleAddStudent} className="w-full" size="lg" disabled={rooms.length === 0}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  学生を追加
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CSV Upload */}
          <TabsContent value="csv">
            <Card>
              <CardHeader>
                <CardTitle>CSV一括登録</CardTitle>
                <CardDescription>CSVファイルから複数の学生を一度に登録できます</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4">
                  <Button onClick={handleDownloadTemplate} variant="outline" size="lg">
                    <Download className="w-4 h-4 mr-2" />
                    CSVテンプレートをダウンロード
                  </Button>

                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging ? "border-primary bg-primary/5" : "border-gray-200"
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <div className="text-lg font-semibold mb-2">CSVファイルをアップロード</div>
                    <div className="text-sm text-muted-foreground mb-4">
                      クリックしてファイルを選択、またはドラッグ&ドロップ
                    </div>
                    <Input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                    <Button type="button" variant="secondary" onClick={handleFileSelectClick}>
                      ファイルを選択
                    </Button>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm font-semibold mb-2">CSV形式の例：</p>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
                      学籍番号,氏名,メールアドレス,学部・学科,部屋番号,大学コード{"\n"}
                      2024001,山田太郎,yamada@example.com,医学部医学科,1,UNI001{"\n"}
                      2024002,佐藤花子,,看護学部看護学科,2,UNI002
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Student List */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>登録済み学生一覧</CardTitle>
                <CardDescription>現在 {students.length} 名が登録されています</CardDescription>
              </div>
              {students.length > 0 && (
                <Button onClick={handleExportCSV} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  CSV出力
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">学生が登録されていません</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      {accountType === "special_master" && <th className="text-left p-3 font-semibold">大学名</th>}
                      <th className="text-left p-3 font-semibold">学籍番号</th>
                      <th className="text-left p-3 font-semibold">氏名</th>
                      <th className="text-left p-3 font-semibold">メールアドレス</th>
                      <th className="text-left p-3 font-semibold">学部・学科</th>
                      <th className="text-left p-3 font-semibold">部屋番号</th>
                      <th className="text-center p-3 font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b hover:bg-muted/50">
                        {accountType === "special_master" && (
                          <td className="p-3">{universities[student.university_code || ""] || "-"}</td>
                        )}
                        <td className="p-3 font-medium">{student.studentId}</td>
                        <td className="p-3">{student.name}</td>
                        <td className="p-3">{student.email || "-"}</td>
                        <td className="p-3">{student.department}</td>
                        <td className="p-3">部屋 {student.roomNumber}</td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {students.length > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">登録を確定しますか？</p>
                  <p className="text-sm text-muted-foreground">{students.length}名の学生情報を保存します</p>
                </div>
                <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleConfirmRegistration}>
                  登録を確定
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
