"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, Hourglass } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loadTests, saveTests, type Sheet, type Question } from "@/lib/data-storage"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface QuestionEditProps {
  testId: string
}

export function QuestionEdit({ testId }: QuestionEditProps) {
  const router = useRouter()
  const [selectedTestSessionId, setSelectedTestSessionId] = useState("")
  const [testSessions, setTestSessions] = useState<any[]>([])
  const [testTitle, setTestTitle] = useState("")
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubjectCode, setSelectedSubjectCode] = useState("")
  const [universities, setUniversities] = useState<any[]>([])
  const [selectedUniversity, setSelectedUniversity] = useState("")
  const [accountType, setAccountType] = useState<string>("")
  const [roleType, setRoleType] = useState<"teacher" | "patient">("teacher")

  useEffect(() => {
    const storedAccountType = sessionStorage.getItem("accountType") || ""
    setAccountType(storedAccountType)

    // 大学管理者の場合、大学コードを固定
    const storedUniversityCode = sessionStorage.getItem("universityCode") || ""

    const fetchTest = async () => {
      try {
        const [sessionsRes, subjectsRes, universitiesRes] = await Promise.all([
          fetch("/api/test-sessions"),
          fetch("/api/subjects"),
          fetch("/api/universities"),
        ])
        const sessionsData = await sessionsRes.json()
        const subjectsData = await subjectsRes.json()
        const universitiesData = await universitiesRes.json()

        setTestSessions(sessionsData)
        setSubjects(subjectsData)
        setUniversities(universitiesData)

        const tests = await loadTests()
        const test = Array.isArray(tests) ? tests.find((t) => t.id === testId) : null

        if (!test) {
          alert("テストが見つかりませんでした")
          router.push("/admin/question-management")
          return
        }

        setTestTitle(test.title)
        setSheets(test.sheets)
        setSelectedUniversity(test.universityCode || "")
        setSelectedSubjectCode(test.subjectCode || "")
        setRoleType(test.roleType || "teacher")

        if (test.testSessionId) {
          setSelectedTestSessionId(test.testSessionId)
        }
      } catch (error) {
        console.error("[v0] Error loading test:", error)
        alert("テストの読み込みに失敗しました")
        router.push("/admin/question-management")
      } finally {
        setLoading(false)
      }
    }

    fetchTest()
  }, [testId, router])

  const filteredSubjects = selectedUniversity
    ? subjects.filter((s) => s.university_code === selectedUniversity)
    : subjects

  const addSheet = () => {
    setSheets([
      ...sheets,
      {
        id: crypto.randomUUID(),
        title: "",
        categories: [],
      },
    ])
  }

  const removeSheet = (sheetId: string) => {
    setSheets(sheets.filter((s) => s.id !== sheetId))
  }

  const updateSheetTitle = (sheetId: string, title: string) => {
    setSheets(sheets.map((s) => (s.id === sheetId ? { ...s, title } : s)))
  }

  const addCategory = (sheetId: string) => {
    setSheets(
      sheets.map((s) =>
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
    )
  }

  const removeCategory = (sheetId: string, categoryId: string) => {
    setSheets(
      sheets.map((s) => (s.id === sheetId ? { ...s, categories: s.categories.filter((c) => c.id !== categoryId) } : s)),
    )
  }

  const updateCategoryTitle = (sheetId: string, categoryId: string, title: string) => {
    setSheets(
      sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              categories: s.categories.map((c) => (c.id === categoryId ? { ...c, title } : c)),
            }
          : s,
      ),
    )
  }

  const addQuestion = (sheetId: string, categoryId: string) => {
    setSheets(
      sheets.map((s) =>
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
    )
  }

  const removeQuestion = (sheetId: string, categoryId: string, questionId: string) => {
    setSheets(
      sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              categories: s.categories.map((c) =>
                c.id === categoryId ? { ...c, questions: c.questions.filter((q) => q.id !== questionId) } : c,
              ),
            }
          : s,
      ),
    )
  }

  const updateQuestion = (
    sheetId: string,
    categoryId: string,
    questionId: string,
    field: keyof Question,
    value: string | boolean,
  ) => {
    setSheets(
      sheets.map((s) =>
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
    )
  }

  const toggleAlertOption = (sheetId: string, categoryId: string, questionId: string, optionNumber: number) => {
    setSheets(
      sheets.map((s) =>
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
                          return { ...q, alertOptions: newAlertOptions, isAlertTarget: newAlertOptions.length > 0 }
                        }
                        return q
                      }),
                    }
                  : c,
              ),
            }
          : s,
      ),
    )
  }

  const handleSave = async () => {
    if (isSaving) return

    if (!selectedTestSessionId) {
      alert("試験セッションを選択してください")
      return
    }

    if (!testTitle.trim()) {
      alert("テスト名を入力してください")
      return
    }

    setIsSaving(true)

    try {
      const testSession = testSessions.find((ts) => ts.id === selectedTestSessionId)
      if (!testSession) {
        alert("選択された試験セッションが見つかりません")
        setIsSaving(false)
        return
      }

      const tests = await loadTests()
      const testsArray = Array.isArray(tests) ? tests : []
      const updatedTests = testsArray.map((t) =>
        t.id === testId
          ? {
              ...t,
              title: testTitle,
              sheets,
              testSessionId: testSession.id,
              universityCode: testSession.university_code,
              subjectCode: selectedSubjectCode || null,
              roleType: roleType,
              updatedAt: new Date().toISOString(),
            }
          : t,
      )

      await saveTests(updatedTests)
      alert("テストを更新しました")
      router.push("/admin/question-management")
    } catch (error) {
      console.error("[v0] Error saving test:", error)
      setIsSaving(false)
      alert("テストの更新に失敗しました")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary/30 p-4 md:p-8 flex items-center justify-center">
        <div className="text-lg font-semibold">読み込み中...</div>
      </div>
    )
  }

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
            <h1 className="text-2xl font-bold text-[#00417A]">問題編集</h1>
          </div>
          <Button onClick={handleSave} className="bg-[#00417A] hover:bg-[#00417A]/90" disabled={isSaving}>
            {isSaving ? (
              <>
                <Hourglass className="mr-2 h-4 w-4 animate-pulse" />
                処理中...
              </>
            ) : (
              "更新"
            )}
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[120px]">
                <Label className="text-xs">対象ロール</Label>
                <Select value={roleType} onValueChange={(v) => setRoleType(v as "teacher" | "patient")}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">教員側</SelectItem>
                    <SelectItem value="patient">患者役側</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* 試験セッションは編集時に変更不可（テスト作成時に指定済み） */}
              <div className="min-w-[200px] flex-[2]">
                <Label className="text-xs">テスト名</Label>
                <Input
                  className="h-9"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="例: 全身の医療面接評価シート"
                />
              </div>
              {accountType === "special_master" ? (
                <div className="min-w-[160px] flex-1">
                  <Label htmlFor="university" className="text-xs">大学</Label>
                  <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
                    <SelectTrigger className="h-9">
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
              ) : (
                <div className="min-w-[160px] flex-1">
                  <Label htmlFor="university" className="text-xs">大学</Label>
                  <p className="text-sm px-3 py-1.5 border rounded-md bg-muted h-9 flex items-center">
                    {universities.find((u) => u.university_code === selectedUniversity)?.university_name || selectedUniversity}
                  </p>
                </div>
              )}
              <div className="min-w-[160px] flex-1">
                <Label htmlFor="subject" className="text-xs">教科</Label>
                <Select value={selectedSubjectCode || "default"} onValueChange={setSelectedSubjectCode}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="教科を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">未設定</SelectItem>
                    {filteredSubjects.map((subject) => (
                      <SelectItem key={subject.subject_code} value={subject.subject_code}>
                        {subject.subject_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {sheets.map((sheet) => (
            <Card key={sheet.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div>
                    <Label>シート名</Label>
                    <Input
                      value={sheet.title}
                      onChange={(e) => updateSheetTitle(sheet.id, e.target.value)}
                      placeholder="例: オーラルフィジシャンの基盤"
                    />
                  </div>
                </div>
                {sheets.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeSheet(sheet.id)} className="ml-2 text-red-600">
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
                          onChange={(e) => updateCategoryTitle(sheet.id, category.id, e.target.value)}
                          placeholder="例: 基本手技"
                          className="flex-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCategory(sheet.id, category.id)}
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
                                    updateQuestion(sheet.id, category.id, question.id, "text", e.target.value)
                                  }
                                  placeholder="問題文"
                                  className="flex-1"
                                />
                                <div className="flex gap-1">
                                  <Input
                                    value={question.option1}
                                    onChange={(e) =>
                                      updateQuestion(sheet.id, category.id, question.id, "option1", e.target.value)
                                    }
                                    placeholder="1"
                                    className="w-20"
                                  />
                                  <Input
                                    value={question.option2}
                                    onChange={(e) =>
                                      updateQuestion(sheet.id, category.id, question.id, "option2", e.target.value)
                                    }
                                    placeholder="2"
                                    className="w-20"
                                  />
                                  <Input
                                    value={question.option3}
                                    onChange={(e) =>
                                      updateQuestion(sheet.id, category.id, question.id, "option3", e.target.value)
                                    }
                                    placeholder="3"
                                    className="w-20"
                                  />
                                  <Input
                                    value={question.option4}
                                    onChange={(e) =>
                                      updateQuestion(sheet.id, category.id, question.id, "option4", e.target.value)
                                    }
                                    placeholder="4"
                                    className="w-20"
                                  />
                                  <Input
                                    value={question.option5}
                                    onChange={(e) =>
                                      updateQuestion(sheet.id, category.id, question.id, "option5", e.target.value)
                                    }
                                    placeholder="5"
                                    className="w-20"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-600">アラート対象の選択肢:</span>
                                  <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((optNum) => (
                                      <div key={optNum} className="flex items-center space-x-1">
                                        <Checkbox
                                          id={`alert-opt-${question.id}-${optNum}`}
                                          checked={question.alertOptions?.includes(optNum) || false}
                                          onCheckedChange={() =>
                                            toggleAlertOption(sheet.id, category.id, question.id, optNum)
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
                                  onClick={() => removeQuestion(sheet.id, category.id, question.id)}
                                  className="text-red-600 h-6"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => addQuestion(sheet.id, category.id)}>
                        <Plus className="mr-2 h-4 w-4" />
                        問題を追加
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => addCategory(sheet.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  カテゴリを追加
                </Button>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addSheet}>
            <Plus className="mr-2 h-4 w-4" />
            シートを追加
          </Button>
        </div>
      </div>
    </div>
  )
}
