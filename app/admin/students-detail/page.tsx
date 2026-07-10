"use client"

import { useEffect, useState, useCallback } from "react"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// 2026-07-03 副田さん再要望対応: shadcn Table の overflow-x-auto ラッパーが
// sticky を妨げるため、raw <table> で書き換え。unused import を削除。
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Download, StopCircle, ChevronDown, ChevronRight } from "lucide-react"
import {
  loadStudents,
  loadEvaluationResults,
  loadAttendanceRecords,
  loadTests,
  type Student,
  type EvaluationResult,
  type AttendanceRecord,
  type Test,
} from "@/lib/data-storage"
import { computePassResult } from "@/lib/passing"
import { useSession } from "@/lib/auth/use-session"

// ADR-005 hotfix: テスト終了ボタンを表示できる accountType / role の集合
// (api-guard.ts ADMIN_ROLES と意味的に対応)
const TEST_END_ALLOWED_ROLES = new Set([
  "master_admin",
  "university_admin",
  "subject_admin",
  "admin",
  "special_master",
  "university_master",
])

export default function StudentsDetailPage() {
  const { session } = useSession()
  // ADR-005 hotfix: admin 権限がないユーザーには「テスト終了」ボタンを非表示
  const canEndTest = !!session && (
    TEST_END_ALLOWED_ROLES.has(session.role || "") ||
    TEST_END_ALLOWED_ROLES.has(session.accountType || "")
  )
  const [students, setStudents] = useState<Student[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [testSessions, setTestSessions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEndingTest, setIsEndingTest] = useState(false)
  const [filterUniversity, setFilterUniversity] = useState<string>("")
  const [filterTestSessionId, setFilterTestSessionId] = useState<string>("")
  // 2026-07-03 副田さん要望: 「内容」列 (問題ごとの点数) をアコーディオン開閉
  const [contentExpanded, setContentExpanded] = useState(false)

  // 2026-07-10 副田さん要望 (案 C ハイブリッド自動更新): 受験者一覧を
  //   タブフォーカス時 + 30 秒 polling で自動再取得。fetchData を useCallback
  //   でラップして stable な参照にする。
  const fetchData = useCallback(async (opts: { silent?: boolean } = {}) => {
    const params = new URLSearchParams(window.location.search)
    const university = params.get("university") || ""
    try {
      const testSessionId = sessionStorage.getItem("testSessionId") || ""
      const [studentsData, evaluationsData, attendanceData, testsData, testSessionsData] = await Promise.all([
        loadStudents(university || undefined, undefined, testSessionId),
        loadEvaluationResults(university || undefined, testSessionId),
        loadAttendanceRecords(university || undefined, testSessionId),
        loadTests(university || undefined),
        fetch("/api/test-sessions")
          .then((res) => res.json())
          .catch(() => []),
      ])

      setStudents(Array.isArray(studentsData) ? studentsData : [])
      setEvaluations(Array.isArray(evaluationsData) ? evaluationsData : [])
      setAttendanceRecords(Array.isArray(attendanceData) ? attendanceData : [])
      setTests(Array.isArray(testsData) ? testsData : [])
      setTestSessions(Array.isArray(testSessionsData) ? testSessionsData : [])
    } catch (error) {
    } finally {
      if (!opts.silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // URL パラメータ初期化 (初回のみ)
    const params = new URLSearchParams(window.location.search)
    setFilterUniversity(params.get("university") || "")
    setFilterTestSessionId(params.get("testSessionId") || "")
    void fetchData()
  }, [fetchData])

  const autoRefreshHandler = useCallback(() => fetchData({ silent: true }), [fetchData])
  useAutoRefresh(autoRefreshHandler, 30000)

  const filteredTests = filterTestSessionId
    ? tests.filter((test) => test.testSessionId === filterTestSessionId)
    : tests

  // 2026-07-03 副田さん要望: 現セッションのテストから教員① / 教員② / 患者役 slot を割り出す
  const sessionTests = filteredTests.slice().sort((a, b) => {
    // teacher を先に、その中で createdAt 昇順
    const ra = ((a as any).roleType || "teacher") === "teacher" ? 0 : 1
    const rb = ((b as any).roleType || "teacher") === "teacher" ? 0 : 1
    if (ra !== rb) return ra - rb
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  })
  const teacherSlotTests = sessionTests.filter((t) => ((t as any).roleType || "teacher") === "teacher")
  const patientSlotTests = sessionTests.filter((t) => (t as any).roleType === "patient")

  // 2026-07-03: 「内容」列 (問題別点数) の列を組み立てる
  //   問題文を列名にする。教員側テストの全問題 + 患者側テストの全問題を横に並べる。
  interface ContentColumn {
    testId: string
    testTitle: string
    roleType: "teacher" | "patient"
    sheetTitle: string
    categoryNumber: number
    categoryTitle: string
    questionNumber: number
    questionText: string
    compositeKey: string  // カテゴリ跨ぎで一意
    maxScore: number  // 常に 5 (5 段階評価)
  }
  const contentColumns: ContentColumn[] = []
  for (const test of sessionTests) {
    const role: "teacher" | "patient" = ((test as any).roleType || "teacher") === "teacher" ? "teacher" : "patient"
    for (const sheet of test.sheets || []) {
      for (const cat of sheet.categories || []) {
        for (const q of (cat as any).questions || []) {
          contentColumns.push({
            testId: test.id,
            testTitle: test.title,
            roleType: role,
            sheetTitle: sheet.title,
            categoryNumber: cat.number,
            categoryTitle: cat.title,
            questionNumber: q.number,
            questionText: q.text || "",
            compositeKey: `${cat.number}-${q.number}`,
            maxScore: 5,
          })
        }
      }
    }
  }
  // カテゴリ+質問の重複を除去
  const seenKeys = new Set<string>()
  const dedupedContentColumns: ContentColumn[] = []
  for (const col of contentColumns) {
    const k = `${col.testId}::${col.compositeKey}`
    if (seenKeys.has(k)) continue
    seenKeys.add(k)
    dedupedContentColumns.push(col)
  }

  // セッションの合計満点 (5 × 全質問数)
  const sessionMaxTotal = dedupedContentColumns.reduce((sum, c) => sum + c.maxScore, 0)

  const getStudentData = (student: Student) => {
    // ADR-005 F5: attendance_records.student_id / exam_results.student_id は students.id (UUID) を参照する。
    // student.studentId(学籍番号 text)で比較していたため常に miss して全員「未受験」扱いになっていた。
    const studentAttendance = attendanceRecords.find((a) => a.studentId === student.id)

    const studentEvaluations = evaluations.filter((e) => {
      if (e.studentId !== student.id) return false
      if (!filterTestSessionId) return true

      // 試験セッションIDでフィルタ
      const test = tests.find((t) => t.id === e.testId)
      if (!test) return false

      return test.testSessionId === filterTestSessionId
    })

    const completedEvaluations = studentEvaluations.filter((e) => e.isCompleted)
    const totalScore = completedEvaluations.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    const averageScore = completedEvaluations.length > 0 ? Math.round(totalScore / completedEvaluations.length) : 0

    // Calculate teacher and patient scores separately
    const teacherEvals = completedEvaluations.filter((e: any) => e.evaluatorType === "teacher")
    const patientEvals = completedEvaluations.filter((e: any) => e.evaluatorType === "patient")
    const teacherScore = teacherEvals.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    const patientScore = patientEvals.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    const combinedScore = teacherScore + patientScore

    // 2026-07-03 副田さん要望: 教員①/教員②/患者役 の個別点数
    // メール昇順で slot 順に採点者を並べ、それぞれの合計スコアを取得。
    // 部屋内の教員/患者役のメール昇順が UI と一致するように。
    const roomTeacherEmails = teacherEvals
      .map((e: any) => e.evaluatorEmail || e.evaluatorId || "")
      .filter((email, idx, arr) => email && arr.indexOf(email) === idx)
      .sort((a, b) => a.localeCompare(b))
    const roomPatientEmails = patientEvals
      .map((e: any) => e.evaluatorEmail || e.evaluatorId || "")
      .filter((email, idx, arr) => email && arr.indexOf(email) === idx)
      .sort((a, b) => a.localeCompare(b))

    const teacherSlotScores: (number | "")[] = teacherSlotTests.map((_, slotIdx) => {
      const email = roomTeacherEmails[slotIdx]
      if (!email) return ""
      const evalsForSlot = teacherEvals.filter((e: any) => (e.evaluatorEmail || e.evaluatorId) === email)
      if (evalsForSlot.length === 0) return ""
      return evalsForSlot.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    })
    const patientSlotScores: (number | "")[] = patientSlotTests.map((_, slotIdx) => {
      const email = roomPatientEmails[slotIdx]
      if (!email) return ""
      const evalsForSlot = patientEvals.filter((e: any) => (e.evaluatorEmail || e.evaluatorId) === email)
      if (evalsForSlot.length === 0) return ""
      return evalsForSlot.reduce((sum, e) => sum + (e.totalScore || 0), 0)
    })

    // 2026-07-03 副田さん要望: 問題別スコア (「内容」列用)。
    //   evaluation.answers (compositeKey → optionValue) から compositeKey で照合。
    //   複数評価者 (教員① と 教員②) が同じテストを採点している場合は合計。
    const contentScores: Record<string, number | ""> = {}
    for (const col of dedupedContentColumns) {
      let matchCount = 0
      let sum = 0
      for (const ev of completedEvaluations) {
        if ((ev as any).testId !== col.testId) continue
        const answers = (ev as any).answers as Record<string, number> | undefined
        if (!answers) continue
        const v = answers[col.compositeKey] ?? answers[col.questionNumber as any]
        if (typeof v === "number") {
          sum += v
          matchCount++
        }
      }
      contentScores[`${col.testId}::${col.compositeKey}`] = matchCount > 0 ? sum : ""
    }

    // 2026-07-03 副田さん要望: 割合 = 合計得点 / セッション満点 × 100
    const percentage = sessionMaxTotal > 0 ? Math.round((combinedScore / sessionMaxTotal) * 100) : null
    const isBelow50 = percentage !== null && percentage < 50 && completedEvaluations.length > 0

    // ADR-006: 合格判定を passing_score (% 0-100) で行う
    const currentSessionId = sessionStorage.getItem("testSessionId") || filterTestSessionId
    const currentSession = testSessions.find((s: any) => s.id === currentSessionId)
    const passingScore = currentSession?.passing_score
    const passDetail = computePassResult({
      evaluations: completedEvaluations.map((e: any) => ({
        totalScore: e.totalScore,
        maxScore: e.maxScore,
        isCompleted: e.isCompleted,
        evaluatorType: e.evaluatorType,
      })),
      passingScore,
    })
    const passResult = passDetail.result

    // ADR-005 F5: 旧実装は filteredTests[0].title を全行にコピーしていたため、
    // testSessionId フィルタが効いていない場合は他大学の test 名がそのまま表示されていた。
    // 試験セッション名(description)は学生横串で意味のある単一値なのでこれを採用する。
    const sessionForRow = currentSession || testSessions.find((s: any) => s.id === filterTestSessionId)
    const testTitle = sessionForRow?.description || ""

    let status = "未受験"
    if (studentAttendance?.status === "present") {
      if (completedEvaluations.length > 0) {
        status = "完了"
      } else {
        status = "進行中"
      }
    } else if (studentAttendance?.status === "absent") {
      status = "欠席"
    }

    const progress = completedEvaluations.length > 0 ? "完了" : studentAttendance?.status === "present" ? "進行中" : ""

    return {
      testTitle,
      progress,
      score: combinedScore > 0 ? combinedScore : "",
      teacherScore: teacherEvals.length > 0 ? teacherScore : "",
      patientScore: patientEvals.length > 0 ? patientScore : "",
      passResult,
      status,
      // 2026-07-03: 新項目
      teacherSlotScores,
      patientSlotScores,
      contentScores,
      percentage,
      isBelow50,
      combinedScore,
    }
  }

  const currentSessionId = typeof window !== "undefined" ? (sessionStorage.getItem("testSessionId") || filterTestSessionId) : filterTestSessionId
  const currentSession = testSessions.find((s: any) => s.id === currentSessionId)
  const sessionStatus = currentSession?.status || "not_started"

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "not_started": return "未実施"
      case "in_progress": return "実施中"
      case "completed": return "テスト終了"
      default: return status
    }
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": return "destructive"
      case "in_progress": return "default"
      default: return "outline"
    }
  }

  const handleEndTest = async () => {
    if (!currentSessionId) {
      alert("試験セッションが選択されていません。ダッシュボードから受験者一覧を開き直してください。")
      return
    }
    setIsEndingTest(true)
    try {
      const res = await fetch(`/api/test-sessions/${currentSessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      })
      if (res.ok) {
        setTestSessions((prev) =>
          prev.map((s) => (s.id === currentSessionId ? { ...s, status: "completed" } : s))
        )
      } else {
        // ADR-005 hotfix: 旧実装は silent fail だったため何が起きているか不明だった
        let detail = ""
        try {
          const j = await res.json()
          detail = j?.error ? `: ${j.error}` : ""
        } catch {}
        if (res.status === 401) {
          alert(`ログインセッションが切れている可能性があります。再度ログインしてください${detail}`)
        } else if (res.status === 403) {
          alert(`このアカウントには「テスト終了」操作の権限がありません(管理者・大学管理者のみ可能)${detail}`)
        } else {
          alert(`テスト終了に失敗しました (HTTP ${res.status})${detail}`)
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      alert(`テスト終了処理でネットワークエラー: ${msg}`)
    } finally {
      setIsEndingTest(false)
    }
  }

  const handleExportCSV = () => {
    // 2026-07-03 副田さん要望に合わせて列を再構成
    const CIRCLE = ["①", "②", "③", "④", "⑤"]
    const teacherHeaders = teacherSlotTests.map((_, i) =>
      `教員${teacherSlotTests.length > 1 ? CIRCLE[i] || `(${i + 1})` : ""}`,
    )
    const patientHeaders = patientSlotTests.map((_, i) =>
      `患者役${patientSlotTests.length > 1 ? CIRCLE[i] || `(${i + 1})` : ""}`,
    )
    const contentHeaders = dedupedContentColumns.map(
      (col) => `${col.categoryTitle}/${col.questionText}`,
    )
    const headers = [
      "学籍番号",
      "氏名",
      "部屋",
      "メールアドレス",
      ...contentHeaders,
      "点数",
      ...teacherHeaders,
      ...patientHeaders,
      "割合",
      "ステータス",
    ]
    const rows = students.map((student) => {
      const data = getStudentData(student)
      return [
        student.studentId,
        student.name,
        student.roomNumber || "",
        student.email || "",
        ...dedupedContentColumns.map((col) => {
          const val = data.contentScores[`${col.testId}::${col.compositeKey}`]
          return typeof val === "number" ? String(val) : ""
        }),
        typeof data.score === "number" ? String(data.score) : "",
        ...data.teacherSlotScores.map((s) => (typeof s === "number" ? String(s) : "")),
        ...data.patientSlotScores.map((s) => (typeof s === "number" ? String(s) : "")),
        data.percentage != null ? `${data.percentage}%` : "",
        data.status,
      ]
    })

    const bom = "\uFEFF"
    const csvContent = bom + [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const sessionDesc = currentSession?.description || "students"
    link.download = `${sessionDesc}_受験者一覧.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">データ読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">受験者一覧</h1>
              <Badge variant={getStatusVariant(sessionStatus)} className="text-sm px-3 py-1">
                {getStatusLabel(sessionStatus)}
              </Badge>
            </div>
            {(filterUniversity || filterTestSessionId) && (
              <p className="text-sm text-muted-foreground mt-1">
                {filterUniversity && `大学: ${filterUniversity}`}
                {filterUniversity && filterTestSessionId && " / "}
                {filterTestSessionId && (() => {
                  const session = testSessions.find((s: any) => s.id === filterTestSessionId)
                  return `試験: ${session?.description || filterTestSessionId}`
                })()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              CSV出力
            </Button>

            {/* ADR-005 hotfix: admin 権限がないユーザー(教員一般 / 患者役)には非表示 */}
            {canEndTest && sessionStatus !== "completed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex items-center gap-2" disabled={isEndingTest}>
                    <StopCircle className="w-4 h-4" />
                    テスト終了
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>テストを終了しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      この操作により、テストセッションのステータスが「テスト終了」に変更されます。この操作は取り消せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndTest} disabled={isEndingTest}>
                      {isEndingTest ? "処理中..." : "テスト終了"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button onClick={() => (window.location.href = "/admin/dashboard")} variant="outline">
              ダッシュボードに戻る
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-baseline gap-3">
              <CardTitle>全受験者</CardTitle>
              {/* 2026-07-03 副田さん要望: セッションタイトル + 合計点表示 */}
              {currentSession?.description && (
                <span className="text-base font-medium text-primary">
                  {currentSession.description}
                </span>
              )}
              {sessionMaxTotal > 0 && (
                <span className="text-sm text-muted-foreground">
                  合計点: <span className="font-semibold text-foreground">{sessionMaxTotal}</span> 点満点
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* 2026-07-03 副田さん要望: 内容 (問題別点数) の表示切替 */}
            <div className="mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContentExpanded((v) => !v)}
                className="h-8 text-xs"
              >
                {contentExpanded ? (
                  <ChevronDown className="w-3 h-3 mr-1" />
                ) : (
                  <ChevronRight className="w-3 h-3 mr-1" />
                )}
                内容 (全 {dedupedContentColumns.length} 問) を{contentExpanded ? "非表示" : "表示"}
              </Button>
            </div>
            {/* 2026-07-03 副田さん再要望: 列名スクロール固定 + 横スクロール常に表示
                shadcn <Table> は内部で overflow-x-auto の div を wrap するため、
                縦スクロール container 内で thead の sticky が効かない。
                生の <table> で書き換えて sticky を確実に効かせる。 */}
            <div
              className="border rounded-md max-h-[70vh]"
              style={{
                overflowX: "scroll",   // 横スクロールバー常時表示
                overflowY: "auto",     // 縦は必要時のみ
              }}
            >
              <table className="w-max min-w-full text-sm caption-bottom">
                <thead className="sticky top-0 z-20 bg-white shadow-sm">
                  <tr className="border-b">
                    <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">学籍番号</th>
                    <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">氏名</th>
                    <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">部屋</th>
                    <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">メールアドレス</th>
                    {contentExpanded && dedupedContentColumns.map((col) => (
                      <th
                        key={`${col.testId}::${col.compositeKey}`}
                        className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white text-xs "
                        title={`${col.testTitle} / ${col.sheetTitle} / ${col.categoryTitle} / ${col.questionText}`}
                      >
                        <span className="text-[10px] text-muted-foreground block">
                          {col.roleType === "teacher" ? "教員側" : "患者側"} {col.categoryTitle}
                        </span>
                        <span className="block truncate ">{col.questionText}</span>
                      </th>
                    ))}
                    <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">点数</th>
                    {teacherSlotTests.map((_, i) => (
                      <th key={`th-t-${i}`} className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">
                        教員{teacherSlotTests.length > 1 ? ["①", "②", "③"][i] || `(${i + 1})` : ""}
                      </th>
                    ))}
                    {patientSlotTests.map((_, i) => (
                      <th key={`th-p-${i}`} className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">
                        患者役{patientSlotTests.length > 1 ? ["①", "②"][i] || `(${i + 1})` : ""}
                      </th>
                    ))}
                    <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">割合</th>
                    <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-white">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const data = getStudentData(student)
                    return (
                      <tr
                        key={student.id}
                        className={`border-b hover:bg-muted/50 transition-colors ${
                          data.isBelow50 ? "bg-red-50 hover:bg-red-100" : ""
                        }`}
                      >
                        <td className="p-2 align-middle whitespace-nowrap">{student.studentId}</td>
                        <td className="p-2 align-middle whitespace-nowrap">{student.name}</td>
                        <td className="p-2 align-middle whitespace-nowrap">{student.roomNumber || "-"}</td>
                        <td className="p-2 align-middle whitespace-nowrap text-xs font-mono">{student.email || "-"}</td>
                        {contentExpanded && dedupedContentColumns.map((col) => {
                          const val = data.contentScores[`${col.testId}::${col.compositeKey}`]
                          return (
                            <td
                              key={`${student.id}-${col.testId}-${col.compositeKey}`}
                              className="p-2 align-middle text-center text-sm whitespace-nowrap"
                            >
                              {typeof val === "number" ? val : "-"}
                            </td>
                          )
                        })}
                        <td className="p-2 align-middle whitespace-nowrap font-semibold">
                          {typeof data.score === "number" ? data.score : "-"}
                        </td>
                        {data.teacherSlotScores.map((s, i) => (
                          <td key={`td-t-${student.id}-${i}`} className="p-2 align-middle whitespace-nowrap">
                            {typeof s === "number" ? s : "-"}
                          </td>
                        ))}
                        {data.patientSlotScores.map((s, i) => (
                          <td key={`td-p-${student.id}-${i}`} className="p-2 align-middle whitespace-nowrap">
                            {typeof s === "number" ? s : "-"}
                          </td>
                        ))}
                        <td className="p-2 align-middle whitespace-nowrap">
                          {data.percentage != null ? (
                            <span
                              className={
                                data.isBelow50
                                  ? "font-bold text-red-700"
                                  : "font-semibold"
                              }
                            >
                              {data.percentage}%
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-2 align-middle whitespace-nowrap">
                          <Badge
                            variant={
                              data.status === "完了"
                                ? "default"
                                : data.status === "進行中"
                                  ? "secondary"
                                  : data.status === "欠席"
                                    ? "destructive"
                                    : "outline"
                            }
                          >
                            {data.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

