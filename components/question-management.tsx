"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"
import { loadTests, saveTests, type Test } from "@/lib/data-storage"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function QuestionManagement() {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isSpecialMaster, setIsSpecialMaster] = useState(false)
  const [universities, setUniversities] = useState<Array<{ code: string; name: string }>>([])
  const [selectedUniversity, setSelectedUniversity] = useState<string>("all")
  const [testSessions, setTestSessions] = useState<any[]>([])
  const [subjects, setSubjects] = useState<Array<{ code: string; name: string }>>([])
  const [selectedSubject, setSelectedSubject] = useState<string>("all")
  const [teacherSubjectCode, setTeacherSubjectCode] = useState<string>("")
  const [isTeacher, setIsTeacher] = useState(false)

  const [showSessionDialog, setShowSessionDialog] = useState(false)
  const [newTestCode, setNewTestCode] = useState("")
  const [newTestDate, setNewTestDate] = useState("")
  const [newUniversityCode, setNewUniversityCode] = useState("")
  const [newSubjectCode, setNewSubjectCode] = useState("")

  useEffect(() => {
    const accountType = sessionStorage.getItem("accountType")
    const userUniversityCode = sessionStorage.getItem("universityCode")
    const subjectCode = sessionStorage.getItem("subjectCode")
    const userType = sessionStorage.getItem("userType") // "admin" or "teacher"

    setIsSpecialMaster(accountType === "special_master")
    setIsTeacher(userType === "teacher")

    if (subjectCode) {
      setTeacherSubjectCode(subjectCode)
      setSelectedSubject(subjectCode)
    }

    if (accountType === "special_master") {
      fetch("/api/universities")
        .then((res) => res.json())
        .then((data) => {
          const universityList: Array<{ code: string; name: string }> = []
          data.forEach((uni: any) => {
            universityList.push({ code: uni.university_code, name: uni.university_name })
          })
          setUniversities(universityList)
        })
        .catch((err) => console.error("[v0] Failed to fetch universities:", err))
    }

    fetchSubjects(userUniversityCode)
    fetchTestSessions()
    fetchTests()
  }, [])

  const fetchTestSessions = async () => {
    try {
      const res = await fetch("/api/test-sessions")
      const data = await res.json()
      setTestSessions(data)
    } catch (err) {
      console.error("[v0] Failed to fetch test sessions:", err)
    }
  }

  const fetchTests = async () => {
    const loadedTests = await loadTests()
    setTests(Array.isArray(loadedTests) ? loadedTests : [])
  }

  const handleAddTestSession = async () => {
    if (!newTestCode.trim() || !newTestDate || !newUniversityCode) {
      alert("すべての項目を入力してください")
      return
    }

    try {
      const res = await fetch("/api/test-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_code: newTestCode,
          test_date: newTestDate,
          university_code: newUniversityCode,
          subject_code: newSubjectCode || null,
        }),
      })

      if (res.ok) {
        alert("テストコードを登録しました")
        setShowSessionDialog(false)
        setNewTestCode("")
        setNewTestDate("")
        setNewUniversityCode("")
        setNewSubjectCode("")
        fetchTestSessions()
      } else {
        alert("テストコードの登録に失敗しました")
      }
    } catch (err) {
      console.error("[v0] Failed to create test session:", err)
      alert("エラーが発生しました")
    }
  }

  const fetchSubjects = async (universityCode: string | null) => {
    try {
      const res = await fetch(`/api/subjects${universityCode ? `?university_code=${universityCode}` : ""}`)
      const data = await res.json()
      setSubjects(data)
    } catch (err) {
      console.error("[v0] Failed to fetch subjects:", err)
    }
  }

  const filteredTests = tests.filter((test) => {
    const matchesSearch = test.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesUniversity = selectedUniversity === "all" || (test as any).universityCode === selectedUniversity
    const matchesSubject = selectedSubject === "all" || (test as any).subjectCode === selectedSubject

    if (isTeacher && teacherSubjectCode) {
      return matchesSearch && matchesUniversity && (test as any).subjectCode === teacherSubjectCode
    }

    return matchesSearch && matchesUniversity && matchesSubject
  })

  const groupedByUniversityAndTestCode: Record<string, Record<string, Test[]>> = {}

  if (isSpecialMaster && selectedUniversity === "all") {
    universities.forEach((uni) => {
      groupedByUniversityAndTestCode[uni.code] = {}
      const universityTests = filteredTests.filter((test) => (test as any).universityCode === uni.code)

      universityTests.forEach((test) => {
        const testSession = testSessions.find((ts) => ts.id === (test as any).testSessionId)
        const testCode = testSession?.test_code || "未分類"

        if (!groupedByUniversityAndTestCode[uni.code][testCode]) {
          groupedByUniversityAndTestCode[uni.code][testCode] = []
        }
        groupedByUniversityAndTestCode[uni.code][testCode].push(test)
      })
    })
  }

  const handleDelete = async (testId: string) => {
    if (!confirm("このテストを削除してもよろしいですか？")) return

    const updatedTests = tests.filter((t) => t.id !== testId)
    setTests(updatedTests)
    await saveTests(updatedTests)
  }

  const handleCreateNew = () => {
    router.push("/admin/question-management/create")
  }

  const handleEdit = (testId: string) => {
    router.push(`/admin/question-management/edit/${testId}`)
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                ダッシュボードに戻る
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#00417A]">問題管理</h1>
          </div>
          <div className="flex gap-2">
            {isSpecialMaster && (
              <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-[#00417A] text-[#00417A] bg-transparent">
                    <Calendar className="mr-2 h-4 w-4" />
                    テストコード管理
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新しいテストコードを登録</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>テストコード</Label>
                      <Input
                        value={newTestCode}
                        onChange={(e) => setNewTestCode(e.target.value)}
                        placeholder="例: 20251201-OSCE"
                      />
                    </div>
                    <div>
                      <Label>実施日</Label>
                      <Input type="date" value={newTestDate} onChange={(e) => setNewTestDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>大学</Label>
                      <Select value={newUniversityCode} onValueChange={setNewUniversityCode}>
                        <SelectTrigger>
                          <SelectValue placeholder="大学を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {universities.map((uni) => (
                            <SelectItem key={uni.code} value={uni.code}>
                              {uni.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>教科（任意）</Label>
                      <Select value={newSubjectCode} onValueChange={setNewSubjectCode}>
                        <SelectTrigger>
                          <SelectValue placeholder="教科を選択（任意）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">教科なし</SelectItem>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.code} value={subject.code}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddTestSession} className="w-full bg-[#00417A]">
                      登録
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button onClick={handleCreateNew} className="bg-[#00417A] hover:bg-[#00417A]/90">
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          {isSpecialMaster && (
            <div className="flex items-center gap-3 h-9">
              <label className="text-sm font-medium">大学:</label>
              <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての大学</SelectItem>
                  {universities.map((uni) => (
                    <SelectItem key={uni.code} value={uni.code}>
                      {uni.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isTeacher && (
            <div className="flex items-center gap-3 h-9">
              <label className="text-sm font-medium">教科:</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての教科</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.code} value={subject.code}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isTeacher && teacherSubjectCode && (
            <div className="flex items-center gap-3 h-9 bg-blue-50 px-3 py-2 rounded-md">
              <label className="text-sm font-medium">担当教科:</label>
              <span className="text-sm text-[#00417A] font-semibold">
                {subjects.find((s) => s.code === teacherSubjectCode)?.name || teacherSubjectCode}
              </span>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>テスト一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="テスト名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>

            {isSpecialMaster && selectedUniversity === "all" ? (
              <div className="space-y-6">
                {universities.map((uni) => {
                  const universityGroups = groupedByUniversityAndTestCode[uni.code] || {}
                  const hasTests = Object.keys(universityGroups).length > 0

                  if (!hasTests) return null

                  return (
                    <div key={uni.code} className="space-y-4 border rounded-lg p-4 bg-gray-50">
                      <h3 className="text-xl font-bold text-[#00417A]">{uni.name}</h3>

                      {Object.entries(universityGroups).map(([testCode, testsInCode]) => (
                        <div key={testCode} className="space-y-3 ml-4">
                          <h4 className="text-lg font-semibold text-[#00417A] border-b pb-2">
                            テストコード: {testCode}
                          </h4>

                          {testsInCode.map((test) => (
                            <div
                              key={test.id}
                              className="flex items-center justify-between rounded-lg border bg-white p-4 ml-4"
                            >
                              <div>
                                <h5 className="font-semibold text-[#00417A]">{test.title}</h5>
                                <p className="text-sm text-gray-500">
                                  {(test as any).subjectCode && (
                                    <>
                                      教科:{" "}
                                      {subjects.find((s) => s.code === (test as any).subjectCode)?.name ||
                                        (test as any).subjectCode}{" "}
                                      |{" "}
                                    </>
                                  )}
                                  シート数: {test.sheets.length} | 作成日:{" "}
                                  {new Date(test.createdAt).toLocaleDateString("ja-JP")}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(test.id)}>
                                  <Edit className="mr-1 h-4 w-4" />
                                  編集
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(test.id)}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="mr-1 h-4 w-4" />
                                  削除
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTests.map((test) => (
                  <div key={test.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
                    <div>
                      <h4 className="font-semibold text-[#00417A]">{test.title}</h4>
                      <p className="text-sm text-gray-500">
                        {(test as any).subjectCode && (
                          <>
                            教科:{" "}
                            {subjects.find((s) => s.code === (test as any).subjectCode)?.name ||
                              (test as any).subjectCode}{" "}
                            |{" "}
                          </>
                        )}
                        シート数: {test.sheets.length} | 作成日: {new Date(test.createdAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(test.id)}>
                        <Edit className="mr-1 h-4 w-4" />
                        編集
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(test.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        削除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
