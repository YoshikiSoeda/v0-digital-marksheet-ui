"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  type AttendanceRecord,
  type EvaluationResult,
  type Room,
  loadTests,
  loadStudents,
  loadAttendanceRecords,
  loadEvaluationResults,
  saveAttendanceRecords,
  saveEvaluationResults,
  loadTeachers,
  loadRooms,
} from "@/lib/data-storage"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useSession } from "@/lib/auth/use-session"
import { ExamSessionBanner } from "@/components/exam-session-banner"
import {
  calculateScore,
  getTestSessionId,
  flattenTestQuestions,
  buildEvaluationMaps,
  computeHasAlert,
} from "@/lib/exam/utils"
import { useElapsedTimer, useGroupedQuestions } from "@/lib/exam/hooks"
import { ExamQuestionsRenderer } from "@/components/exam-questions-renderer"

interface TeacherExamTabsProps {
  teacherEmail: string
  /**
   * 担当部屋番号。一般教員は cookie に必ず入っている前提だが、
   * isFlexibleRoom=true (university_admin / subject_admin で部屋未割当) のときは
   * 空文字 "" が渡され、UI で任意選択する。
   */
  teacherRoomNumber: string
  testId: string
  /**
   * 2026-05-04: 上位教員ロール (university_admin / subject_admin) で部屋未割当のとき true。
   * UI に「対象部屋を選択」セレクトを表示し、任意の部屋を採点対象にできる。
   */
  isFlexibleRoom?: boolean
  /** ELEVATED 判定 + subject_admin 用の subjectCode 絞り込みに使う */
  teacherRole?: string
  teacherSubjectCode?: string
  teacherUniversityCode?: string
}

