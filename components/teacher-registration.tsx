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
import { Home, UserPlus, Upload, Download, Trash2, ArrowLeft, AlertTriangle } from "lucide-react"
import {
  saveTeachers,
  loadTeachers,
  loadRooms,
  loadSubjects,
  loadTestSessions,
  type Teacher,
  type TeacherRole,
  type Room,
  type Subject,
  type TestSession,
} from "@/lib/data-storage"
import { useSession } from "@/lib/auth/use-session"
import { createClient } from "@/lib/supabase/client"
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table"

export function TeacherRegistration() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [accountType, setAccountType] = useState<string>("")
  const [universities, setUniversities] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "general" as TeacherRole,
    roomNumber: "",
    university_code: "", // Add university_code to formData
    subjectCode: "",

  })
  const [isDragging, setIsDragging] = useState(false)

  // 2026-05-04: 試験セッション必須化 (teachers.test_session_id NOT NULL 対応)
  const [testSessions, setTestSessions] = useState<TestSession[]>([])
  const [selectedTestSessionId, setSelectedTestSessionId] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    return sessionStorage.getItem("testSessionId") || ""
  })

  const onChangeSelectedSession = (v: string) => {
    setSelectedTestSessionId(v)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("testSessionId", v)
    }
  }

  // Phase 9b-β2d: sessionStorage("accountType") を useSession() に置換
  const { session, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading || !session) return
    const fetchData = async () => {
      try {
        const storedAccountType = session.accountType || ""
        setAccountType(storedAccountType)

        const testSessionId = selectedTestSessionId
        // Phase 9 Y-2 fix: subject_admin は自教科のみロード(全教科ロードすると保存時に Y-2 で 403)
        const subjectScope = session.accountType === "subject_admin" ? session.subjectCode : undefined
        // 2026-05-04: 試験セッション一覧も読み込む(セッション選択 UI のため)
        const universityCodeForSessions = session.universityCode || undefined
        const [teachersData, roomsData, subjectsData, sessionsData] = await Promise.all([
          loadTeachers(undefined, subjectScope, testSessionId),
          loadRooms(undefined, undefined, testSessionId),
          loadSubjects(),
          loadTestSessions(universityCodeForSessions),
        ])
        setTestSessions(Array.isArray(sessionsData) ? sessionsData : [])


        const sortedTeachers = Array.isArray(teachersData)
          ? teachersData.sort((a, b) => {
              const roomA = a.assignedRoomNumber || ""
              const roomB = b.assignedRoomNumber || ""
              return roomA.localeCompare(roomB, undefined, { numeric: true })
            })
          : []

        setTeachers(sortedTeachers)
        setRooms(Array.isArray(roomsData) ? roomsData : [])
        setSubjects(Array.isArray(subjectsData) ? subjectsData : [])

        try {
          const response = await fetch("/api/universities")

          if (response.ok) {
            const universitiesData = await response.json()

            const universityMap: Record<string, string> = {}
            if (Array.isArray(universitiesData)) {
              universitiesData.forEach((uni: any) => {
                universityMap[uni.university_code] = uni.university_name
              })
            }
            setUniversities(universityMap)
          } else {
            const errorText = await response.text()
          }
        } catch (error) {
        }
      } catch (error) {
        setTeachers([])
        setRooms([])
        setSubjects([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [session, isSessionLoading, selectedTestSessionId])

  const handleAddTeacher = () => {

    if (!selectedTestSessionId) {
      alert("先に試験セッションを選択してください")
      return
    }

    if (!formData.name || !formData.email || !formData.password) {
      alert("氏名、メールアドレス、パスワードは必須です")
      return
    }

    if (formData.roomNumber) {
      const roomExists = rooms.some((r) => r.roomNumber === formData.roomNumber)
      if (!roomExists) {
        alert("選択された部屋番号が部屋マスターに存在しません")
        return
      }
    }

    const newTeacher: Teacher = {
      id: Date.now().toString(),
      teacherId: Date.now().toString(),
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      assignedRoomNumber: formData.roomNumber,
      createdAt: new Date().toISOString(),
      universityCode: formData.university_code,
      subjectCode: formData.subjectCode,
      testSessionId: selectedTestSessionId,
    }


    setTeachers([...teachers, newTeacher])


    setFormData({
      name: "",
      email: "",
      password: "",
      role: "general",
      roomNumber: "",
      university_code: "",
      subjectCode: "",

    })
  }

  const parseCSV = (text: string) => {
    if (!selectedTestSessionId) {
      alert("先に試験セッションを選択してください")
      return
    }
    const lines = text.split("\n").filter((line) => line.trim())
    const newTeachers: Teacher[] = []
    const testSessionId = selectedTestSessionId

    for (let i = 1; i < lines.length; i++) {
      const [name, email, password, role, roomNumber, university_code, subjectCode] = lines[i]
        .split(",")
        .map((s) => s.trim())
      if (name && email && password) {
        let teacherRole: string = "general"
        if (role === "subject_admin" || role === "教科管理者") {
          teacherRole = "subject_admin"
        } else if (role === "university_admin" || role === "大学管理者") {
          teacherRole = "university_admin"
        } else if (role === "master_admin" || role === "マスター管理者") {
          teacherRole = "master_admin"
        }

        newTeachers.push({
          id: `${Date.now()}-${i}`,
          teacherId: `${Date.now()}-${i}`,
          name,
          email,
          password,
          role: teacherRole as any,
          assignedRoomNumber: roomNumber || "",
          createdAt: new Date().toISOString(),
          universityCode: university_code || "",
          subjectCode: subjectCode || "",
          testSessionId,
        })
      }
    }

    setTeachers([...teachers, ...newTeachers])
    alert(`${newTeachers.length}名の教員を追加しました`)
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "master_admin": return "マスター管理者"
      case "university_admin": return "大学管理者"
      case "subject_admin": return "教科管理者"
      default: return "一般"
    }
  }

  const handleExportCSV = () => {
    let csvContent: string
    if (accountType === "special_master") {
      // Phase 8c: パスワード列はエクスポートから除外(セキュリティ強化)
      csvContent =
        "大学名,氏名,メールアドレス（ログインID）,権限,担当部屋番号,教科コード\n" +
        teachers
          .map((t) => {
            const roleLabel = getRoleLabel(t.role)
            const universityName = universities[t.universityCode || ""] || ""
            return `${universityName},${t.name},${t.email},${roleLabel},${t.assignedRoomNumber},${t.subjectCode || ""}`
          })
          .join("\n")
    } else {
      // Phase 8c: パスワード列はエクスポートから除外(セキュリティ強化)
      csvContent =
        "氏名,メールアドレス（ログインID）,権限,担当部屋番号,教科コード\n" +
        teachers
          .map((t) => {
            const roleLabel = getRoleLabel(t.role)
            return `${t.name},${t.email},${roleLabel},${t.assignedRoomNumber},${t.subjectCode || ""}`
          })
          .join("\n")
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `教員一覧_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const handleDownloadTemplate = () => {
    const template =
      "大学名,氏名,メールアドレス（ログインID）,ログインパスワード,権限,担当部屋番号,教科コード\n東京大学,田中先生,tanaka@example.com,password123,教科管理者,101,数学101\n京都大学,鈴木先生,suzuki@example.com,password456,一般,102,文学102"
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "教員登録テンプレート.csv"
    link.click()
  }

  const handleConfirmRegistration = async () => {

    if (teachers.length === 0) {
      alert("登録する教員がいません")
      return
    }

    try {
      await saveTeachers(teachers)
      alert(`${teachers.length}名の教員情報を保存しました`)
      router.push("/admin/account-management")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[teacher-registration] save failed:", msg, error)
      alert(`教員情報の保存に失敗しました: ${msg}`)
    }
  }

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("この教員を削除してもよろしいですか？")) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.from("teachers").delete().eq("id", id)

      if (error) {
        alert("教員の削除に失敗しました")
        return
      }

      const updatedTeachers = teachers.filter((teacher) => teacher.id !== id)
      setTeachers(updatedTeachers)
      alert("教員を削除しました")
    } catch (error) {
      alert("教員の削除に失敗しました")
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
        <Card className="mx-auto max-w-6xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-primary">教員登録</CardTitle>
                <CardDescription>教員アカウントの登録と管理</CardDescription>
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
          </CardHeader>
        </Card>

        {/* 2026-05-04: 試験セッション必須化 — teachers.test_session_id NOT NULL 対応 */}
        <Card className="mx-auto max-w-6xl border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              試験セッションを選択
            </CardTitle>
            <CardDescription>
              教員アカウントは特定の試験セッションに紐づいて登録されます。先に対象の試験セッションを選択してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedTestSessionId} onValueChange={onChangeSelectedSession}>
              <SelectTrigger className="w-full md:w-[480px]">
                <SelectValue placeholder="試験セッションを選択してください" />
              </SelectTrigger>
              <SelectContent>
                {testSessions.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    登録可能な試験セッションがありません
                  </div>
                ) : (
                  testSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.description || "(名称未設定)"}
                      {s.testDate && ` — ${new Date(s.testDate).toLocaleDateString("ja-JP")}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!selectedTestSessionId && (
              <p className="text-xs text-amber-700 mt-2">
                ⚠ 試験セッションを選択するまで教員を登録できません。
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">手動登録</TabsTrigger>
            <TabsTrigger value="csv">CSV一括登録</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>教員情報入力</CardTitle>
                <CardDescription>1名ずつ手動で教員情報を登録できます</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">氏名 *</Label>
                    <Input
                      id="name"
                      placeholder="田中先生"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス（ログインID） *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="teacher@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">ログインパスワード *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="パスワードを入力"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">権限 *</Label>
                    <select
                      id="role"
                      className="flex h-10 w-full rounded-md border border-blue-500 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                      disabled={accountType !== "special_master" && accountType !== "university_master"}
                    >
                      <option value="general">一般（教員ログインのみ）</option>
                      <option value="subject_admin">教科管理者（教科データの管理可能）</option>
                      {(accountType === "special_master" || accountType === "university_master") && (
                        <option value="university_admin">大学管理者（大学内全データ管理）</option>
                      )}
                      {accountType === "special_master" && (
                        <option value="master_admin">マスター管理者（全権限）</option>
                      )}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {accountType === "special_master" || accountType === "university_master"
                        ? "一般: 教員ログインのみ / 教科管理者: 教科データ管理 / 大学管理者: 大学内全管理"
                        : "権限の変更はマスター管理者または大学管理者のみ可能です"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roomNumber">担当部屋番号 *</Label>
                    {rooms.length === 0 ? (
                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        部屋が登録されていません。先に部屋マスターで部屋を登録してください。
                      </div>
                    ) : (
                      <select
                        id="roomNumber"
                        className="flex h-10 w-full rounded-md border border-blue-500 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
                    <p className="text-xs text-muted-foreground">
                      この部屋に属する学生が自動的に評価対象として表示されます
                    </p>
                  </div>
                  {accountType === "special_master" && (
                    <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label htmlFor="subject">担当教科</Label>
                    <select
                      id="subject"
                      value={formData.subjectCode}
                      onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-blue-500 bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">選択してください</option>
                      {subjects
                        .filter((s) => !formData.university_code || s.universityCode === formData.university_code)
                        .map((subject) => (
                          <option key={subject.subjectCode} value={subject.subjectCode}>
                            {subject.subjectName}
                          </option>
                        ))}
                    </select>
                  </div>

                </div>
                <Button onClick={handleAddTeacher} className="w-full" size="lg">
                  <UserPlus className="w-4 h-4 mr-2" />
                  教員を追加
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="csv">
            <Card>
              <CardHeader>
                <CardTitle>CSV一括登録</CardTitle>
                <CardDescription>CSVファイルから複数の教員を一度に登録できます</CardDescription>
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
大学名,氏名,メールアドレス（ログインID）,ログインパスワード,権限,担当部屋番号,教科コード
  {"\n"}
  東京大学,田中先生,tanaka@example.com,password123,教科管理者,101,数学101{"\n"}
  京都大学,鈴木先生,suzuki@example.com,password456,一般,102,文学102
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>登録済み教員一覧</CardTitle>
                <CardDescription>現在 {teachers.length} 名が登録されています</CardDescription>
              </div>
              {teachers.length > 0 && (
                <Button onClick={handleExportCSV} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  CSV出力
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">教員が登録されていません</div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {accountType === "special_master" && <TableHead className="min-w-[150px]">大学名</TableHead>}
                      <TableHead className="min-w-[150px]">氏名</TableHead>
                      <TableHead className="min-w-[150px]">メールアドレス（ログインID）</TableHead>
                      <TableHead className="min-w-[150px]">ログインパスワード</TableHead>
                      <TableHead className="min-w-[150px]">権限</TableHead>
                      <TableHead className="min-w-[150px]">担当部屋番号</TableHead>
                      <TableHead className="min-w-[150px]">教科コード</TableHead>
                      
                      <TableHead className="min-w-[150px] text-center">操作</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher) => (
                      <TableRow key={teacher.email} className="border-b hover:bg-muted/50">
                        {accountType === "special_master" && (
                          <TableCell>{universities[teacher.universityCode || ""] || "-"}</TableCell>
                        )}
                        <TableCell className="font-medium">{teacher.name}</TableCell>
                        <TableCell>{teacher.email}</TableCell>
                        <TableCell>{"********"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              teacher.role === "master_admin"
                                ? "bg-red-100 text-red-800"
                                : teacher.role === "university_admin"
                                  ? "bg-blue-100 text-blue-800"
                                  : teacher.role === "subject_admin"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {getRoleLabel(teacher.role)}
                          </span>
                        </TableCell>
                        <TableCell>{teacher.assignedRoomNumber || "-"}</TableCell>
                        <TableCell>{teacher.subjectCode || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTeacher(teacher.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {teachers.length > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">登録を確定しますか？</p>
                  <p className="text-sm text-muted-foreground">{teachers.length}名の教員情報を保存します</p>
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
