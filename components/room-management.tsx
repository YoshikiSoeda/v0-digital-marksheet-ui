"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Edit, Trash2, Home, Upload, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loadRooms, saveRooms, loadSubjects, loadTestSessions, type Room, type Subject, type TestSession } from "@/lib/data-storage"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [isAddingRoom, setIsAddingRoom] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [newRoomNumber, setNewRoomNumber] = useState("")
  const [newRoomName, setNewRoomName] = useState("")
  const [newUniversityCode, setNewUniversityCode] = useState("")
  const [newSubjectCode, setNewSubjectCode] = useState("")
  const [editRoomNumber, setEditRoomNumber] = useState("")
  const [editRoomName, setEditRoomName] = useState("")
  const [editUniversityCode, setEditUniversityCode] = useState("")
  const [editSubjectCode, setEditSubjectCode] = useState("")
  const [isSpecialMaster, setIsSpecialMaster] = useState(false)
  const [universities, setUniversities] = useState<Record<string, string>>({})
  const [universitiesList, setUniversitiesList] = useState<Array<{ code: string; name: string }>>([])
  const [selectedUniversityFilter, setSelectedUniversityFilter] = useState<string>("all")
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all")
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [testSessions, setTestSessions] = useState<TestSession[]>([])
  const router = useRouter()

  useEffect(() => {
    const accountType = sessionStorage.getItem("accountType")
    setIsSpecialMaster(accountType === "special_master")

    if (accountType === "special_master") {
      fetch("/api/universities")
        .then((res) => res.json())
        .then((data) => {
          const universityMap: Record<string, string> = {}
          const universityList: Array<{ code: string; name: string }> = []
          data.forEach((uni: any) => {
            universityMap[uni.university_code] = uni.university_name
            universityList.push({ code: uni.university_code, name: uni.university_name })
          })
          setUniversities(universityMap)
          setUniversitiesList(universityList)
        })
        .catch((err) => console.error("[v0] Failed to fetch universities:", err))
    }

    const fetchRooms = async () => {
      const testSessionId = sessionStorage.getItem("testSessionId") || ""
      const loadedRooms = await loadRooms(undefined, undefined, testSessionId)
      setRooms(Array.isArray(loadedRooms) ? loadedRooms : [])
    }
    fetchRooms()

    const fetchSubjects = async () => {
      const loadedSubjects = await loadSubjects()
      setSubjects(loadedSubjects)
    }
    fetchSubjects()

    const fetchTestSessions = async () => {
      const loadedSessions = await loadTestSessions()
      setTestSessions(loadedSessions)
    }
    fetchTestSessions()
  }, [])

  const handleAddRoom = async () => {
    if (!newRoomNumber || !newRoomName) {
      alert("部屋番号と部屋名を入力してください")
      return
    }

    if (isSpecialMaster && !newUniversityCode) {
      alert("大学を選択してください")
      return
    }

    const existingRoom = rooms.find((r) => r.roomNumber === newRoomNumber)
    if (existingRoom) {
      alert("この部屋番号は既に登録されています")
      return
    }

    const universityCode = isSpecialMaster ? newUniversityCode : sessionStorage.getItem("universityCode") || ""

    const testSessionId = sessionStorage.getItem("testSessionId") || ""
    const newRoom: Room = {
      id: crypto.randomUUID(),
      roomNumber: newRoomNumber,
      roomName: newRoomName,
      universityCode: universityCode,
      subjectCode: newSubjectCode || undefined,
      testSessionId,
      createdAt: new Date().toISOString(),
    }

    const updatedRooms = [...rooms, newRoom]
    setRooms(updatedRooms)
    await saveRooms(updatedRooms)

    setNewRoomNumber("")
    setNewRoomName("")
    setNewUniversityCode("")
    setNewSubjectCode("")
    setIsAddingRoom(false)
  }

  const handleStartEdit = (room: Room) => {
    setEditingRoomId(room.id)
    setEditRoomNumber(room.roomNumber)
    setEditRoomName(room.roomName)
    setEditUniversityCode(room.university_code || "")
  }

  const handleSaveEdit = async (roomId: string) => {
    if (!editRoomNumber || !editRoomName) {
      alert("部屋番号と部屋名を入力してください")
      return
    }

    if (isSpecialMaster && !editUniversityCode) {
      alert("大学を選択してください")
      return
    }

    const updatedRooms = rooms.map((room) =>
      room.id === roomId
        ? { ...room, roomNumber: editRoomNumber, roomName: editRoomName, university_code: editUniversityCode }
        : room,
    )

    setRooms(updatedRooms)
    await saveRooms(updatedRooms)
    setEditingRoomId(null)
  }

  const handleDelete = async (roomId: string) => {
    if (!confirm("この部屋を削除してもよろしいですか？")) return

    const updatedRooms = rooms.filter((room) => room.id !== roomId)
    setRooms(updatedRooms)
    await saveRooms(updatedRooms)
  }

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const csvText = event.target?.result as string
      const lines = csvText.split("\n").filter((line) => line.trim())
      const importedRooms: Room[] = []

      const defaultUniversityCode = isSpecialMaster ? "" : sessionStorage.getItem("universityCode") || ""
      const testSessionId = sessionStorage.getItem("testSessionId") || ""

      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(",").map((s) => s.trim())
        let roomNumber: string, roomName: string, universityCode: string

        if (isSpecialMaster && columns.length >= 3) {
          ;[roomNumber, roomName, universityCode] = columns
        } else {
          ;[roomNumber, roomName] = columns
          universityCode = defaultUniversityCode
        }

        if (roomNumber && roomName) {
          importedRooms.push({
            id: crypto.randomUUID(),
            roomNumber,
            roomName,
            university_code: universityCode,
            testSessionId,
            createdAt: new Date().toISOString(),
          })
        }
      }

      if (importedRooms.length > 0) {
        const updatedRooms = [...rooms, ...importedRooms]
        setRooms(updatedRooms)
        await saveRooms(updatedRooms)
        alert(`${importedRooms.length}件の部屋をインポートしました`)
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleCSVExport = () => {
    const headers = isSpecialMaster ? ["部屋番号", "部屋名", "大学名"] : ["部屋番号", "部屋名"]

    const rows = rooms.map((room) => {
      const row = [room.roomNumber, room.roomName]
      if (isSpecialMaster) {
        row.push(universities[room.university_code || ""] || "")
      }
      return row
    })

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `部屋マスター_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const handleDownloadTemplate = () => {
    const csv = isSpecialMaster
      ? "部屋番号,部屋名,大学コード\n101,第1実習室,dentshowa\n102,第2実習室,dentshowa"
      : "部屋番号,部屋名\n101,第1実習室\n102,第2実習室"
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "部屋マスターテンプレート.csv"
    link.click()
  }

  const getTestSessionName = (testSessionId: string | undefined): string => {
    if (!testSessionId) return "-"
    const session = testSessions.find((s) => s.id === testSessionId)
    return session?.description || testSessionId
  }

  const filteredRooms =
    selectedUniversityFilter === "all"
      ? rooms
      : rooms.filter(
          (room) =>
            (room as any).universityCode === selectedUniversityFilter ||
            room.university_code === selectedUniversityFilter,
        )

  const sortedRooms = [...filteredRooms].sort((a, b) => {
    const numA = Number.parseInt(a.roomNumber) || 0
    const numB = Number.parseInt(b.roomNumber) || 0
    return numA - numB
  })

  return (
    <div className="min-h-screen bg-secondary/30 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">部屋マスター管理</h1>
            <p className="text-muted-foreground">
              試験会場の部屋を管理します
              {sessionStorage.getItem("testSessionId") && (
                <span className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                  テスト: {getTestSessionName(sessionStorage.getItem("testSessionId") || undefined)}
                </span>
              )}
            </p>
          </div>
          <Link href="/admin/dashboard">
            <Button variant="outline">
              <Home className="w-4 h-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>登録済み部屋一覧</CardTitle>
                <CardDescription>登録されている部屋: {filteredRooms.length}件</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadTemplate} size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  CSVテンプレート
                </Button>
                <Button variant="outline" onClick={handleCSVExport} size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  CSV出力
                </Button>
                <label htmlFor="csv-import">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      CSV取込
                    </span>
                  </Button>
                </label>
                <input id="csv-import" type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                <Button onClick={() => setIsAddingRoom(!isAddingRoom)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新規追加
                </Button>
              </div>
            </div>
            {isSpecialMaster && (
              <div className="mt-4 flex items-center gap-4">
                <label className="text-sm font-medium">大学でフィルタ:</label>
                <Select value={selectedUniversityFilter} onValueChange={setSelectedUniversityFilter}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての大学</SelectItem>
                    {universitiesList.map((uni) => (
                      <SelectItem key={uni.code} value={uni.code}>
                        {uni.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isAddingRoom && (
              <div className="mb-6 p-4 border rounded-lg bg-secondary/20">
                <h3 className="font-medium mb-4">新しい部屋を追加</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {isSpecialMaster && (
                    <div>
                      <Label htmlFor="newUniversityCode">大学 *</Label>
                      <Select value={newUniversityCode} onValueChange={setNewUniversityCode}>
                        <SelectTrigger>
                          <SelectValue placeholder="大学を選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {universitiesList.map((uni) => (
                            <SelectItem key={uni.code} value={uni.code}>
                              {uni.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="newRoomNumber">部屋番号</Label>
                    <Input
                      id="newRoomNumber"
                      type="text"
                      placeholder="例: 101"
                      value={newRoomNumber}
                      onChange={(e) => setNewRoomNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="newRoomName">部屋名</Label>
                    <Input
                      id="newRoomName"
                      type="text"
                      placeholder="例: 第1実習室"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAddRoom}>追加</Button>
                  <Button variant="outline" onClick={() => setIsAddingRoom(false)}>
                    キャンセル
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">項番</th>
                    {isSpecialMaster && <th className="p-3 text-left font-medium">大学名</th>}
                    <th className="p-3 text-left font-medium">部屋番号</th>
                    <th className="p-3 text-left font-medium">部屋名</th>
                    <th className="p-3 text-left font-medium">テスト名</th>
                    <th className="p-3 text-center font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRooms.length === 0 ? (
                    <tr>
                      <td colSpan={isSpecialMaster ? 6 : 5} className="p-8 text-center text-muted-foreground">
                        登録されている部屋がありません
                      </td>
                    </tr>
                  ) : (
                    sortedRooms.map((room, index) => (
                      <tr key={room.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">{index + 1}</td>
                        {isSpecialMaster && (
                          <td className="p-3">
                            {editingRoomId === room.id ? (
                              <Select value={editUniversityCode} onValueChange={setEditUniversityCode}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {universitiesList.map((uni) => (
                                    <SelectItem key={uni.code} value={uni.code}>
                                      {uni.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              universities[(room as any).universityCode || room.university_code || ""] || "-"
                            )}
                          </td>
                        )}
                        <td className="p-3">
                          {editingRoomId === room.id ? (
                            <Input
                              value={editRoomNumber}
                              onChange={(e) => setEditRoomNumber(e.target.value)}
                              className="w-32"
                            />
                          ) : (
                            room.roomNumber
                          )}
                        </td>
                        <td className="p-3">
                          {editingRoomId === room.id ? (
                            <Input value={editRoomName} onChange={(e) => setEditRoomName(e.target.value)} />
                          ) : (
                            room.roomName
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {getTestSessionName(room.testSessionId || (room as any).test_session_id)}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 justify-center">
                            {editingRoomId === room.id ? (
                              <>
                                <Button size="sm" onClick={() => handleSaveEdit(room.id)}>
                                  保存
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingRoomId(null)}>
                                  キャンセル
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleStartEdit(room)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(room.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
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
    </div>
  )
}