export default function TeacherExamTabs({
  teacherEmail,
  teacherRoomNumber,
  testId,
  isFlexibleRoom = false,
  teacherRole = "general",
  teacherSubjectCode = "",
  teacherUniversityCode = "",
}: TeacherExamTabsProps) {
  const router = useRouter()
  const [tests, setTests] = useState<any[]>([])
  const [selectedTest, setSelectedTest] = useState<any>(null)
  const [assignedStudents, setAssignedStudents] = useState<any[]>([])
  const [activeStudentIndex, setActiveStudentIndex] = useState(0)
  // 2026-07-03 副田さんバグ報告: カテゴリ跨ぎで number=1 が同期していた。
  // key を compositeKey (string "${categoryNumber}-${questionNumber}") に変更。
  const [studentAnswers, setStudentAnswers] = useState<Record<string, Record<string, number>>>({})
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, "present" | "absent" | "pending">>({})
  const [completionStatus, setCompletionStatus] = useState<Record<string, boolean>>({})
  const [editMode, setEditMode] = useState<Record<string, boolean>>({})
  const [questions, setQuestions] = useState<any[]>([])
  const [teacherName, setTeacherName] = useState("")

  // 2026-05-08 ADR-001 §1.2 F4 Phase A.1: 経過時間タイマーを共通フックに
  const elapsedTime = useElapsedTimer()

  // 2026-05-04: フレキシブル部屋モード用 state
  // - isFlexibleRoom=true: pickedRoomNumber は UI から選ばせる (初期値は空)
  // - isFlexibleRoom=false: 既存挙動そのまま、teacherRoomNumber prop を使う
  const [pickedRoomNumber, setPickedRoomNumber] = useState<string>(teacherRoomNumber || "")
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const activeRoomNumber = isFlexibleRoom ? pickedRoomNumber : teacherRoomNumber

  // 2026-07-03 副田さん要望: 教員①のみ出席操作可、教員②以降は読み取り専用
  // 部屋内の教員をメール昇順にソートし、1 番目 (index 0) と自分のメールが一致すれば教員①
  const [isPrimaryTeacher, setIsPrimaryTeacher] = useState(true)

  // Phase 9b-β2b: sessionStorage("loginInfo") parse を useSession() に置換
  const { session, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading || !session) return
    const fetchData = async () => {
      try {
        const universityCode = session.universityCode || ""
        const testSessionId = sessionStorage.getItem("testSessionId") || ""

        const fetchedTeachers = await loadTeachers(universityCode, undefined, testSessionId)
        if (Array.isArray(fetchedTeachers)) {
          const teacher = fetchedTeachers.find((t) => t.email === teacherEmail)
          if (teacher) {
            setTeacherName(teacher.name)
          }
          // 2026-07-03 副田さん要望: 部屋内の教員をメール昇順で 1 番目なら教員①
          // 更新: 管理者ロール (university_admin / subject_admin / master_admin) は
          // 教員①でなくても出席登録/評価編集可能。
          if (activeRoomNumber) {
            const teachersInRoom = fetchedTeachers
              .filter((t) => t.assignedRoomNumber === activeRoomNumber)
              .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
            const first = teachersInRoom[0]
            const isAdminRole =
              teacherRole === "university_admin" ||
              teacherRole === "subject_admin" ||
              teacherRole === "master_admin"
            setIsPrimaryTeacher(
              isAdminRole ||
                !first ||
                (first.email || "").toLowerCase() === (teacherEmail || "").toLowerCase(),
            )
          }
        }

        const fetchedTests = await loadTests()
        setTests(Array.isArray(fetchedTests) ? fetchedTests : [])

        const fetchedStudents = await loadStudents(universityCode, undefined, testSessionId)
        // ADR 2026-05-04: フレキシブルモード時は activeRoomNumber (state) で絞り込む
        const filteredStudents = Array.isArray(fetchedStudents) && activeRoomNumber
          ? fetchedStudents.filter((student) => student.roomNumber === activeRoomNumber)
          : []
        setAssignedStudents(filteredStudents)

        const selectedTest = fetchedTests.find((t) => t.id === testId)
        setSelectedTest(selectedTest)
        if (selectedTest && selectedTest.sheets) {
          // 2026-05-08 ADR-001 §1.2 F4 Phase A.2: flatten ループを共通 utility に
          // (sheet+category+question dedup を維持)
          setQuestions(flattenTestQuestions(selectedTest, { dedupByKey: true }))
        }

        const fetchedAttendanceRecords = await loadAttendanceRecords(universityCode, testSessionId)
        if (Array.isArray(fetchedAttendanceRecords)) {
          setAttendanceStatus(
            fetchedAttendanceRecords.reduce(
              (acc, record) => {
                acc[record.studentId] = record.status
                return acc
              },
              {} as Record<string, "present" | "absent" | "pending">,
            ),
          )
        }

        const fetchedEvaluationResults = await loadEvaluationResults(universityCode, testSessionId)
        if (Array.isArray(fetchedEvaluationResults)) {
          // 2026-05-08 ADR-001 §1.2 F4 Phase A.3: 評価マップ組み立てを共通 utility に
          const maps = buildEvaluationMaps(fetchedEvaluationResults, {
            evaluatorType: "teacher",
            evaluatorEmail: teacherEmail,
          })
          // editMode は teacher 固有の派生 state: completion の逆
          const editByStudent: Record<string, boolean> = {}
          for (const studentId of Object.keys(maps.completion)) {
            editByStudent[studentId] = !maps.completion[studentId]
          }

          setStudentAnswers(maps.answers)
          setCompletionStatus(maps.completion)
          setEditMode(editByStudent)
        }
      } catch (error) {
      }
    }

    fetchData()
  }, [teacherEmail, activeRoomNumber, testId])

  // 2026-05-04: フレキシブル部屋モードのとき、選択肢になる部屋一覧を別途ロード
  // 2026-05-07: testSessionId フィルタを廃止し「自大学の全部屋」を返すようにした。
  //   旧実装は loadRooms(..., testSessionId) で rooms.test_session_id 列で絞り込んでいたが、
  //   現状 rooms は test_session 別に重複行を持つ設計 (ADR-007 C-7 未完了) のため、
  //   新規作成した試験セッションには rooms 行が存在せず候補ゼロになっていた。
  //   UI 表示「自大学の全部屋から選択できます」と齟齬があった。
  useEffect(() => {
    if (!isFlexibleRoom) return
    const loadRoomChoices = async () => {
      try {
        // subject_admin は自教科のみ、university_admin は自大学の全教科
        const subjectScope = teacherRole === "subject_admin" ? teacherSubjectCode : undefined
        const univ = teacherUniversityCode || undefined
        const rooms = await loadRooms(univ, subjectScope)
        setAvailableRooms(Array.isArray(rooms) ? rooms : [])
      } catch (e) {
        console.error("[teacher-exam-tabs] failed to load rooms (flexible mode):", e)
        setAvailableRooms([])
      }
    }
    loadRoomChoices()
  }, [isFlexibleRoom, teacherRole, teacherSubjectCode, teacherUniversityCode])

  // 2026-05-08 ADR-001 §1.2 F4 Phase A.1: getTestSessionId は @/lib/exam/utils から import

  const handleAnswerChange = async (compositeKey: string, optionValue: number | null) => {
    const activeStudent = assignedStudents[activeStudentIndex]
    if (!activeStudent) return

    if (attendanceStatus[activeStudent.id] !== "present") {
      return
    }

    const previousAnswers = studentAnswers
    // 2026-07-03 副田さん要望: value=null は選択解除 (compositeKey を削除)
    const nextForStudent = { ...(studentAnswers[activeStudent.id] || {}) }
    if (optionValue === null) {
      delete nextForStudent[compositeKey]
    } else {
      nextForStudent[compositeKey] = optionValue
    }
    const updatedAnswers: Record<string, Record<string, number>> = {
      ...studentAnswers,
      [activeStudent.id]: nextForStudent,
    }
    setStudentAnswers(updatedAnswers)

    const universityCode = (session?.universityCode || "")
    const testSessionId = getTestSessionId()
    const studentAnswersData: Record<string, number> = updatedAnswers[activeStudent.id] || {}
    const totalScore = Object.values(studentAnswersData).reduce((sum, val) => sum + val, 0)

    // 2026-05-13: 単一問題だけでなく学生の全 answers から hasAlert を再計算
    // (旧コードは「今変更した問題」だけ判定するため、別問題を後から変更すると
    // アラート情報が消える可能性があった)
    const hasAlert = computeHasAlert(studentAnswersData, questions)

    const newEvaluation: EvaluationResult = {
      studentId: activeStudent.id,
      evaluatorId: teacherEmail,
      evaluatorType: "teacher",
      testId,
      roomNumber: activeRoomNumber,
      answers: studentAnswersData,
      totalScore,
      answeredCount: Object.keys(studentAnswersData).length,
      isCompleted: completionStatus[activeStudent.id] || false,
      hasAlert,
      timestamp: new Date().toISOString(),
      universityCode,
      testSessionId,
    }

    try {
      await saveEvaluationResults([newEvaluation])
    } catch (e) {
      // 保存失敗時は UI を巻き戻し、原因をユーザーに通知する(silent fail 防止)
      setStudentAnswers(previousAnswers)
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[teacher-exam-tabs] saveEvaluationResults (answer) failed:", msg)
      alert(`回答の保存に失敗しました。再度お試しください。\n${msg}`)
    }
  }

  const handleAttendanceChange = async (studentId: string, status: "present" | "absent") => {
    const previousStatus = attendanceStatus[studentId]
    setAttendanceStatus((prev) => ({ ...prev, [studentId]: status }))

    const universityCode = (session?.universityCode || "")
    const testSessionId = getTestSessionId()

    const newRecord: AttendanceRecord = {
      studentId,
      status,
      markedBy: teacherEmail,
      markedByType: "teacher",
      roomNumber: activeRoomNumber,
      timestamp: new Date().toISOString(),
      universityCode,
      testSessionId,
    }

    try {
      await saveAttendanceRecords([newRecord])
    } catch (e) {
      // 保存失敗時は UI を巻き戻して、ユーザーに「実際は保存されていない」ことを通知する。
      // (例: 旧 UNIQUE 制約違反などのサーバー側エラーで silent fail していた問題への対策)
      setAttendanceStatus((prev) => {
        const next = { ...prev }
        if (previousStatus) next[studentId] = previousStatus
        else delete next[studentId]
        return next
      })
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[teacher-exam-tabs] saveAttendanceRecords failed:", msg)
      alert(`出欠の保存に失敗しました。再度お試しください。\n${msg}`)
    }
  }

  const handleMarkComplete = async (studentId: string) => {
    const studentAnswersData = studentAnswers[studentId] || {}
    const answeredCount = Object.keys(studentAnswersData).length

    if (answeredCount === questions.length && attendanceStatus[studentId] === "present") {
      const previousCompletion = completionStatus[studentId] || false
      const previousEditMode = editMode[studentId] || false
      setCompletionStatus((prev) => ({ ...prev, [studentId]: true }))
      setEditMode((prev) => ({ ...prev, [studentId]: false }))

      const universityCode = (session?.universityCode || "")
      const testSessionId = getTestSessionId()

      // 2026-05-13: hasAlert を answers + questions から再計算する
      // (旧コードはハードコード false で完了時にアラート情報が消えるバグ)
      const completedResult: EvaluationResult = {
        studentId,
        evaluatorType: "teacher" as const,
        evaluatorId: teacherEmail,
        testId,
        roomNumber: activeRoomNumber,
        totalScore: calculateScoreFor(studentId),
        answers: studentAnswersData,
        answeredCount,
        isCompleted: true,
        hasAlert: computeHasAlert(studentAnswersData, questions),
        timestamp: new Date().toISOString(),
        universityCode,
        testSessionId,
      }

      try {
        await saveEvaluationResults([completedResult])
      } catch (e) {
        // 完了状態が DB に保存されていないなら UI も巻き戻す(silent fail 防止)
        setCompletionStatus((prev) => ({ ...prev, [studentId]: previousCompletion }))
        setEditMode((prev) => ({ ...prev, [studentId]: previousEditMode }))
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[teacher-exam-tabs] saveEvaluationResults (complete) failed:", msg)
        alert(`完了状態の保存に失敗しました。再度お試しください。\n${msg}`)
      }
    } else {
    }
  }

  const handleEnableEdit = (studentId: string) => {
    setEditMode((prev) => ({ ...prev, [studentId]: true }))
    setCompletionStatus((prev) => ({ ...prev, [studentId]: false }))
  }

  // 2026-05-08 ADR-001 §1.2 F4 Phase A.1: 共通 utility に集約
  const calculateScoreFor = (studentId: string): number => calculateScore(studentAnswers[studentId])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const activeStudent = assignedStudents[activeStudentIndex]
  const studentAnswersData = studentAnswers[activeStudent?.id || ""] || {}
  const answeredCount = Object.keys(studentAnswersData).length
  const totalScore = calculateScoreFor(activeStudent?.id || "")
  const isCompleted = completionStatus[activeStudent?.id || ""] || false
  const isEditMode = editMode[activeStudent?.id || ""] || false
  const isInputDisabled = isCompleted && !isEditMode

  // 2026-05-08 ADR-001 §1.2 F4 Phase A.1: グループ化を共通フックに
  const groupedQuestions = useGroupedQuestions(questions)

  const handleFinishEvaluation = async () => {
    router.push("/teacher/results")
  }

  return (
    <div className="space-y-4">
      {isFlexibleRoom && (
        <Card className="mx-4 mt-4 border-blue-200 bg-blue-50/30">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <Label className="text-sm font-medium shrink-0">
              採点対象の部屋:
            </Label>
            <Select value={pickedRoomNumber} onValueChange={setPickedRoomNumber}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="採点する部屋を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.map((r) => (
                  <SelectItem key={r.id} value={r.roomNumber}>
                    {r.roomNumber} - {r.roomName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {teacherRole === "subject_admin"
                ? "(あなたの教科の部屋から選択できます)"
                : "(自大学の全部屋から選択できます)"}
            </span>
          </CardContent>
        </Card>
      )}
      <ExamSessionBanner
        testSessionId={typeof window !== "undefined" ? sessionStorage.getItem("testSessionId") || "" : ""}
        roomNumber={activeRoomNumber}
        subjectCode={selectedTest?.subjectCode}
        universityCode={session?.universityCode}
        elapsedSeconds={elapsedTime}
      />
      <div className="container mx-auto px-4 space-y-4">
      <header className="py-0 px-2 bg-background border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="font-medium">部屋番号:</span> {activeRoomNumber || "(未選択)"}
            </div>
            <div className="text-sm">
              <span className="font-medium">担当教員:</span> {teacherName}
            </div>
            <div className="text-sm">
              <span className="font-medium">時間:</span> {formatTime(elapsedTime)}
            </div>
            {activeStudent && (
              <>
                <div className="text-sm">
                  <span className="font-medium">進捗:</span>{" "}
                  {Object.entries(studentAnswers[activeStudent.id] || {}).filter(([_, answer]) => answer !== null).length}/
                  {questions.length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">合計点:</span> {calculateScoreFor(activeStudent.id)}点
                </div>
              </>
            )}
          </div>
          <Button onClick={handleFinishEvaluation} size="sm" className="h-6 text-sm px-2">
            評価完了
          </Button>
        </div>
      </header>

      <div className="border-b pb-2 pt-3 px-2">
        <div className="text-sm font-semibold mb-2">医学生選択 - 評価する医学生を選択してください</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {assignedStudents.map((student, index) => {
            const attendance = attendanceStatus[student.id] || null
            const isStudentCompleted = completionStatus[student.id] || false
            const studentScore = calculateScoreFor(student.id)
            const studentAnsweredCount = Object.keys(studentAnswers[student.id] || {}).length

            return (
              <div
                key={student.id}
                onClick={() => setActiveStudentIndex(index)}
                className={`flex-shrink-0 w-44 p-2 rounded-lg border-2 cursor-pointer transition-colors ${
                  activeStudentIndex === index
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-primary/50"
                }`}
              >
                {/* 名前（上部） */}
                <div className="font-medium text-sm mb-2 text-center truncate">{student.name}</div>

                {/* 出席、欠席、完了（中段） */}
                <div className="flex gap-1 mb-2">
                  <Button
                    variant={attendance === "present" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs px-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAttendanceChange(student.id, "present")
                    }}
                    disabled={isStudentCompleted || !isPrimaryTeacher}
                    title={!isPrimaryTeacher ? "出席登録は教員①のみが操作できます" : undefined}
                  >
                    出席
                  </Button>
                  <Button
                    variant={attendance === "absent" ? "destructive" : "outline"}
                    size="sm"
                    className={`flex-1 h-7 text-xs px-1 ${
                      attendance === "absent" ? "bg-red-500 hover:bg-red-600 text-white" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAttendanceChange(student.id, "absent")
                    }}
                    disabled={isStudentCompleted || !isPrimaryTeacher}
                    title={!isPrimaryTeacher ? "欠席登録は教員①のみが操作できます" : undefined}
                  >
                    欠席
                  </Button>
                  <div
                    className={`flex-1 h-7 flex items-center justify-center rounded-md text-xs font-medium ${
                      isStudentCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    完了
                  </div>
                </div>

                {/* 得点、進捗（下段） */}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>得点: {studentScore}点</span>
                  <span>
                    進捗: {studentAnsweredCount}/{questions.length}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        {/* Student evaluation header */}
        <div>
          <h2 className="text-lg font-semibold mb-1">{activeStudent?.name}の評価</h2>
          <p className="text-sm text-muted-foreground mb-1">
            {activeStudent?.studentId} - {answeredCount}/{questions.length}回答済み
          </p>
          <p className="text-sm font-medium">テスト: {selectedTest?.title || "評価シート"}</p>
        </div>

        {attendanceStatus[activeStudent?.id || ""] !== "present" && (
          <div className="text-center py-8 space-y-3">
            <div className="text-muted-foreground">出席ボタンを押してから入力してください</div>
            {/*
              既に完了状態なのに attendance が "present" でないという稀な不整合状態
              (例: 過去のサイレント保存失敗) でも UI が詰まないように、編集ボタンを露出する。
              編集を押すと完了が解除され、出席/欠席ボタンが再び有効化される。
            */}
            {isCompleted && (
              <Button onClick={() => handleEnableEdit(activeStudent.id)} variant="outline">
                編集(完了を解除)
              </Button>
            )}
          </div>
        )}

        {attendanceStatus[activeStudent?.id || ""] === "present" && (
          <>
            {/* 2026-05-08 ADR-001 §1.2 F4 Phase B.1: 質問描画は共通コンポーネント */}
            <ExamQuestionsRenderer
              groupedQuestions={groupedQuestions}
              answers={studentAnswersData}
              inputDisabled={isInputDisabled}
              attendancePresent={attendanceStatus[activeStudent.id] === "present"}
              onAnswer={handleAnswerChange}
            />

            <div className="flex gap-3 pt-4 px-4">
              {!isCompleted && (
                <Button
                  onClick={() => handleMarkComplete(activeStudent.id)}
                  disabled={answeredCount !== questions.length || attendanceStatus[activeStudent.id] !== "present"}
                  className="flex-1"
                >
                  入力完了 ({answeredCount}/{questions.length})
                </Button>
              )}
              {isCompleted && (
                <>
                  <Button onClick={() => handleEnableEdit(activeStudent.id)} variant="outline" className="flex-1">
                    編集
                  </Button>
                  <div className="flex-1 flex items-center justify-center bg-muted text-muted-foreground rounded-md px-4 py-2">
                    入力完了済み
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </div>
  )
}
