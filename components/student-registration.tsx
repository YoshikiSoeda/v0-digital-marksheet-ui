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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Home, UserPlus, Upload, Download, Trash2, ArrowLeft, Search, Users } from "lucide-react"
import { saveStudents, loadStudents, loadRooms, loadSubjects, type Student, type Room, type Subject } from "@/lib/data-storage"
import { useSession } from "@/lib/auth/use-session"

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
    grade: "",
    roomNumber: "",
    university_code: "",
    subjectCode: "",
  })
  const [isDragging, setIsDragging] = useState(false)
  const [accountType, setAccountType] = useState<string>("")
  const [universities, setUniversities] = useState<Record<string, string>>({})

  // Phase 9b-β2d: sessionStorage("accountType") を useSession() に置換
  const { session, isLoading: isSessionLoading } = useSession()

  // ADR-004 Phase B-2-d: 過去学生から登録 (bulk assign from canonical) 用 state
  const [canonicalSearchUniversity, setCanonicalSearchUniversity] = useState<string>("")
  const [canonicalSearchGrade, setCanonicalSearchGrade] = useState<string>("all")
  const [canonicalSearchSubject, setCanonicalSearchSubject] = useState<string>("all")
  const [canonicalTargetRoom, setCanonicalTargetRoom] = useState<string>("")
  const [canonicalStudents, setCanonicalStudents] = useState<Student[]>([])
  const [selectedCanonicalIds, setSelectedCanonicalIds] = useState<Set<string>>(new Set())
  const [searchingCanonical, setSearchingCanonical] = useState(false)
  const [importingCanonical, setImportingCanonical] = useState(false)
  const [canonicalImportResult, setCanonicalImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  useEffect(() => {
    if (isSessionLoading || !session) return
    const loadData = async () => {
      setIsLoading(true)
      try {
        const accountType = session.accountType || ""
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
          } else {
            const errorText = await response.text()
          }
        } catch (error) {
        }

        const testSessionId = sessionStorage.getItem("testSessionId") || ""
        // Phase 9 Y-2 fix: subject_admin は自教科のみロード(全教科ロードすると保存時に Y-2 で 403)
        const subjectScope = session.accountType === "subject_admin" ? session.subjectCode : undefined
        const [studentsData, roomsData, subjectsData] = await Promise.all([loadStudents(undefined, subjectScope, testSessionId), loadRooms(undefined, undefined, testSessionId), loadSubjects()])
        setSubjects(Array.isArray(subjectsData) ? subjectsData : [])
        setStudents(Array.isArray(studentsData) ? studentsData : [])
        setRooms(Array.isArray(roomsData) ? roomsData : [])

        // ADR-004 Phase B-2-d: 過去学生から登録タブの初期フィルタを session 文脈から設定
        if (session.universityCode) setCanonicalSearchUniversity(session.universityCode)
        if (session.accountType === "subject_admin" && session.subjectCode) {
          setCanonicalSearchSubject(session.subjectCode)
        }
      } catch (error) {
        setStudents([])
        setRooms([])
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [session, isSessionLoading])

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
  grade: formData.grade || undefined,
  roomNumber: formData.roomNumber,
  universityCode: formData.university_code,
  testSessionId: sessionStorage.getItem("testSessionId") || "",
  createdAt: new Date().toISOString(),
  }

    setStudents([...students, newStudent])
    setFormData({ name: "", studentId: "", email: "", department: "", grade: "", roomNumber: "", university_code: "", subjectCode: "" })
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
      const [studentId, name, email, department, grade, roomNumber, university_code] = lines[i].split(",").map((s) => s.trim())
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
          grade: grade || undefined,
          roomNumber,
          universityCode: university_code || "",
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
        "No.,学籍番号,大学名,氏名,メールアドレス,学部・学科,学年,部屋番号\n" +
        students
          .map(
            (s, index) =>
              `${index + 1},${s.studentId},${universities[s.universityCode || ""] || ""},${s.name},${s.email || ""},${s.department},${s.grade || ""},${s.roomNumber}`,
          )
          .join("\n")
    } else {
      csvContent =
        "No.,学籍番号,氏名,メールアドレス,学部・学科,学年,部屋番号\n" +
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
      "学籍番号,氏名,メールアドレス,学部・学科,学年,部屋番号,大学コード\n2024001,山田太郎,yamada@example.com,医学部医学科,4年,1,UNI001\n2024002,佐藤花子,,看護学部看護学科,5年,2,UNI002"
    const blob = new Blob(["\uFEFF" + template], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "学生登録テンプレート.csv"
    link.click()
  }

  // ADR-004 Phase B-2-d: 過去学生から条件で絞って bulk assign する一連のハンドラ
  // 既存の testSessionId 範囲の students をベースに「すでに今セッションに登録済み」を識別する
  const alreadyAssignedIds = new Set(students.map((s) => s.id))

  const selectableCanonicalIds = canonicalStudents
    .filter((s) => !alreadyAssignedIds.has(s.id))
    .map((s) => s.id)
  const allSelectableSelected =
    selectableCanonicalIds.length > 0 &&
    selectableCanonicalIds.every((id) => selectedCanonicalIds.has(id))

  const handleSearchCanonicalStudents = async () => {
    setSearchingCanonical(true)
    setCanonicalImportResult(null)
    try {
      const univ = canonicalSearchUniversity || undefined
      const subj = canonicalSearchSubject === "all" ? undefined : canonicalSearchSubject || undefined
      const grade = canonicalSearchGrade === "all" ? undefined : canonicalSearchGrade || undefined
      // testSessionId は undefined → canonical な学生一覧 (B-2-b 経路)
      const data = await loadStudents(univ, subj, undefined, grade)
      setCanonicalStudents(Array.isArray(data) ? data : [])
      setSelectedCanonicalIds(new Set())
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[student-registration] canonical search failed:", msg, error)
      alert(`過去学生の検索に失敗しました: ${msg}`)
    } finally {
      setSearchingCanonical(false)
    }
  }

  const toggleCanonicalStudent = (id: string, checked: boolean) => {
    setSelectedCanonicalIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleCanonicalAll = (checked: boolean) => {
    setSelectedCanonicalIds(checked ? new Set(selectableCanonicalIds) : new Set())
  }

  const handleBulkImportCanonical = async () => {
    if (selectedCanonicalIds.size === 0) {
      alert("登録する学生を選択してください")
      return
    }
    if (!canonicalTargetRoom) {
      alert("登録先の部屋番号を選択してください")
      return
    }
    const testSessionId = sessionStorage.getItem("testSessionId") || ""
    if (!testSessionId) {
      alert("試験セッションが選択されていません。試験セッションを選んでから再度お試しください。")
      return
    }

    setImportingCanonical(true)
    try {
      // 選択された canonical 学生を、現在のテストセッション + 指定された部屋に bulk assign
      // すでに alreadyAssignedIds に入っているものは UI 側で disable しているので含まれない想定だが、
      // 念のため再度フィルタしてスキップ件数を計算する
      const selected = canonicalStudents.filter((s) => selectedCanonicalIds.has(s.id))
      const toImport = selected.filter((s) => !alreadyAssignedIds.has(s.id))
      const skipped = selected.length - toImport.length

      const items = toImport.map((s) => ({
        ...s,
        roomNumber: canonicalTargetRoom,
        testSessionId,
      }))
      if (items.length > 0) {
        await saveStudents(items)
      }
      setCanonicalImportResult({ imported: items.length, skipped })

      // 既存 students リストを再ロードして「すでに登録済み」マーカーを更新
      const subjectScope = session?.accountType === "subject_admin" ? session?.subjectCode : undefined
      const refreshed = await loadStudents(undefined, subjectScope, testSessionId)
      setStudents(Array.isArray(refreshed) ? refreshed : [])
      setSelectedCanonicalIds(new Set())
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[student-registration] canonical bulk import failed:", msg, error)
      alert(`学生の bulk 登録に失敗しました: ${msg}`)
    } finally {
      setImportingCanonical(false)
    }
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
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[student-registration] save failed:", msg, error)
      alert(`学生情報の保存に失敗しました: ${msg}`)
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
      {(() => {  return null })()}
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">手動登録</TabsTrigger>
            <TabsTrigger value="csv">CSV一括登録</TabsTrigger>
            <TabsTrigger value="canonical">過去学生から登録</TabsTrigger>
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
                    <Label htmlFor="grade">学年</Label>
                    <Input
                      id="grade"
                      placeholder="例: 4年"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
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

          {/* ADR-004 Phase B-2-d: 過去学生から登録 (canonical な students テーブルから絞り込んで bulk assign) */}
          <TabsContent value="canonical">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  過去学生から登録
                </CardTitle>
                <CardDescription>
                  以前に登録された学生を、大学・学年・教科で絞り込み、現在の試験セッションに一括で登録できます。
                  すでに現在の試験セッションに登録済みの学生はグレー表示になり、自動的に除外されます。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* フィルタ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">大学</Label>
                    {accountType === "special_master" ? (
                      <Select
                        value={canonicalSearchUniversity || "all"}
                        onValueChange={(v) => setCanonicalSearchUniversity(v === "all" ? "" : v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="すべて" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">すべて</SelectItem>
                          {Object.entries(universities).map(([code, name]) => (
                            <SelectItem key={code} value={code}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center h-9 px-3 bg-muted rounded-md text-sm">
                        {universities[canonicalSearchUniversity] || canonicalSearchUniversity || "未設定"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">学年</Label>
                    <Select value={canonicalSearchGrade} onValueChange={setCanonicalSearchGrade}>
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
                        {subjects.find((s: any) => (s.subjectCode || s.subject_code) === canonicalSearchSubject)?.subjectName ||
                          subjects.find((s: any) => (s.subjectCode || s.subject_code) === canonicalSearchSubject)?.subject_name ||
                          canonicalSearchSubject ||
                          "未設定"}
                      </div>
                    ) : (
                      <Select value={canonicalSearchSubject} onValueChange={setCanonicalSearchSubject}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">すべて</SelectItem>
                          {subjects.map((s: any) => {
                            const code = s.subjectCode || s.subject_code
                            const name = s.subjectName || s.subject_name
                            return (
                              <SelectItem key={code} value={code}>
                                {name}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSearchCanonicalStudents} disabled={searchingCanonical}>
                    <Search className="w-4 h-4 mr-2" />
                    {searchingCanonical ? "検索中..." : "検索"}
                  </Button>
                </div>

                {/* 検索結果 */}
                {canonicalStudents.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={allSelectableSelected}
                          onCheckedChange={(v) => toggleCanonicalAll(Boolean(v))}
                          disabled={selectableCanonicalIds.length === 0}
                        />
                        <span>
                          全選択 ({selectedCanonicalIds.size} / {selectableCanonicalIds.length} 名選択中)
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        該当 {canonicalStudents.length} 名(うち登録済み{" "}
                        {canonicalStudents.length - selectableCanonicalIds.length} 名)
                      </div>
                    </div>

                    <div className="border rounded-md max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            <th className="w-10 p-2"></th>
                            <th className="p-2 text-left">学籍番号</th>
                            <th className="p-2 text-left">氏名</th>
                            <th className="p-2 text-left">学年</th>
                            <th className="p-2 text-left">教科</th>
                            <th className="p-2 text-left">状態</th>
                          </tr>
                        </thead>
                        <tbody>
                          {canonicalStudents.map((s) => {
                            const isAssigned = alreadyAssignedIds.has(s.id)
                            const subjName =
                              subjects.find((sub: any) => (sub.subjectCode || sub.subject_code) === s.subjectCode)?.subjectName ||
                              subjects.find((sub: any) => (sub.subjectCode || sub.subject_code) === s.subjectCode)?.subject_name ||
                              s.subjectCode ||
                              "—"
                            return (
                              <tr
                                key={s.id}
                                className={isAssigned ? "bg-muted/30 text-muted-foreground" : "hover:bg-muted/20"}
                              >
                                <td className="p-2">
                                  <Checkbox
                                    checked={selectedCanonicalIds.has(s.id)}
                                    disabled={isAssigned}
                                    onCheckedChange={(v) => toggleCanonicalStudent(s.id, Boolean(v))}
                                  />
                                </td>
                                <td className="p-2 font-mono">{s.studentId}</td>
                                <td className="p-2">{s.name}</td>
                                <td className="p-2">{s.grade || "—"}</td>
                                <td className="p-2">{subjName}</td>
                                <td className="p-2">
                                  {isAssigned ? (
                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-200">登録済</span>
                                  ) : (
                                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">未登録</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* 部屋指定 + 一括登録 */}
                    <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">登録先 部屋番号</Label>
                        <Select value={canonicalTargetRoom} onValueChange={setCanonicalTargetRoom}>
                          <SelectTrigger className="h-9 w-48">
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
                      <Button
                        size="lg"
                        className="bg-primary hover:bg-primary/90"
                        onClick={handleBulkImportCanonical}
                        disabled={
                          importingCanonical ||
                          selectedCanonicalIds.size === 0 ||
                          !canonicalTargetRoom
                        }
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {importingCanonical
                          ? "登録中..."
                          : `選択した ${selectedCanonicalIds.size} 名を登録`}
                      </Button>
                    </div>

                    {canonicalImportResult && (
                      <div className="p-3 rounded-md bg-green-50 text-sm border border-green-200">
                        ✅ {canonicalImportResult.imported} 名を登録しました
                        {canonicalImportResult.skipped > 0 && (
                          <span className="text-muted-foreground ml-2">
                            (すでに登録済みの {canonicalImportResult.skipped} 名はスキップ)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!searchingCanonical && canonicalStudents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    条件を指定して「検索」ボタンを押してください
                  </div>
                )}
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
                          <td className="p-3">{universities[student.universityCode || ""] || "-"}</td>
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
