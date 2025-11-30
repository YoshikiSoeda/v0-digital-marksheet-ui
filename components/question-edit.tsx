"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loadTests, saveTests, type Sheet, type Question } from "@/lib/data-storage"

interface QuestionEditProps {
  testId: string
}

export function QuestionEdit({ testId }: QuestionEditProps) {
  const router = useRouter()
  const [testTitle, setTestTitle] = useState("")
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tests = loadTests()
    const test = tests.find((t) => t.id === testId)

    if (!test) {
      alert("テストが見つかりませんでした")
      router.push("/admin/question-management")
      return
    }

    setTestTitle(test.title)
    setSheets(test.sheets)
    setLoading(false)
  }, [testId, router])

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

  const handleSave = () => {
    if (!testTitle.trim()) {
      alert("テスト名を入力してください")
      return
    }

    const tests = loadTests()
    const updatedTests = tests.map((t) =>
      t.id === testId
        ? {
            ...t,
            title: testTitle,
            sheets,
            updatedAt: new Date().toISOString(),
          }
        : t,
    )

    saveTests(updatedTests)
    alert("テストを更新しました")
    router.push("/admin/question-management")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E5EFFC] p-4 md:p-8 flex items-center justify-center">
        <div className="text-lg font-semibold">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E5EFFC] p-4 md:p-8">
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
          <Button onClick={handleSave} className="bg-[#00417A] hover:bg-[#00417A]/90">
            更新
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>テスト情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="testTitle">テスト名（タイトル1）</Label>
                <Input
                  id="testTitle"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="例: 2024年度 OSCE実技試験"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {sheets.map((sheet) => (
            <Card key={sheet.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex-1">
                  <Label>シート名（タイトル2）</Label>
                  <Input
                    value={sheet.title}
                    onChange={(e) => updateSheetTitle(sheet.id, e.target.value)}
                    placeholder="例: 教員評価シート"
                  />
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
                        <div key={question.id} className="rounded-lg border bg-white p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <Label>問題 {question.number}</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQuestion(sheet.id, category.id, question.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Textarea
                              value={question.text}
                              onChange={(e) =>
                                updateQuestion(sheet.id, category.id, question.id, "text", e.target.value)
                              }
                              placeholder="問題文"
                              rows={2}
                            />
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                              <Input
                                value={question.option1}
                                onChange={(e) =>
                                  updateQuestion(sheet.id, category.id, question.id, "option1", e.target.value)
                                }
                                placeholder="選択肢1"
                              />
                              <Input
                                value={question.option2}
                                onChange={(e) =>
                                  updateQuestion(sheet.id, category.id, question.id, "option2", e.target.value)
                                }
                                placeholder="選択肢2"
                              />
                              <Input
                                value={question.option3}
                                onChange={(e) =>
                                  updateQuestion(sheet.id, category.id, question.id, "option3", e.target.value)
                                }
                                placeholder="選択肢3"
                              />
                              <Input
                                value={question.option4}
                                onChange={(e) =>
                                  updateQuestion(sheet.id, category.id, question.id, "option4", e.target.value)
                                }
                                placeholder="選択肢4"
                              />
                              <Input
                                value={question.option5}
                                onChange={(e) =>
                                  updateQuestion(sheet.id, category.id, question.id, "option5", e.target.value)
                                }
                                placeholder="選択肢5"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`alert-${question.id}`}
                                checked={question.isAlertTarget}
                                onCheckedChange={(checked) =>
                                  updateQuestion(sheet.id, category.id, question.id, "isAlertTarget", checked === true)
                                }
                              />
                              <label
                                htmlFor={`alert-${question.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                アラート対象
                              </label>
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
