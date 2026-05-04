"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, FileDown } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loadTests, saveTests, type Test, type Sheet, type Question } from "@/lib/data-storage"
import { useSession } from "@/lib/auth/use-session"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function QuestionCreate() {
  const router = useRouter()
  const [selectedTestSessionId, setSelectedTestSessionId] = useState("")
  const [newTestName, setNewTestName] = useState("")
  const [newTestDate, setNewTestDate] = useState("")
  const [showNewTestForm, setShowNewTestForm] = useState(false)
  const [testSessions, setTestSessions] = useState<any[]>([])
  const [universities, setUniversities] = useState<Array<{ code: string; name: string }>>([])
  const [selectedUniversity, setSelectedUniversity] = useState("")
  const [isSpecialMaster, setIsSpecialMaster] = useState(false)
  const [subjects, setSubjects] = useState<Array<{ code: string; name: string }>>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [teacherSubjectCode, setTeacherSubjectCode] = useState<string>("")
  const [isTeacher, setIsTeacher] = useState(false)
  const [roleType, setRoleType] = useState<"teacher" | "patient">("teacher")
  const [passingScore, setPassingScore] = useState<string>("")

  const [tests, setTests] = useState<
    Array<{
      id: string
      title: string
      sheets: Sheet[]
    }>
  >([
    {
      id: crypto.randomUUID(),
      title: "",
      sheets: [
        {
          id: crypto.randomUUID(),
          title: "",
          categories: [],
        },
      ],
    },
  ])

  const [showPreview, setShowPreview] = useState(false)

  // Phase 9b-β2e: sessionStorage 認可キーを useSession() に置換
  // 旧 userType キーはどこからも書き込まれない dead 値だったため、session.loginType で代替
  const { session, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading || !session) return
    const accountType = session.accountType || ""
    const userUniversityCode = session.universityCode || ""
    const subjectCode = session.subjectCode || ""

    setIsSpecialMaster(accountType === "special_master")
    setIsTeacher(session.loginType === "teacher")

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
        .catch((err) => {})
    } else if (userUniversityCode) {
      setSelectedUniversity(userUniversityCode)
    }

    fetchSubjects(userUniversityCode)
    fetchTestSessions()
  }, [session, isSessionLoading])

  const fetchSubjects = async (universityCode: string | null) => {
    try {
      const res = await fetch(`/api/subjects${universityCode ? `?university_code=${universityCode}` : ""}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        const mapped = data.map((s: any) => ({
          code: s.subject_code,
          name: s.subject_name,
        }))
        setSubjects(mapped)
      }
    } catch (err) {
    }
  }

  const fetchTestSessions = () => {
    fetch("/api/test-sessions")
      .then((res) => res.json())
      .then((data) => setTestSessions(data))
      .catch((err) => {})
  }

  // YYYYMMDD形式の日付文字列を生成
  const formatDateForDescription = (dateStr: string) => {
    return dateStr.replace(/-/g, "")
  }

  // description自動生成プレビュー
  const generatedDescription = newTestDate && newTestName.trim()
    ? `${formatDateForDescription(newTestDate)}_${newTestName.trim()}`
    : ""

  const handleCreateTestSession = async () => {
    if (!newTestName.trim() || !newTestDate || !selectedUniversity) {
      alert("テスト名、実施日、大学を入力してください")
      return
    }

    const description = `${formatDateForDescription(newTestDate)}_${newTestName.trim()}`

    // 同一名称チェック
    const isDuplicate = testSessions.some((ts) => ts.description === description)
    if (isDuplicate) {
      alert(`「${description}」は既に登録されています。テスト名を変更してください。`)
      return
    }

    try {
      const res = await fetch("/api/test-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          test_date: newTestDate,
          university_code: selectedUniversity,
          subject_code: selectedSubject || null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        if (errData?.error?.includes("unique") || errData?.error?.includes("duplicate")) {
          alert(`「${description}」は既に登録されています。テスト名を変更してください。`)
          return
        }
        throw new Error("Failed to create test session")
      }

      const newSession = await res.json()
      setTestSessions([...testSessions, newSession])
      setSelectedTestSessionId(newSession.id)
      setNewTestName("")
      setNewTestDate("")
      setShowNewTestForm(false)
      alert("試験セッションを登録しました")
    } catch (error) {
      alert("試験セッションの登録に失敗しました")
    }
  }

  const addTest = () => {
    setTests([
      ...tests,
      {
        id: crypto.randomUUID(),
        title: "",
        sheets: [
          {
            id: crypto.randomUUID(),
            title: "",
            categories: [],
          },
        ],
      },
    ])
  }

  const removeTest = (testId: string) => {
    if (tests.length === 1) {
      alert("最低1つのテストが必要です")
      return
    }
    setTests(tests.filter((t) => t.id !== testId))
  }

  const updateTestTitle = (testId: string, title: string) => {
    setTests(tests.map((t) => (t.id === testId ? { ...t, title } : t)))
  }

  const addSheet = (testId: string) => {
    setTests(
      tests.map((t) =>
        t.id === testId
          ? {
              ...t,
              sheets: [
                ...t.sheets,
                {
                  id: crypto.randomUUID(),
                  title: "",
                  categories: [],
                },
              ],
            }
          : t,
      ),
    )
  }

  const removeSheet = (testId: string, sheetId: string) => {
    setTests(tests.map((t) => (t.id === testId ? { ...t, sheets: t.sheets.filter((s) => s.id !== sheetId) } : t)))
  }

  const updateSheetTitle = (testId: string, sheetId: string, title: string) => {
    setTests(
      tests.map((t) =>
        t.id === testId ? { ...t, sheets: t.sheets.map((s) => (s.id === sheetId ? { ...s, title } : s)) } : t,
      ),
    )
  }

  const addCategory = (testId: string, sheetId: string) => {
    setTests(
      tests.map((t) =>
        t.id === testId
          ? {
              ...t,
              sheets: t.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      categories: [
                        ...s.categories,
                        {
                          id: crypto.randomUUID(),
                          title: "",
                          number: s.categories.length + 1,
                          questions: [],
                        },
                      ],
                    }
                  : s,
              ),
            }
          : t,
      ),
    )
  }

  const removeCategory = (testId: string, sheetId: string, categoryId: string) => {
    setTests(
      tests.map((t) =>
        t.id === testId
          ? {
              ...t,
              sheets: t.sheets.map((s) =>
                s.id === sheetId ? { ...s, categories: s.categories.filter((c) => c.id !== categoryId) } : s,
              ),
            }
          : t,
      ),
    )
  }

  const updateCategoryTitle = (testId: string, sheetId: string, categoryId: string, title: string) => {
    setTests(
      tests.map((t) =>
        t.id === testId
          ? {
              ...t,
              sheets: t.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      categories: s.categories.map((c) => (c.id === categoryId ? { ...c, title } : c)),
                    }
                  : s,
              ),
            }
          : t,
      ),
    )
  }

  const addQuestion = (testId: string, sheetId: string, categoryId: string) => {
    setTests(
      tests.map((t) =>
        t.id === testId
          ? {
              ...t,
              sheets: t.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      categories: s.categories.map((c) =>
                        c.id === categoryId
                          ? {
                              ...c,
                              questions: [
                                ...c.questions,
                                {
                                  id: crypto.randomUUID(),
                                  number: c.questions.length + 1,
                                  text: "",
                                  option1: "",
                                  option2: "",
                                  option3: "",
                                  option4: "",
                                  option5: "",
                                  isAlertTarget: false,
                                  alertOptions: [],
                                },
                              ],
                            }
                          : c,
                      ),
                    }
                  : s,
              ),
            }
          : t,
      ),
    )
  }

  const removeQuestion = (testId: string, sheetId: string, categoryId: string, questionId: string) => {
    setTests(
      tests.map((t) =>
        t.id === testId
          ? {
              ...t,
              sheets: t.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      categories: s.categories.map((c) =>
                        c.id === categoryId ? { ...c, questions: c.questions.filter((q) => q.id !== questionId) } : c,
                      ),
                    }
                  : s,
              ),
            }
          : t,
      ),
    )
  }

  const updateQuestion = (
    testId: string,
    sheetId: string,
    categoryId: string,
    questionId: string,
    field: keyof Question,
    value: string | boolean,
  ) => {
    setTests(
      tests.map((t) =>
        t.id === testId
          ? {
              ...t,
              sheets: t.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      categories: s.categories.map((c) =>
                        c.id === categoryId
                          ? {
                              ...c,
                              questions: c.questions.map((q) => (q.id === questionId ? { ...q, [field]: value } : q)),
                            }
                          : c,
                      ),
                    }
                  : s,
              ),
            }
          : t,
      ),
    )
  }

  const toggleAlertOption = (
    testId: string,
    sheetId: string,
    categoryId: string,
    questionId: string,
    optionNumber: number,
  ) => {
    setTests(
      tests.map((t) =>
        t.id === testId
          ? {
              ...t,
              sheets: t.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      categories: s.categories.map((c) =>
                        c.id === categoryId
                          ? {
                              ...c,
                              questions: c.questions.map((q) => {
                                if (q.id === questionId) {
                                  const alertOptions = q.alertOptions || []
                                  const newAlertOptions = alertOptions.includes(optionNumber)
                                    ? alertOptions.filter((n) => n !== optionNumber)
                                    : [...alertOptions, optionNumber]
                                  return {
                                    ...q,
                                    alertOptions: newAlertOptions,
                                    isAlertTarget: newAlertOptions.length > 0,
                                  }
                                }
                                return q
                              }),
                            }
                          : c,
                      ),
                    }
                  : s,
              ),
            }
          : t,
      ),
    )
  }

  const handleSave = async () => {
    if (!selectedTestSessionId) {
      alert("試験セッションを選択してください")
      return
    }

    if (!selectedUniversity) {
      alert("大学を選択してください")
      return
    }

    if (isTeacher && !selectedSubject) {
      alert("教科を選択してください")
      return
    }

    const testSession = testSessions.find((ts) => ts.id === selectedTestSessionId)
    if (!testSession) {
      alert("選択された試験セッションが見つかりません")
      return
    }

    try {
      const existingTests = await loadTests()
      const newTests: Test[] = []

      for (const test of tests) {
        if (!test.title.trim()) {
          alert("すべてのテスト名を入力してください")
          return
        }

        if (test.sheets.length === 0 || !test.sheets[0].title.trim()) {
          alert("各テストに少なくとも1つのシートを作成してください")
          return
        }

        const newTest: Test = {
          id: crypto.randomUUID(),
          title: test.title,
          sheets: test.sheets,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          testSessionId: testSession.id,
          universityCode: selectedUniversity,
          subjectCode: selectedSubject || null,
          roleType: roleType,
        } as Test

        newTests.push(newTest)
      }

      await saveTests([...existingTests, ...newTests])

      // 合格基準点をセッションに保存
      if (passingScore !== "") {
        try {
          await fetch(`/api/test-sessions/${testSession.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              test_date: testSession.test_date,
              description: testSession.description,
              university_code: testSession.university_code,
              passing_score: parseInt(passingScore, 10),
            }),
          })
        } catch (e) {
          console.error("[question-create] passing_score save failed:", e)
        }
      }

      alert(`${newTests.length}件のテストを保存しました`)
      router.push("/admin/question-management")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      console.error("[question-create] save failed:", msg, err)
      alert(`保存に失敗しました: ${msg}`)
    }
  }

  const downloadCSVTemplate = () => {
    const csvContent =
      "テスト名,シート名,カテゴリ番号,カテゴリ名,問題番号,問題文,選択肢1,選択肢2,選択肢3,選択肢4,選択肢5,アラート対象,アラート選択肢\n" +
      "医療面接評価シート1,シート1,1,カテゴリ1,1,問題文の例,選択肢1,選択肢2,選択肢3,選択肢4,選択肢5,0,\n" +
      '医療面接評価シート1,シート1,1,カテゴリ1,2,アラート問題例,選択肢1,選択肢2,選択肢3,選択肢4,選択肢5,1,"1,3"\n' +
      "医療面接評価シート2,シート1,1,カテゴリ1,1,別のテストの問題,選択肢1,選択肢2,選択肢3,選択肢4,選択肢5,0,\n"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "問題登録テンプレート.csv"
    link.click()
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split("\n").slice(1) // ヘッダー行をスキップ

      const testMap = new Map<
        string,
        {
          id: string
          title: string
          sheets: Sheet[]
        }
      >()

      lines.forEach((line) => {
        if (!line.trim()) return

        const [
          testName,
          sheetTitle,
          categoryNum,
          categoryTitle,
          questionNum,
          questionText,
          option1,
          option2,
          option3,
          option4,
          option5,
          isAlert,
          alertOptionsStr,
        ] = line.split(",")

        let test = testMap.get(testName)
        if (!test) {
          test = {
            id: crypto.randomUUID(),
            title: testName,
            sheets: [],
          }
          testMap.set(testName, test)
        }

        let sheet = test.sheets.find((s) => s.title === sheetTitle)
        if (!sheet) {
          sheet = {
            id: crypto.randomUUID(),
            title: sheetTitle,
            categories: [],
          }
          test.sheets.push(sheet)
        }

        let category = sheet.categories.find((c) => c.number === Number.parseInt(categoryNum))
        if (!category) {
          category = {
            id: crypto.randomUUID(),
            title: categoryTitle,
            number: Number.parseInt(categoryNum),
            questions: [],
          }
          sheet.categories.push(category)
        }

        const alertOptions: number[] = []
        if (alertOptionsStr && alertOptionsStr.trim()) {
          const cleanStr = alertOptionsStr.replace(/"/g, "").trim()
          alertOptions.push(
            ...cleanStr
              .split(",")
              .map((n) => Number.parseInt(n.trim()))
              .filter((n) => n >= 1 && n <= 5),
          )
        }

        category.questions.push({
          id: crypto.randomUUID(),
          number: Number.parseInt(questionNum),
          text: questionText,
          option1,
          option2,
          option3,
          option4,
          option5,
          isAlertTarget: isAlert === "1",
          alertOptions,
        })
      })

      setTests(Array.from(testMap.values()))
      setShowPreview(true)
      alert("CSVファイルを読み込みました。プレビューを確認してください。")
    }

    reader.readAsText(file)
  }

  const filteredTestSessions = testSessions.filter(
    (ts) => !selectedUniversity || ts.university_code === selectedUniversity,
  )

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/question-management">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                問題管理に戻る
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#00417A]">問題登録</h1>
          </div>
          <Button onClick={handleSave} className="bg-[#00417A] hover:bg-[#00417A]/90">
            保存
          </Button>
        </div>

        <Card className="mb-4">
          <CardContent className="px-4 py-3">
            <p className="text-sm font-semibold mb-2">テスト情報</p>
            <div className="flex items-end gap-3 flex-wrap">
                {isSpecialMaster && universities.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">大学</Label>
                    <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
                      <SelectTrigger className="h-9 w-44">
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
                )}

                {!isTeacher && !teacherSubjectCode && subjects.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">教科</Label>
                    <Select value={selectedSubject || "none"} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="h-9 w-44">
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
                )}

                {teacherSubjectCode && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">担当教科</Label>
                    <div className="flex items-center h-9 px-3 bg-blue-50 rounded-md">
                      <span className="text-sm text-[#00417A] font-semibold">
                        {subjects.find((s) => s.code === teacherSubjectCode)?.name || teacherSubjectCode}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">対象ロール</Label>
                  <Select value={roleType} onValueChange={(v) => setRoleType(v as "teacher" | "patient")}>
                    <SelectTrigger className="h-9 w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">教員側</SelectItem>
                      <SelectItem value="patient">患者役側</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  {/* ADR-006 R-2-F6-2: passing_score は % 運用 (0-100)。ラベル/プレースホルダ/バリデーションを統一。 */}
                  <Label className="text-xs text-muted-foreground">合格ライン %(0-100)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="h-9 w-24"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                    placeholder="例: 70"
                  />
                </div>

                <div className="space-y-1 flex-1 min-w-48">
                  <Label className="text-xs text-muted-foreground">既存テスト名</Label>
                  <div className="flex items-center gap-2">
                    <Select value={selectedTestSessionId || "none"} onValueChange={(val) => {
                      setSelectedTestSessionId(val)
                      const session = testSessions.find((ts: any) => ts.id === val)
                      setPassingScore(session?.passing_score != null ? String(session.passing_score) : "")
                    }}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="既存テスト名を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTestSessions.map((ts) => (
                          <SelectItem key={ts.id} value={ts.id}>
                            {ts.description || "(名称未設定)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs bg-transparent shrink-0 whitespace-nowrap"
                      onClick={() => setShowNewTestForm(!showNewTestForm)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      新規テスト作成
                    </Button>
                  </div>
                </div>
              </div>

              {showNewTestForm && (
                <Card className="mt-2 border-2 border-[#00417A]/20 bg-secondary/30">
                  <CardContent className="p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">実施日</Label>
                        <Input
                          type="date"
                          className="h-8 text-sm"
                          value={newTestDate}
                          onChange={(e) => setNewTestDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">テスト名</Label>
                        <Input
                          className="h-8 text-sm"
                          value={newTestName}
                          onChange={(e) => setNewTestName(e.target.value)}
                          placeholder="例: 全身の医療面接評価"
                        />
                      </div>
                    </div>
                    {generatedDescription && (
                      <div className="px-2 py-1.5 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-muted-foreground">登録名称:</p>
                        <p className="text-sm font-medium text-blue-900">{generatedDescription}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateTestSession}
                        size="sm"
                        className="h-7 bg-[#00417A] hover:bg-[#00417A]/90"
                        disabled={!generatedDescription}
                      >
                        登録
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 bg-transparent"
                        onClick={() => setShowNewTestForm(false)}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
          </CardContent>
        </Card>

        <Tabs defaultValue="manual" className="space-y-4">
          <TabsList>
            <TabsTrigger value="manual">手動登録</TabsTrigger>
            <TabsTrigger value="csv">CSV一括登録</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            {tests.map((test, testIndex) => (
              <Card key={test.id} className="border-2 border-[#00417A]/20">
                <CardHeader className="bg-[#00417A]/5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label>テスト名</Label>
                      <Input
                        value={test.title}
                        onChange={(e) => updateTestTitle(test.id, e.target.value)}
                        placeholder="例: 全身の医療面接評価シート"
                      />
                    </div>
                    {tests.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTest(test.id)}
                        className="ml-2 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {test.sheets.map((sheet, sheetIndex) => (
                    <Card key={sheet.id}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex-1">
                          <Label>シート名</Label>
                          <Input
                            value={sheet.title}
                            onChange={(e) => updateSheetTitle(test.id, sheet.id, e.target.value)}
                            placeholder="例: オーラルフィジシャンの基盤"
                          />
                        </div>
                        {test.sheets.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSheet(test.id, sheet.id)}
                            className="ml-2 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {sheet.categories.map((category) => (
                          <Card key={category.id} className="bg-gray-50">
                            <CardHeader className="flex flex-row items-center justify-between py-3">
                              <div className="flex flex-1 items-center gap-4">
                                <Label className="w-32">カテゴリ {category.number}</Label>
                                <Input
                                  value={category.title}
                                  onChange={(e) => updateCategoryTitle(test.id, sheet.id, category.id, e.target.value)}
                                  placeholder="例: 基本手技"
                                  className="flex-1"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCategory(test.id, sheet.id, category.id)}
                                className="ml-2 text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {category.questions.map((question) => (
                                <div key={question.id} className="rounded-lg border bg-white p-2">
                                  <div className="flex items-start gap-2">
                                    <Label className="mt-2 min-w-[4rem]">問題 {question.number}</Label>
                                    <div className="flex-1 space-y-2">
                                      <div className="flex items-start gap-2">
                                        <Input
                                          value={question.text}
                                          onChange={(e) =>
                                            updateQuestion(
                                              test.id,
                                              sheet.id,
                                              category.id,
                                              question.id,
                                              "text",
                                              e.target.value,
                                            )
                                          }
                                          placeholder="問題文"
                                          className="flex-1"
                                        />
                                        <div className="flex gap-1">
                                          <Input
                                            value={question.option1}
                                            onChange={(e) =>
                                              updateQuestion(
                                                test.id,
                                                sheet.id,
                                                category.id,
                                                question.id,
                                                "option1",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="1"
                                            className="w-20"
                                          />
                                          <Input
                                            value={question.option2}
                                            onChange={(e) =>
                                              updateQuestion(
                                                test.id,
                                                sheet.id,
                                                category.id,
                                                question.id,
                                                "option2",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="2"
                                            className="w-20"
                                          />
                                          <Input
                                            value={question.option3}
                                            onChange={(e) =>
                                              updateQuestion(
                                                test.id,
                                                sheet.id,
                                                category.id,
                                                question.id,
                                                "option3",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="3"
                                            className="w-20"
                                          />
                                          <Input
                                            value={question.option4}
                                            onChange={(e) =>
                                              updateQuestion(
                                                test.id,
                                                sheet.id,
                                                category.id,
                                                question.id,
                                                "option4",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="4"
                                            className="w-20"
                                          />
                                          <Input
                                            value={question.option5}
                                            onChange={(e) =>
                                              updateQuestion(
                                                test.id,
                                                sheet.id,
                                                category.id,
                                                question.id,
                                                "option5",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="5"
                                            className="w-20"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-medium text-gray-600">
                                            アラート対象の選択肢:
                                          </span>
                                          <div className="flex items-center gap-2">
                                            {[1, 2, 3, 4, 5].map((optNum) => (
                                              <div key={optNum} className="flex items-center space-x-1">
                                                <Checkbox
                                                  id={`alert-opt-${question.id}-${optNum}`}
                                                  checked={question.alertOptions?.includes(optNum) || false}
                                                  onCheckedChange={() =>
                                                    toggleAlertOption(
                                                      test.id,
                                                      sheet.id,
                                                      category.id,
                                                      question.id,
                                                      optNum,
                                                    )
                                                  }
                                                />
                                                <label
                                                  htmlFor={`alert-opt-${question.id}-${optNum}`}
                                                  className="text-xs cursor-pointer"
                                                >
                                                  {optNum}
                                                </label>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeQuestion(test.id, sheet.id, category.id, question.id)}
                                          className="text-red-600 h-6"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addQuestion(test.id, sheet.id, category.id)}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                問題を追加
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => addCategory(test.id, sheet.id)}>
                          <Plus className="mr-2 h-4 w-4" />
                          カテゴリを追加
                        </Button>
                      </CardContent>
                      <div className="px-6 pb-4">
                        <Button variant="outline" size="sm" onClick={() => addSheet(test.id)}>
                          <Plus className="mr-2 h-4 w-4" />
                          シートを追加
                        </Button>
                      </div>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addTest} className="border-[#00417A] text-[#00417A] bg-transparent">
              <Plus className="mr-2 h-4 w-4" />
              テストを追加
            </Button>
          </TabsContent>

          <TabsContent value="csv">
            <Card>
              <CardHeader>
                <CardTitle>CSV一括登録</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Button variant="outline" onClick={downloadCSVTemplate}>
                    <FileDown className="mr-2 h-4 w-4" />
                    CSVテンプレートをダウンロード
                  </Button>
                </div>
                <div>
                  <Label htmlFor="csv-upload">CSVファイルを選択</Label>
                  <Input id="csv-upload" type="file" accept=".csv" onChange={handleCSVUpload} />
                </div>
                <p className="text-sm text-gray-500">
                  CSV形式:
                  テスト名,シート名,カテゴリ番号,カテゴリ名,問題番号,問題文,選択肢1,選択肢2,選択肢3,選択肢4,選択肢5,アラート対象(0
                  or 1),アラート選択肢("1,3,5"のように指定)
                </p>
                <p className="text-sm text-gray-500 font-bold">
                  ※同じテスト名で複数行を登録すると、1つの試験セッションに複数のテストを紐づけることができます
                </p>
              </CardContent>
            </Card>

            {showPreview && tests.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>プレビュー</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tests.map((test) => (
                    <div key={test.id} className="space-y-3 border-l-4 border-[#00417A] pl-4">
                      <h3 className="font-bold text-lg text-[#00417A]">テスト: {test.title}</h3>
                      {test.sheets.map((sheet) => (
                        <div key={sheet.id} className="space-y-3 ml-4">
                          <h4 className="font-semibold text-gray-700">シート: {sheet.title}</h4>
                          {sheet.categories.map((category) => (
                            <div key={category.id} className="ml-4 space-y-2">
                              <h5 className="font-medium text-gray-600">
                                カテゴリ {category.number}: {category.title}
                              </h5>
                              <div className="ml-4 space-y-1">
                                {category.questions.map((question) => (
                                  <div key={question.id} className="flex items-start gap-2 text-sm border-b pb-2">
                                    <span className="font-medium min-w-[3rem]">Q{question.number}:</span>
                                    <div className="flex-1">
                                      <div className="mb-1">{question.text}</div>
                                      <div className="text-xs text-gray-500">
                                        {[
                                          question.option1,
                                          question.option2,
                                          question.option3,
                                          question.option4,
                                          question.option5,
                                        ]
                                          .filter(Boolean)
                                          .join(" / ")}
                                        {question.isAlertTarget && (
                                          <span className="ml-2 text-red-600 font-medium">
                                            [アラート: {question.alertOptions?.join(",")}]
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
