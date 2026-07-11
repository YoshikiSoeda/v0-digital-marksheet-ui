"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, FileDown, MoreHorizontal } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { saveTests, type Test, type Sheet, type Question } from "@/lib/data-storage"
import { useSession } from "@/lib/auth/use-session"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { readCsvFile, csvDownloadBlob } from "@/lib/csv"

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
    // 2026-05-20 副田さん仕様: 試験セッションは教科に属する必要がある (subject_admin スコープのため)
    if (!selectedSubject) {
      alert("教科を選択してください")
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

  // 2026-07-10 副田さん要望 Phase 2: シート単位の N 段階配点編集
  // 段階数変更時: 短くなる方向は末尾を捨てる、長くなる方向は次の連番で埋める。
  //   合わせて属する questions.alertOptions から範囲外の位置を drop する。
  const updateSheetScoreMapLength = (testId: string, sheetId: string, rawLength: number) => {
    const nextLen = Math.max(2, Math.min(10, Math.floor(rawLength) || 5))
    setTests(
      tests.map((t) => {
        if (t.id !== testId) return t
        return {
          ...t,
          sheets: t.sheets.map((s) => {
            if (s.id !== sheetId) return s
            const current = (s as { scoreMap?: number[] }).scoreMap && (s as { scoreMap?: number[] }).scoreMap!.length > 0
              ? (s as { scoreMap: number[] }).scoreMap
              : [1, 2, 3, 4, 5]
            const nextMap = Array.from({ length: nextLen }, (_, i) => current[i] ?? i + 1)
            const trimmedCats = s.categories.map((c) => ({
              ...c,
              questions: c.questions.map((q) => ({
                ...q,
                alertOptions: (q.alertOptions || []).filter((pos) => pos < nextLen),
              })),
            }))
            return { ...s, scoreMap: nextMap, categories: trimmedCats } as typeof s
          }),
        }
      }),
    )
  }

  const updateSheetScoreValue = (testId: string, sheetId: string, index: number, value: number) => {
    const clamped = Math.max(0, Math.floor(Number(value) || 0))
    setTests(
      tests.map((t) => {
        if (t.id !== testId) return t
        return {
          ...t,
          sheets: t.sheets.map((s) => {
            if (s.id !== sheetId) return s
            const current = ((s as { scoreMap?: number[] }).scoreMap && (s as { scoreMap?: number[] }).scoreMap!.length > 0
              ? (s as { scoreMap: number[] }).scoreMap
              : [1, 2, 3, 4, 5]).slice()
            current[index] = clamped
            return { ...s, scoreMap: current } as typeof s
          }),
        }
      }),
    )
  }

  // 2026-07-10 副田さん要望 Phase 3: 問題ごとの個別配点上書き。
  //   scoreMap=null (or []) → シートの scoreMap を継承。
  //   scoreMap=[a,b,c] → その問題だけ独自配点。
  //   合わせて alertOptions の範囲外位置を除去する。
  const updateQuestionScoreMap = (
    testId: string,
    sheetId: string,
    categoryId: string,
    questionId: string,
    nextScoreMap: number[] | null,
  ) => {
    setTests(
      tests.map((t) => {
        if (t.id !== testId) return t
        return {
          ...t,
          sheets: t.sheets.map((s) => {
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
        }
      }),
    )
  }

  // 2026-07-10 副田さん要望 Phase 3: 問題ごと配点編集ダイアログの制御
  const [qOverrideDialog, setQOverrideDialog] = useState<{
    open: boolean
    testId: string
    sheetId: string
    categoryId: string
    questionId: string
  } | null>(null)

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

      // 2026-05-13 (bug fix): 旧実装は既存全テストを再 POST して新テストを追加していたが、
      // それは他のテストの cascade delete を不必要に走らせ、稀なエラーで関係ない
      // テストが壊れるリスクがあった (question-edit と同じ問題)。新規登録は新テストのみ送る。
      await saveTests(newTests)

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

    const blob = csvDownloadBlob(csvContent)
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "問題登録テンプレート.csv"
    link.click()
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    let text: string
    try {
      // 2026-05-20 副田さん報告: Excel 保存の Shift-JIS CSV が化けるため自動判定
      text = await readCsvFile(file)
    } catch (err) {
      alert(err instanceof Error ? err.message : "CSV ファイルの読み込みに失敗しました")
      return
    }
    {
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
  }

  const filteredTestSessions = testSessions.filter(
    (ts) => !selectedUniversity || ts.university_code === selectedUniversity,
  )

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

                {/* 2026-05-20 副田さん指摘: uni (university_admin, subject_code=NULL) で
                    isTeacher=true だが教科 Select が出なかった問題を修正。
                    教員でも subject_code が固定されていない場合 (university_admin / master_admin) は
                    自由に教科を選べる必要がある。 */}
                {!teacherSubjectCode && subjects.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">教科 *</Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue placeholder="教科を選択" />
                      </SelectTrigger>
                      <SelectContent>
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
                                onChange={(e) =>
                                  updateSheetScoreMapLength(test.id, sheet.id, Number(e.target.value))
                                }
                                className="w-16 h-8"
                              />
                              <span className="mx-1 text-blue-700">段階、配点:</span>
                              {scoreMap.map((val, i) => (
                                <Input
                                  key={i}
                                  type="number"
                                  min={0}
                                  value={val}
                                  onChange={(e) =>
                                    updateSheetScoreValue(test.id, sheet.id, i, Number(e.target.value))
                                  }
                                  className="w-14 h-8"
                                />
                              ))}
                              <span className="ml-1 text-xs text-muted-foreground">
                                (負数不可、0 は許可)
                              </span>
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
                                            {/* 2026-07-10 副田さん要望 Phase 2:
                                                alertOptions は「選択肢の位置 (0-indexed)」で持つ。
                                                ラベルは sheet.scoreMap の実配点値を表示。 */}
                                            {(() => {
                                              // 2026-07-10 Phase 3: 問題個別 scoreMap を優先
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
                                                      toggleAlertOption(
                                                        test.id,
                                                        sheet.id,
                                                        category.id,
                                                        question.id,
                                                        position,
                                                      )
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
                                                testId: test.id,
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
                                            onClick={() => removeQuestion(test.id, sheet.id, category.id, question.id)}
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
                                        {question.isAlertTarget && (() => {
                                          // 2026-07-10 副田さん要望 Phase 2/3: 位置ベースの alertOptions を実配点値で表示 (問題個別 scoreMap 優先)
                                          const qMap = (question as { scoreMap?: number[] | null }).scoreMap
                                          const sMap = (sheet as { scoreMap?: number[] }).scoreMap
                                          const scoreMap = Array.isArray(qMap) && qMap.length > 0
                                            ? qMap
                                            : Array.isArray(sMap) && sMap.length > 0
                                            ? sMap
                                            : [1, 2, 3, 4, 5]
                                          const values = (question.alertOptions || [])
                                            .map((p) => scoreMap[p])
                                            .filter((v) => v != null)
                                          return (
                                            <span className="ml-2 text-red-600 font-medium">
                                              [アラート: {values.join(",")}]
                                            </span>
                                          )
                                        })()}
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

      {/* 2026-07-10 副田さん要望 Phase 3: 問題ごとの個別配点変更ダイアログ */}
      <QuestionScoreMapOverrideDialog
        dialogState={qOverrideDialog}
        onClose={() => setQOverrideDialog(null)}
        tests={tests}
        onSave={updateQuestionScoreMap}
      />
    </div>
  )
}

// 2026-07-10 副田さん要望 Phase 3: 問題ごとの個別配点変更ダイアログ
interface QOverrideDialogState {
  open: boolean
  testId: string
  sheetId: string
  categoryId: string
  questionId: string
}

interface QSheetLike {
  id: string
  scoreMap?: number[]
  categories: Array<{
    id: string
    questions: Array<{ id: string; number: number; scoreMap?: number[] | null }>
  }>
}
interface QTestLike { id: string; sheets: QSheetLike[] }

function QuestionScoreMapOverrideDialog({
  dialogState,
  onClose,
  tests,
  onSave,
}: {
  dialogState: QOverrideDialogState | null
  onClose: () => void
  tests: QTestLike[]
  onSave: (
    testId: string,
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
    const test = tests.find((t) => t.id === dialogState.testId)
    const sheet = test?.sheets.find((s) => s.id === dialogState.sheetId)
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
  }, [dialogState, tests])

  if (!dialogState) return null
  const test = tests.find((t) => t.id === dialogState.testId)
  const sheet = test?.sheets.find((s) => s.id === dialogState.sheetId)
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
    onSave(dialogState.testId, dialogState.sheetId, dialogState.categoryId, dialogState.questionId, enabled ? draftMap : null)
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
