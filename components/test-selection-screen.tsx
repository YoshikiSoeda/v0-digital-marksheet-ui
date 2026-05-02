"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronRight, Shield, Filter, AlertTriangle } from "lucide-react"
import { loadTests, loadTestSessions, type Test, type TestSession, type TestSessionStatus } from "@/lib/data-storage"
import { useSession } from "@/lib/auth/use-session"
import Link from "next/link"

interface TestSelectionScreenProps {
  examPath: string
  userType: "teacher" | "patient"
}

interface SubjectInfo {
  subject_code: string
  subject_name: string
}

export function TestSelectionScreen({ examPath, userType }: TestSelectionScreenProps) {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [testSessions, setTestSessions] = useState<TestSession[]>([])
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  const [teacherRole, setTeacherRole] = useState<string>("")
  const [teacherSubjectCode, setTeacherSubjectCode] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [noTestMessage, setNoTestMessage] = useState<string>("")

  // Filters
  const [filterSubject, setFilterSubject] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterTestDate, setFilterTestDate] = useState<string>("")
  const [filterCreatedDate, setFilterCreatedDate] = useState<string>("")

  // Phase 9b-β2b: sessionStorage 認可キーを useSession() 経由に置換
  const { session, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading) return
    if (!session) return

    let subjectCode = ""
    if (userType === "teacher") {
      const role = session.role || "general"
      setTeacherRole(role)
      subjectCode = session.subjectCode || ""
      setTeacherSubjectCode(subjectCode)
      if (subjectCode) {
        setFilterSubject(subjectCode)
      }
    }

    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch subjects
        try {
          const subjectsRes = await fetch("/api/subjects")
          if (subjectsRes.ok) {
            const subjectsData = await subjectsRes.json()
            setSubjects(subjectsData)
          }
        } catch (err) {
        }

        // Fetch test sessions
        const universityCode = session.universityCode || undefined
        try {
          const sessions = await loadTestSessions(universityCode)
          setTestSessions(sessions)
        } catch (err) {
        }

        // Fetch all tests (no subject filter, to check per-session availability)
        const fetchedTests = await loadTests(universityCode)
        if (Array.isArray(fetchedTests)) {
          setTests(fetchedTests)
        } else {
          setTests([])
        }
      } catch (error) {
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [userType, session, isSessionLoading])

  const getStatusLabel = (status: TestSessionStatus) => {
    switch (status) {
      case "not_started": return "未実施"
      case "in_progress": return "実施中"
      case "completed": return "テスト終了"
      default: return status
    }
  }

  const getStatusVariant = (status: TestSessionStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": return "destructive"
      case "in_progress": return "default"
      default: return "outline"
    }
  }

  const getSubjectNameByCode = (code?: string): string => {
    if (!code) return "-"
    const matched = subjects.find((s) => s.subject_code === code)
    return matched?.subject_name || code
  }

  // Get unique subject codes from sessions for filter
  const availableSubjects = useMemo(() => {
    const codes = new Set<string>()
    testSessions.forEach((s) => { if (s.subjectCode) codes.add(s.subjectCode) })
    return Array.from(codes)
  }, [testSessions])

  // Is subject filter locked (teacher with specific subject)
  const isSubjectLocked = userType === "teacher" && teacherSubjectCode !== ""

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return testSessions.filter((session) => {
      // Subject filter
      if (filterSubject !== "all" && session.subjectCode !== filterSubject) return false
      // Status filter
      if (filterStatus !== "all" && session.status !== filterStatus) return false
      // Test date filter
      if (filterTestDate) {
        const sessionDate = session.testDate ? session.testDate.split("T")[0] : ""
        if (sessionDate !== filterTestDate) return false
      }
      // Created date filter
      if (filterCreatedDate) {
        const createdDate = session.createdAt ? session.createdAt.split("T")[0] : ""
        if (createdDate !== filterCreatedDate) return false
      }
      return true
    }).sort((a, b) => {
      const dateA = a.testDate ? new Date(a.testDate).getTime() : 0
      const dateB = b.testDate ? new Date(b.testDate).getTime() : 0
      return dateB - dateA
    })
  }, [testSessions, filterSubject, filterStatus, filterTestDate, filterCreatedDate])

  // Find matching test for a session
  const findTestForSession = (sessionId: string): Test | undefined => {
    const expectedRoleType = userType === "patient" ? "patient" : "teacher"
    return tests.find(
      (t) => t.testSessionId === sessionId && (t.roleType || "teacher") === expectedRoleType
    )
  }

  const handleSelectSession = (sessionId: string) => {
    const matchingTest = findTestForSession(sessionId)
    if (!matchingTest) {
      const roleLabel = userType === "teacher" ? "教員用" : "患者用"
      setNoTestMessage(`このセッションには${roleLabel}テストが登録されていません。管理者にお問い合わせください。`)
      setTimeout(() => setNoTestMessage(""), 4000)
      return
    }
    sessionStorage.setItem(`${userType}_selected_test`, matchingTest.id)
    sessionStorage.setItem("testSessionId", sessionId)
    router.push(examPath)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (testSessions.length === 0) {
    return (
      <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">テストセッションが登録されていません</CardTitle>
              <CardDescription className="text-center">
                管理者にテストセッションの登録を依頼してください
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button variant="outline" onClick={() => router.push("/")}>
                トップページに戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">評価テスト選択</h1>
            <p className="text-sm text-muted-foreground mt-1">実施するテストセッションを選択してください</p>
          </div>
          {userType === "teacher" && teacherRole !== "general" && teacherRole !== "" && (
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm" className="flex items-center gap-2 border-blue-500 text-blue-700 hover:bg-blue-50">
                <Shield className="w-4 h-4" />
                管理画面
              </Button>
            </Link>
          )}
        </div>

        {/* Alert message */}
        {noTestMessage && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {noTestMessage}
          </div>
        )}

        {/* Filter panel */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={filterSubject} onValueChange={setFilterSubject} disabled={isSubjectLocked}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="教科" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全ての教科</SelectItem>
                  {availableSubjects.map((code) => (
                    <SelectItem key={code} value={code}>
                      {getSubjectNameByCode(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="ステータス" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全てのステータス</SelectItem>
                  <SelectItem value="not_started">未実施</SelectItem>
                  <SelectItem value="in_progress">実施中</SelectItem>
                  <SelectItem value="completed">テスト終了</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">実施日:</span>
                <Input
                  type="date"
                  value={filterTestDate}
                  onChange={(e) => setFilterTestDate(e.target.value)}
                  className="w-[140px] h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">作成日:</span>
                <Input
                  type="date"
                  value={filterCreatedDate}
                  onChange={(e) => setFilterCreatedDate(e.target.value)}
                  className="w-[140px] h-8 text-xs"
                />
              </div>

              {(filterSubject !== "all" || filterStatus !== "all" || filterTestDate || filterCreatedDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (!isSubjectLocked) setFilterSubject("all")
                    setFilterStatus("all")
                    setFilterTestDate("")
                    setFilterCreatedDate("")
                  }}
                >
                  リセット
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Session table */}
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground sticky top-0">
                    <th className="text-left py-2 px-3 font-medium">実施日</th>
                    <th className="text-left py-2 px-3 font-medium">テスト名</th>
                    <th className="text-left py-2 px-3 font-medium">ステータス</th>
                    <th className="text-left py-2 px-3 font-medium">教科名</th>
                    <th className="text-left py-2 px-3 font-medium">作成日</th>
                    <th className="py-2 px-3 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        該当するテストセッションがありません
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => {
                      const hasTest = !!findTestForSession(session.id)
                      return (
                        <tr
                          key={session.id}
                          className={`border-b last:border-b-0 transition-colors cursor-pointer ${
                            hasTest ? "hover:bg-accent/50" : "hover:bg-accent/30 opacity-70"
                          }`}
                          onClick={() => handleSelectSession(session.id)}
                        >
                          <td className="py-2 px-3 text-sm font-medium whitespace-nowrap">
                            {session.testDate ? new Date(session.testDate).toLocaleDateString("ja-JP") : "-"}
                          </td>
                          <td className="py-2 px-3 text-sm font-semibold text-primary">
                            {session.description || "(名称未設定)"}
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant={getStatusVariant(session.status)} className="text-xs">
                              {getStatusLabel(session.status)}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-sm text-muted-foreground">
                            {getSubjectNameByCode(session.subjectCode)}
                          </td>
                          <td className="py-2 px-3 text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(session.createdAt).toLocaleDateString("ja-JP")}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {hasTest ? (
                              <Button size="sm" variant="default" className="h-7 text-xs px-3">
                                選択
                                <ChevronRight className="w-3 h-3 ml-1" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">未登録</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
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
