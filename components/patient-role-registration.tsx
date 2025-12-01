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
import { Home, UserPlus, Upload, Download, Trash2 } from "lucide-react"
import { savePatients, loadPatients, loadRooms, type Patient, type Room } from "@/lib/data-storage"

export function PatientRoleRegistration() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "general" as "general" | "admin",
    roomNumber: "",
  })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientsData, roomsData] = await Promise.all([loadPatients(), loadRooms()])

        const sortedPatients = Array.isArray(patientsData)
          ? patientsData.sort((a, b) => {
              const roomA = a.assignedRoomNumber || ""
              const roomB = b.assignedRoomNumber || ""
              return roomA.localeCompare(roomB)
            })
          : []

        setPatients(sortedPatients)
        setRooms(Array.isArray(roomsData) ? roomsData : [])
      } catch (error) {
        console.error("[v0] Error loading data:", error)
        setPatients([])
        setRooms([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleAddPatient = () => {
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

    const newPatient: Patient = {
      id: Date.now().toString(),
      patientId: Date.now().toString(),
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      assignedRoomNumber: formData.roomNumber,
      createdAt: new Date().toISOString(),
    }

    setPatients([...patients, newPatient])
    setFormData({ name: "", email: "", password: "", role: "general", roomNumber: "" })
  }

  const handleDeletePatient = async (id: string) => {
    const patient = patients.find((p) => p.id === id)
    if (!patient) return

    const confirmed = window.confirm(`${patient.name} を削除してもよろしいですか？\n\nこの操作は取り消せません。`)
    if (!confirmed) return

    try {
      // Delete from local state
      const updatedPatients = patients.filter((p) => p.id !== id)
      setPatients(updatedPatients)

      // Save to Supabase immediately
      await savePatients(updatedPatients)
      alert(`${patient.name} を削除しました`)
    } catch (error) {
      console.error("[v0] Error deleting patient:", error)
      alert("削除中にエラーが発生しました")
      // Reload data on error
      const data = await loadPatients()
      setPatients(Array.isArray(data) ? data : [])
    }
  }

  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter((line) => line.trim())
    const newPatients: Patient[] = []

    for (let i = 1; i < lines.length; i++) {
      const [name, email, password, role, roomNumber] = lines[i].split(",").map((s) => s.trim())
      if (name && email && password) {
        newPatients.push({
          id: `${Date.now()}-${i}`,
          patientId: `${Date.now()}-${i}`,
          name,
          email,
          password,
          role: (role === "admin" ? "admin" : "general") as "general" | "admin",
          assignedRoomNumber: roomNumber || "",
          createdAt: new Date().toISOString(),
        })
      }
    }

    setPatients([...patients, ...newPatients])
    alert(`${newPatients.length}名の患者役を追加しました`)
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
    const csvContent =
      "氏名,メールアドレス（ログインID）,ログインパスワード,権限,担当部屋番号\n" +
      patients
        .map(
          (p) =>
            `${p.name},${p.email},${p.password},${p.role === "admin" ? "管理者" : "一般"},${p.assignedRoomNumber || ""}`,
        )
        .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `患者役一覧_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const handleDownloadTemplate = () => {
    const template =
      "氏名,メールアドレス（ログインID）,ログインパスワード,権限,担当部屋番号\n高橋様,takahashi@example.com,password123,一般,101\n伊藤様,ito@example.com,password456,管理者,102"
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "患者役登録テンプレート.csv"
    link.click()
  }

  const handleConfirmRegistration = async () => {
    try {
      await savePatients(patients)
      alert(`${patients.length}名の患者役情報を保存しました`)
      router.push("/admin/account-management")
    } catch (error) {
      console.error("[v0] Error saving patients:", error)
      alert("保存中にエラーが発生しました")
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">患者役登録</h1>
            <p className="text-muted-foreground">患者役評価者情報を登録・管理</p>
          </div>
          <Link href="/admin/account-management">
            <Button variant="outline">
              <Home className="w-4 h-4 mr-2" />
              アカウント管理に戻る
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">手動登録</TabsTrigger>
            <TabsTrigger value="csv">CSV一括登録</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>患者役情報入力</CardTitle>
                <CardDescription>1名ずつ手動で患者役情報を登録できます</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">氏名 *</Label>
                    <Input
                      id="name"
                      placeholder="高橋様"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス（ログインID） *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="patient@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">権限 *</Label>
                    <select
                      id="role"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as "general" | "admin" })}
                    >
                      <option value="general">一般</option>
                      <option value="admin">管理者</option>
                    </select>
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
                    <p className="text-xs text-muted-foreground">この部屋に属する学生が自動的に評価対象になります</p>
                  </div>
                </div>
                <Button onClick={handleAddPatient} className="w-full" size="lg">
                  <UserPlus className="w-4 h-4 mr-2" />
                  患者役を追加
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="csv">
            <Card>
              <CardHeader>
                <CardTitle>CSV一括登録</CardTitle>
                <CardDescription>CSVファイルから複数の患者役を一度に登録できます</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4">
                  <Button onClick={handleDownloadTemplate} variant="outline" size="lg">
                    <Download className="w-4 h-4 mr-2" />
                    CSVテンプレートをダウンロード
                  </Button>

                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging ? "border-primary bg-primary/5" : "border-border"
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
                      氏名,メールアドレス（ログインID）,ログインパスワード,権限,担当部屋番号
                      {"\n"}
                      高橋様,takahashi@example.com,password123,一般,101
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
                <CardTitle>登録済み患者役一覧</CardTitle>
                <CardDescription>現在 {patients.length} 名が登録されています</CardDescription>
              </div>
              {patients.length > 0 && (
                <Button onClick={handleExportCSV} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  CSV出力
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {patients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">患者役が登録されていません</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold">氏名</th>
                      <th className="text-left p-3 font-semibold">メールアドレス（ログインID）</th>
                      <th className="text-left p-3 font-semibold">ログインパスワード</th>
                      <th className="text-left p-3 font-semibold">権限</th>
                      <th className="text-left p-3 font-semibold">担当部屋番号</th>
                      <th className="text-center p-3 font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient) => (
                      <tr key={patient.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">{patient.name}</td>
                        <td className="p-3">{patient.email}</td>
                        <td className="p-3">{"*".repeat(8)}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              patient.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {patient.role === "admin" ? "管理者" : "一般"}
                          </span>
                        </td>
                        <td className="p-3">{patient.assignedRoomNumber || "-"}</td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePatient(patient.id)}
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

        {patients.length > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">登録を確定しますか？</p>
                  <p className="text-sm text-muted-foreground">{patients.length}名の患者役情報を保存します</p>
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
