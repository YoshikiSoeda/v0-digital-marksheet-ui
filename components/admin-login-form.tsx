"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Shield, Calendar, ArrowLeft, Plus, ChevronRight, Filter } from "lucide-react"
import Link from "next/link"
import { loadTeachers, loadSubjects, type Subject } from "@/lib/data-storage"

interface SessionData {
  id: string
  test_date: string
  description: string
  university_code: string
  subject_code: string | null
  status: string
  created_at: string
}

interface UniversityData {
  id: string
  university_code: string
  university_name: string
}

export function AdminLoginForm() {
  const router = useRouter()
  const [adminId, setAdminId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Session selection state
  const [step, setStep] = useState<"credentials" | "session" | "create">("credentials")
  const [pendingLoginInfo, setPendingLoginInfo] = useState<Record<string, string>>({})
  const [authRole, setAuthRole] = useState("") // master_admin, university_admin, subject_admin
  const [authSubjectCode, setAuthSubjectCode] = useState("") // for subject_admin
  const [authUniversityCode, setAuthUniversityCode] = useState("") // for university/subject admin

  // Filter state
  const [universities, setUniversities] = useState<UniversityData[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [allSessions, setAllSessions] = useState<SessionData[]>([])
  const [filterUniversity, setFilterUniversity] = useState<string>("all")
  const [filterSubject, setFilterSubject] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterTestDate, setFilterTestDate] = useState<string>("")
  const [filterCreatedDate, setFilterCreatedDate] = useState<string>("")

  // New test session creation state

  const [newTestDate, setNewTestDate] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newUniversityCode, setNewUniversityCode] = useState("")
  const [newSubjectCode, setNewSubjectCode] = useState("")
  const [createError, setCreateError] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Auto-skip to session step if already authenticated (e.g. coming back from dashboard)
  useEffect(() => {
    const loginInfo = sessionStorage.getItem("loginInfo")
    const role = sessionStorage.getItem("role") || ""
    const universityCode = sessionStorage.getItem("universityCode") || ""
    const subjectCode = sessionStorage.getItem("subjectCode") || ""
    if (loginInfo && role) {
      setAuthRole(role)
      setAuthUniversityCode(universityCode)
      setAuthSubjectCode(subjectCode)
      loadFilterData(role, universityCode, subjectCode)
      setStep("session")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load filter data when entering session step
  const loadFilterData = useCallback(async (role: string, universityCode: string, subjectCode: string) => {
    try {
      // Load universities (master_admin only)
      if (role === "master_admin") {
        const res = await fetch("/api/universities")
        if (res.ok) {
          const data = await res.json()
          setUniversities(Array.isArray(data) ? data : [])
        }
      }

      // Load subjects
      const loadedSubjects = await loadSubjects(role === "master_admin" ? undefined : universityCode)
      setSubjects(loadedSubjects)

      // Load all sessions
      const sessionsRes = await fetch("/api/test-sessions")
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json()
        setAllSessions(Array.isArray(sessionsData) ? sessionsData : [])
      }

      // Pre-set filter for subject_admin
      if (role === "subject_admin" && subjectCode) {
        setFilterSubject(subjectCode)
      }
      // Pre-set university filter for non-master
      if (role !== "master_admin" && universityCode) {
        setFilterUniversity(universityCode)
      }
    } catch (err) {
    }
  }, [])

  // Helper: check if two subject codes match, handling university prefix format
  // e.g. "dentshowa_GENERAL" should match "GENERAL" and vice versa
  const subjectCodeMatches = (code1: string, code2: string): boolean => {
    if (!code1 || !code2) return false
    if (code1 === code2) return true
    // Strip university prefix (e.g. "dentshowa_GENERAL" -> "GENERAL")
    const base1 = code1.includes("_") ? code1.split("_").slice(1).join("_") : code1
    const base2 = code2.includes("_") ? code2.split("_").slice(1).join("_") : code2
    return base1 === base2 || code1 === base2 || base1 === code2
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "not_started": return "未実施"
      case "in_progress": return "実施中"
      case "completed": return "テスト終了"
      default: return status || "未実施"
    }
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": return "destructive"
      case "in_progress": return "default"
      default: return "outline"
    }
  }

  // Filtered sessions
  const filteredSessions = allSessions.filter((s) => {
    // non-master: restrict to their own university
    if (authRole !== "master_admin" && authUniversityCode && s.university_code !== authUniversityCode) return false
    // subject_admin: show ALL sessions linked to their assigned subject (no other filters except status/date)
    if (authRole === "subject_admin" && authSubjectCode) {
      if (!(s.subject_code && subjectCodeMatches(s.subject_code, authSubjectCode))) return false
    } else {
      // master_admin / university_admin: apply dropdown filters
      if (filterUniversity !== "all" && s.university_code !== filterUniversity) return false
      if (filterSubject !== "all" && s.subject_code ? !subjectCodeMatches(s.subject_code, filterSubject) : filterSubject !== "all") return false
    }
    // Status filter
    if (filterStatus !== "all" && (s.status || "not_started") !== filterStatus) return false
    // Test date filter
    if (filterTestDate) {
      const sessionDate = s.test_date ? s.test_date.split("T")[0] : ""
      if (sessionDate !== filterTestDate) return false
    }
    // Created date filter
    if (filterCreatedDate) {
      const createdDate = s.created_at ? s.created_at.split("T")[0] : ""
      if (createdDate !== filterCreatedDate) return false
    }
    return true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!adminId || !password) {
      setError("管理者IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    const showSessionStep = async (loginData: Record<string, string>, role: string, universityCode: string, subjectCode: string) => {
      setPendingLoginInfo(loginData)
      setAuthRole(role)
      setAuthUniversityCode(universityCode)
      setAuthSubjectCode(subjectCode)
      // Phase 8: HttpOnly cookie は /api/auth/admin/login で既に発行済みなので
      // ここでは追加 cookie 操作不要。loadFilterData の /api/* 呼び出しに認可情報が乗る。
      await loadFilterData(role, universityCode, subjectCode)
      setStep("session")
      setIsLoading(false)
    }

    // Phase 8: 認証は /api/auth/admin/login に集約(bcrypt 照合 + HttpOnly cookie)
    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, password }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result?.error || "管理者IDまたはパスワードが正しくありません")
        setIsLoading(false)
        return
      }

      // API レスポンスを既存 showSessionStep が期待する loginData 形式へマッピング
      const isFromTeachers = result?.source === "teachers"
      const role: string = result?.role || "master_admin"
      const universityCodes: string[] = result?.universityCodes || ["dentshowa"]
      const universityCode: string = result?.universityCode || universityCodes[0] || "dentshowa"
      const subjectCode: string = result?.subjectCode || ""
      const accountType: string = result?.accountType || "admin"

      const loginData: Record<string, string> = isFromTeachers
        ? {
            loginInfo: JSON.stringify({
              loginType: "teacher_admin",
              role,
              userId: result.userId,
              userName: result.userName,
              email: result.teacherEmail || "",
              universityCode,
              subjectCode,
            }),
            userRole: "admin",
            userId: result.userId,
            userName: result.userName,
            teacherId: result.userId,
            teacherName: result.userName,
            teacherEmail: result.teacherEmail || "",
            teacherRole: role,
            teacherRoom: result.teacherRoom || "",
            universityCode,
            universityCodes: JSON.stringify([universityCode]),
            subjectCode,
            accountType,
          }
        : {
            loginInfo: JSON.stringify({
              loginType: "admin",
              role,
              userId: result.userId,
              userName: result.userName,
              universityCodes,
            }),
            userRole: "admin",
            userId: result.userId,
            userName: result.userName,
            universityCodes: JSON.stringify(universityCodes),
            accountType,
            teacherRole: role,
          }

      await showSessionStep(loginData, role, universityCode, subjectCode)
      return
    } catch (err) {
      console.error("[admin-login] error:", err)
      setError("ログイン処理中にエラーが発生しました")
      setIsLoading(false)
      return
    }
    setIsLoading(false)
  }

  const handleSessionSelect = (sessionId: string) => {
    for (const [key, value] of Object.entries(pendingLoginInfo)) {
      sessionStorage.setItem(key, value)
    }
    sessionStorage.setItem("testSessionId", sessionId)
    // Phase 8: HttpOnly cookie は API 側で発行済みのため不要
    window.location.href = "/admin/dashboard"
  }

  const handleCreateSession = async () => {
    setCreateError("")
    if (!newTestDate || !newDescription) {
      setCreateError("全ての必須項目を入力してください")
      return
    }

    const universityCode = authRole === "master_admin" ? newUniversityCode : authUniversityCode
    if (!universityCode) {
      setCreateError("大学を選択してください")
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch("/api/test-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_date: newTestDate,
          description: newDescription,
          university_code: universityCode,
          subject_code: newSubjectCode || (authRole === "subject_admin" ? authSubjectCode : null),
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setCreateError(errData.error || "作成に失敗しました")
        setIsCreating(false)
        return
      }

      const created = await res.json()
      // Refresh sessions
      setAllSessions((prev) => [created, ...prev])
      // Reset form
      setNewTestDate("")
      setNewDescription("")
      setNewUniversityCode("")
      setNewSubjectCode("")
      setStep("session")
    } catch (err) {
      setCreateError("作成中にエラーが発生しました")
    } finally {
      setIsCreating(false)
    }
  }

  // --- Create test session form ---
  if (step === "create") {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">新規テスト作成</CardTitle>
          <CardDescription className="text-center">新しいテストを登録します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {createError && (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>テスト名 <span className="text-destructive">*</span></Label>
            <Input
              placeholder="例: 2026年7月 OSCE本試験"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>実施日 <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={newTestDate}
              onChange={(e) => setNewTestDate(e.target.value)}
            />
          </div>

          {authRole === "master_admin" && (
            <div className="space-y-2">
              <Label>大学 <span className="text-destructive">*</span></Label>
              <Select value={newUniversityCode} onValueChange={setNewUniversityCode}>
                <SelectTrigger>
                  <SelectValue placeholder="大学を選択" />
                </SelectTrigger>
                <SelectContent>
                  {universities.map((u) => (
                    <SelectItem key={u.university_code} value={u.university_code}>
                      {u.university_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {authRole !== "subject_admin" && (
            <div className="space-y-2">
              <Label>教科（任意）</Label>
              <Select value={newSubjectCode || "none"} onValueChange={(v) => setNewSubjectCode(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="教科を選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">指定なし</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.subjectCode} value={s.subjectCode}>
                      {s.subjectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setStep("session"); setCreateError("") }}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateSession}
              disabled={isCreating}
            >
              {isCreating ? "作成中..." : "作成"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // --- Session selection ---
  if (step === "session") {
    const roleLabel = authRole === "master_admin" ? "マスター管理者"
      : authRole === "university_admin" ? "大学管理者"
      : "教科管理者"

    return (
      <Card className="w-full max-w-4xl">
        <CardHeader className="space-y-2 py-4">
          <CardTitle className="text-2xl text-center">試験の選択</CardTitle>
          <CardDescription className="text-center">
            {roleLabel}としてログイン中 - 管理する試験を選択してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter panel */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

                {/* University filter: master_admin only */}
                {authRole === "master_admin" && (
                  <Select value={filterUniversity} onValueChange={setFilterUniversity}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="大学" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全ての大学</SelectItem>
                      {universities.map((u) => (
                        <SelectItem key={u.university_code} value={u.university_code}>
                          {u.university_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Subject filter */}
                <Select
                  value={authRole === "subject_admin" ? authSubjectCode : filterSubject}
                  onValueChange={setFilterSubject}
                  disabled={authRole === "subject_admin"}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="教科" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全ての教科</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.subjectCode} value={s.subjectCode}>
                        {s.subjectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status filter */}
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

                {/* Test date filter */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">実施日:</span>
                  <Input
                    type="date"
                    value={filterTestDate}
                    onChange={(e) => setFilterTestDate(e.target.value)}
                    className="w-[140px] h-8 text-xs"
                  />
                </div>

                {/* Created date filter */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">作成日:</span>
                  <Input
                    type="date"
                    value={filterCreatedDate}
                    onChange={(e) => setFilterCreatedDate(e.target.value)}
                    className="w-[140px] h-8 text-xs"
                  />
                </div>

                {(filterUniversity !== "all" || filterSubject !== "all" || filterStatus !== "all" || filterTestDate || filterCreatedDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      if (authRole === "master_admin") setFilterUniversity("all")
                      if (authRole !== "subject_admin") setFilterSubject("all")
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
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs text-muted-foreground sticky top-0">
                      <th className="text-left py-2 px-3 font-medium">実施日</th>
                      <th className="text-left py-2 px-3 font-medium">テスト名</th>
                      <th className="text-left py-2 px-3 font-medium">ステータス</th>
                      <th className="text-left py-2 px-3 font-medium">教科名</th>
                      {authRole === "master_admin" && (
                        <th className="text-left py-2 px-3 font-medium">大学</th>
                      )}
                      <th className="text-left py-2 px-3 font-medium">作成日</th>
                      <th className="py-2 px-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={authRole === "master_admin" ? 7 : 6} className="text-center text-sm text-muted-foreground py-6">
                          該当する試験がありません
                        </td>
                      </tr>
                    ) : (
                      [...filteredSessions].sort((a, b) => {
                        const dateA = a.test_date ? new Date(a.test_date).getTime() : 0
                        const dateB = b.test_date ? new Date(b.test_date).getTime() : 0
                        return dateB - dateA
                      }).map((session) => {
                        const sessionSubjectName = subjects.find((s) => s.subjectCode === session.subject_code)?.subjectName
                        const uniName = universities.find((u) => u.university_code === session.university_code)?.university_name
                        const status = session.status || "not_started"
                        return (
                          <tr
                            key={session.id}
                            className="border-b last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => handleSessionSelect(session.id)}
                          >
                            <td className="py-2 px-3 text-sm font-medium whitespace-nowrap">
                              {session.test_date ? new Date(session.test_date).toLocaleDateString("ja-JP") : "-"}
                            </td>
                            <td className="py-2 px-3 text-sm font-semibold text-primary">
                              {session.description || "(名称未設定)"}
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant={getStatusVariant(status)} className="text-xs">
                                {getStatusLabel(status)}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-sm text-muted-foreground">
                              {sessionSubjectName || "-"}
                            </td>
                            {authRole === "master_admin" && (
                              <td className="py-2 px-3 text-sm text-muted-foreground">
                                {uniName || session.university_code}
                              </td>
                            )}
                            <td className="py-2 px-3 text-sm text-muted-foreground whitespace-nowrap">
                              {session.created_at ? new Date(session.created_at).toLocaleDateString("ja-JP") : "-"}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Button size="sm" variant="default" className="h-7 text-xs px-3">
                                選択
                                <ChevronRight className="w-3 h-3 ml-1" />
                              </Button>
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

          {/* New test code button: master_admin, university_admin, subject_admin */}
          {(authRole === "master_admin" || authRole === "university_admin" || authRole === "subject_admin") && (
            <Button
              variant="default"
              className="w-full"
              onClick={() => {
                setNewUniversityCode(authRole !== "master_admin" ? authUniversityCode : "")
                setStep("create")
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              新規テスト作成
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => { setStep("credentials"); setError(""); setFilterUniversity("all"); setFilterSubject("all"); setFilterStatus("all"); setFilterTestDate(""); setFilterCreatedDate("") }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ログイン画面に戻る
          </Button>
        </CardContent>
      </Card>
    )
  }

  // --- Credentials form ---
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">管理者ログイン</CardTitle>
        <CardDescription className="text-center">管理者アカウントでログインしてください</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="adminId">管理者ID / メールアドレス</Label>
            <Input
              id="adminId"
              type="text"
              placeholder="例: ediand または admin@example.com"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "ログイン中..." : "ログイン"}
          </Button>

          <div className="text-center pt-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              ← トップページに戻る
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
