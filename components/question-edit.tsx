"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, Hourglass, MoreHorizontal } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loadTests, saveTests, type Sheet, type Question } from "@/lib/data-storage"
import { useSession } from "@/lib/auth/use-session"
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
  const [passingScore, setPassingScore] = useState<string>("")

  // Phase 9b-β2e: sessionStorage 認可キーを useSession() に置換
  const { session, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading || !session) return
    const storedAccountType = session.accountType || ""
    setAccountType(storedAccountType)

    // 大学管理者の場合、大学コードを固定
    const storedUniversityCode = session.universityCode || ""

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
          const session = sessionsData.find((s: any) => s.id === test.testSessionId)
          if (session?.passing_score != null) {
            setPassingScore(String(session.passing_score))
          }
        }
      } catch (error) {
        alert("テストの読み込みに失敗しました")
        router.push("/admin/question-management")
      } finally {
        setLoading(false)
      }
    }

    fetchTest()
  }, [session, isSessionLoading, testId, router])

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

  // 2026-07-10 副田さん要望 Phase 2: シート単位の N 段階配点編集 (question-create と同じ)
  const updateSheetScoreMapLength = (sheetId: string, rawLength: number) => {
    const nextLen = Math.max(2, Math.min(10, Math.floor(rawLength) || 5))
    setSheets(
      sheets.map((s) => {
        if (s.id !== sheetId) return s
        const current = (s as { scoreMap?: number[] }).scoreMap && (s as { scoreMap?: number[] }).scoreMap!.length > 0
          ? (s as { scoreMap: number[] }).scoreMap
          : [1, 2, 3, 4, 5]
        const nextMap = Array.from({ length: nextLen }, (_, i) => current[i] ?? i + 1)
        return {
          ...s,
          scoreMap: nextMap,
          categories: s.categories.map((c) => ({
            ...c,
            questions: c.questions.map((q) => ({
              ...q,
              alertOptions: (q.alertOptions || []).filter((pos) => pos < nextLen),
            })),
          })),
        } as typeof s
      }),
    )
  }

  const updateSheetScoreValue = (sheetId: string, index: number, value: number) => {
    const clamped = Math.max(0, Math.floor(Number(value) || 0))
    setSheets(
      sheets.map((s) => {
        if (s.id !== sheetId) return s
        const current = ((s as { scoreMap?: number[] }).scoreMap && (s as { scoreMap?: number[] }).scoreMap!.length > 0
          ? (s as { scoreMap: number[] }).scoreMap
          : [1, 2, 3, 4, 5]).slice()
        current[index] = clamped
        return { ...s, scoreMap: current } as typeof s
      }),
    )
  }

  // 2026-07-10 副田さん要望 Phase 3: 問題ごとの個別配点上書き
  const updateQuestionScoreMap = (
    sheetId: string,
    categoryId: string,
    questionId: string,
    nextScoreMap: number[] | null,
  ) => {
    setSheets(
      sheets.map((s) => {
        if (s.id !== sheetId) return s
        const sheetScoreMap = (s as { scoreMap?: number[] }).scoreMap && (s as { scoreMap: number[] }).scoreMap.length > 0
          ? (s as { scoreMap: number[] }).scoreMap
          : [1, 2, 3, 4, 5]
        return {
          ...s,
          categories: s.categories.map((c) => {
            if (c.id !== categoryId) return c
            return {
              ...c,
              questions: c.questions.map((q) => {
                if (q.id !== questionId) return q
                const effectiveLen = nextScoreMap && nextScoreMap.length > 0
                  ? nextScoreMap.length
                  : sheetScoreMap.length
                return {
                  ...q,
                  scoreMap: nextScoreMap,
                  alertOptions: (q.alertOptions || []).filter((pos) => pos < effectiveLen),
                } as typeof q
              }),
            }
          }),
        }
      }),
    )
  }

  const [qOverrideDialog, setQOverrideDialog] = useState<{
    open: boolean
    sheetId: string
    categoryId: string
    questionId: string
  } | null>(null)

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
                c.id === categoryId
                  ? {
                      ...c,
                      questions: c.questions
                        .filter((q) => q.id !== questionId)
                        .map((q, idx) => ({ ...q, number: idx + 1 })),
                    }
                  : c,
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

      // 2026-05-13 (bug fix): 旧実装は loadTests() で全テストを取得し、
      // 編集中の 1 件だけを修正した配列を POST /api/tests に送っていた。
      // POST 側は配列の各要素に対して sheets/categories/questions の
      // upsert + cascade delete を走らせるので、編集していない他テスト
      // (特に同セッションの教員/患者側ペア) の処理中にエラーが起きると、
      // 「教員側を編集したのに患者側のエラーが alert される」「同セッションの
      // 別テストの sheets が誤って cascade delete される」など、ユーザーから
      // すると意味不明な障害になっていた。
      //
      // 修正: 編集対象 1 件だけを送る。POST 側はその 1 件分の cascade のみ実行。
      const tests = await loadTests()
      const currentTest = Array.isArray(tests) ? tests.find((t) => t.id === testId) : null
      if (!currentTest) {
        alert("編集対象のテストが見つかりませんでした。一覧に戻って再度開いてください。")
        setIsSaving(false)
        return
      }
      const updatedTest = {
        ...currentTest,
        title: testTitle,
        sheets,
        testSessionId: testSession.id,
        universityCode: testSession.university_code,
        subjectCode: selectedSubjectCode || undefined,
        roleType: roleType,
        updatedAt: new Date().toISOString(),
      }

      await saveTests([updatedTest])

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
        }
      }

      alert("テストを更新しました")
      router.push("/admin/question-management")
    } catch (error) {
      setIsSaving(false)
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[question-edit] save failed:", msg, error)
      alert(`テストの更新に失敗しました: ${msg}`)
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
      <div className="mx-auto ">
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
              {accountType === "special_master" ? (
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
              ) : (
                <div className="min-w-[160px] flex-1">
                  <Label htmlFor="subject" className="text-xs">担当教科</Label>
                  <p className="text-sm px-3 py-1.5 border rounded-md bg-muted h-9 flex items-center">
                    {filteredSubjects.find((s) => s.subject_code === selectedSubjectCode)?.subject_name || selectedSubjectCode || "未設定"}
                  </p>
                </div>
              )}
              <div className="min-w-[100px]">
                {/* ADR-006 R-2-F6-2: passing_score は % 運用 (0-100)。ラベル/プレースホルダ/バリデーションを統一。 */}
                <Label className="text-xs">合格ライン %(0-100)</Label>
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
                {/* 2026-07-10 副田さん要望 Phase 2: シート単位の N 段階配点 */}
                {(() => {
                  const scoreMap = (sheet as { scoreMap?: number[] }).scoreMap && (sheet as { scoreMap: number[] }).scoreMap.length > 0
                    ? (sheet as { scoreMap: number[] }).scoreMap
                    : [1, 2, 3, 4, 5]
                  return (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-blue-50 p-3 text-sm">
                      <Label className="text-xs font-semibold text-blue-700">段階数</Label>
                      <Input
                        type="number"
                        min={2}
                        max={10}
                        value={scoreMap.length}
                        onChange={(e) => updateSheetScoreMapLength(sheet.id, Number(e.target.value))}
                        className="w-16 h-8"
                      />
                      <span className="mx-1 text-blue-700">段階、配点:</span>
                      {scoreMap.map((val, i) => (
                        <Input
                          key={i}
                          type="number"
                          min={0}
                          value={val}
                          onChange={(e) => updateSheetScoreValue(sheet.id, i, Number(e.target.value))}
                          className="w-14 h-8"
                        />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">(負数不可、0 は許可)</span>
                    </div>
                  )
                })()}
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
                                    {/* 2026-07-10 副田さん要望 Phase 2:
                                        alertOptions は「選択肢の位置 (0-indexed)」、ラベルは実配点値。 */}
                                    {(() => {
                                      // Phase 3: 問題個別 scoreMap を優先
                                      const qMap = (question as { scoreMap?: number[] | null }).scoreMap
                                      const sMap = (sheet as { scoreMap?: number[] }).scoreMap
                                      const scoreMap = Array.isArray(qMap) && qMap.length > 0
                                        ? qMap
                                        : Array.isArray(sMap) && sMap.length > 0
                                        ? sMap
                                        : [1, 2, 3, 4, 5]
                                      return scoreMap.map((val, position) => (
                                        <div key={position} className="flex items-center space-x-1">
                                          <Checkbox
                                            id={`alert-opt-${question.id}-${position}`}
                                            checked={question.alertOptions?.includes(position) || false}
                                            onCheckedChange={() =>
                                              toggleAlertOption(sheet.id, category.id, question.id, position)
                                            }
                                          />
                                          <label
                                            htmlFor={`alert-opt-${question.id}-${position}`}
                                            className="text-xs cursor-pointer"
                                          >
                                            {val}
                                          </label>
                                        </div>
                                      ))
                                    })()}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {/* 2026-07-10 副田さん要望 Phase 3: 問題ごとの個別配点変更 */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setQOverrideDialog({
                                        open: true,
                                        sheetId: sheet.id,
                                        categoryId: category.id,
                                        questionId: question.id,
                                      })
                                    }
                                    className="h-6 text-muted-foreground"
                                    title="この問題の配点を個別変更"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
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

      {/* 2026-07-10 副田さん要望 Phase 3: 問題ごとの個別配点変更ダイアログ */}
      <QuestionScoreMapOverrideDialogEdit
        dialogState={qOverrideDialog}
        onClose={() => setQOverrideDialog(null)}
        sheets={sheets}
        onSave={updateQuestionScoreMap}
      />
    </div>
  )
}

// 2026-07-10 副田さん要望 Phase 3: 問題ごとの個別配点変更ダイアログ (edit 用)
interface QSheetLikeE {
  id: string
  scoreMap?: number[]
  categories: Array<{
    id: string
    questions: Array<{ id: string; number: number; scoreMap?: number[] | null }>
  }>
}

function QuestionScoreMapOverrideDialogEdit({
  dialogState,
  onClose,
  sheets,
  onSave,
}: {
  dialogState: { open: boolean; sheetId: string; categoryId: string; questionId: string } | null
  onClose: () => void
  sheets: QSheetLikeE[]
  onSave: (
    sheetId: string,
    categoryId: string,
    questionId: string,
    nextScoreMap: number[] | null,
  ) => void
}) {
  const [enabled, setEnabled] = useState(false)
  const [draftMap, setDraftMap] = useState<number[]>([1, 2, 3, 4, 5])

  useEffect(() => {
    if (!dialogState?.open) return
    const sheet = sheets.find((s) => s.id === dialogState.sheetId)
    const cat = sheet?.categories.find((c) => c.id === dialogState.categoryId)
    const question = cat?.questions.find((q) => q.id === dialogState.questionId)
    const qMap = question?.scoreMap
    if (Array.isArray(qMap) && qMap.length > 0) {
      setEnabled(true)
      setDraftMap(qMap.slice())
    } else {
      setEnabled(false)
      const sMap = sheet?.scoreMap
      setDraftMap(Array.isArray(sMap) && sMap.length > 0 ? sMap.slice() : [1, 2, 3, 4, 5])
    }
  }, [dialogState, sheets])

  if (!dialogState) return null
  const sheet = sheets.find((s) => s.id === dialogState.sheetId)
  const cat = sheet?.categories.find((c) => c.id === dialogState.categoryId)
  const question = cat?.questions.find((q) => q.id === dialogState.questionId)
  const sheetMap = Array.isArray(sheet?.scoreMap) && sheet!.scoreMap!.length > 0 ? sheet!.scoreMap! : [1, 2, 3, 4, 5]

  const changeLen = (rawLen: number) => {
    const nextLen = Math.max(2, Math.min(10, Math.floor(rawLen) || 5))
    setDraftMap((prev) => Array.from({ length: nextLen }, (_, i) => prev[i] ?? i + 1))
  }
  const changeVal = (idx: number, v: number) => {
    setDraftMap((prev) => {
      const next = prev.slice()
      next[idx] = Math.max(0, Math.floor(Number(v) || 0))
      return next
    })
  }
  const save = () => {
    onSave(dialogState.sheetId, dialogState.categoryId, dialogState.questionId, enabled ? draftMap : null)
    onClose()
  }

  return (
    <Dialog open={dialogState.open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>問題 {question?.number ?? ""} の配点</DialogTitle>
          <DialogDescription>
            シート設定 [{sheetMap.join(", ")}] を上書きしてこの問題だけ独自の配点にできます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            この問題だけ個別に設定する
          </label>
          {enabled && (
            <div className="space-y-3 rounded-md bg-blue-50 p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-blue-700">段階数</span>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={draftMap.length}
                  onChange={(e) => changeLen(Number(e.target.value))}
                  className="w-16 h-8"
                />
                <span className="text-blue-700">段階</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-blue-700">配点</span>
                {draftMap.map((v, i) => (
                  <Input
                    key={i}
                    type="number"
                    min={0}
                    value={v}
                    onChange={(e) => changeVal(i, Number(e.target.value))}
                    className="w-14 h-8"
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                負数は不許可、0 は許可。段階数を減らすと範囲外のアラート設定は自動で外れます。
              </p>
            </div>
          )}
          {!enabled && (
            <p className="text-xs text-muted-foreground">
              チェックを外すとシートの設定 [{sheetMap.join(", ")}] が使われます。
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={save}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
