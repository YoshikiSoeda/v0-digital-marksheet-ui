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
import { Shield, Calendar, ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { loadTeachers, loadSubjects, type Subject } from "@/lib/data-storage"

interface SessionData {
  id: string
  test_code: string
  test_date: string
  description: string
  university_code: string
  subject_code: string | null
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

  // New test session creation state
  const [newTestCode, setNewTestCode] = useState("")
  const [newTestDate, setNewTestDate] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newUniversityCode, setNewUniversityCode] = useState("")
  const [newSubjectCode, setNewSubjectCode] = useState("")
  const [createError, setCreateError] = useState("")
  const [isCreating, setIsCreating] = useState(false)

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
      console.error("[v0] Error loading filter data:", err)
    }
  }, [])

  // Filtered sessions
  const filteredSessions = allSessions.filter((s) => {
    // non-master: restrict to their own university
    if (authRole !== "master_admin" && authUniversityCode && s.university_code !== authUniversityCode) return false
    // subject_admin: show ALL sessions linked to their assigned subject (no other filters)
    if (authRole === "subject_admin" && authSubjectCode) {
      return s.subject_code === authSubjectCode
    }
    // master_admin / university_admin: apply dropdown filters
    if (filterUniversity !== "all" && s.university_code !== filterUniversity) return false
    if (filterSubject !== "all" && s.subject_code !== filterSubject) return false
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
      await loadFilterData(role, universityCode, subjectCode)
      setStep("session")
      setIsLoading(false)
    }

    // 1. admin,admin でマスター管理者ログイン
    if (adminId === "admin" && password === "admin") {
      const supabase = createClient()
      const { data: admins } = await supabase
        .from("admins")
        .select("*")
        .eq("role", "master_admin")
        .limit(1)

      const admin = admins?.[0]
      if (admin) {
        const universityCodes = admin.university_codes || ["dentshowa"]
        const loginData: Record<string, string> = {
          loginInfo: JSON.stringify({
            loginType: "admin",
            role: "master_admin",
            userId: admin.id,
            userName: admin.name,
            universityCodes,
          }),
          userRole: "admin",
          userId: admin.id,
          userName: admin.name,
          universityCodes: JSON.stringify(universityCodes),
          accountType: "special_master",
          teacherRole: "master_admin",
        }

        await showSessionStep(loginData, "master_admin", universityCodes[0], "")
        return
      }
    }

    // 2. adminsテーブルから検索
    const supabase = createClient()
    const emailToCheck = adminId === "ediand" ? "ediand@system.local" : adminId

    const { data: admin } = await supabase
      .from("admins")
      .select("*")
      .eq("email", emailToCheck)
      .eq("password", password)
      .single()

    if (admin) {
      const role = admin.role || "master_admin"
      const accountTypeMap: Record<string, string> = {
        master_admin: "special_master",
        university_admin: "university_master",
      }
      const universityCodes = admin.university_codes || ["dentshowa"]

      const loginData: Record<string, string> = {
        loginInfo: JSON.stringify({
          loginType: "admin",
          role,
          userId: admin.id,
          userName: admin.name,
          universityCodes,
        }),
        userRole: "admin",
        userId: admin.id,
        userName: admin.name,
        universityCodes: JSON.stringify(universityCodes),
        accountType: accountTypeMap[role] || "admin",
        teacherRole: role,
      }

      await showSessionStep(loginData, role, universityCodes[0], "")
      return
    }

    // 3. teachersテーブルからuniversity_admin以上を検索
    try {
      const teachers = await loadTeachers()
      const teacher = teachers.find(
        (t) => t.email === adminId && t.password === password &&
               (t.role === "university_admin" || t.role === "master_admin" || t.role === "subject_admin")
      )

      if (teacher) {
        const teacherRole = teacher.role as string
        const accountTypeMap: Record<string, string> = {
          master_admin: "special_master",
          university_admin: "university_master",
          subject_admin: "subject_admin",
        }

        const loginData: Record<string, string> = {
          loginInfo: JSON.stringify({
            loginType: "teacher_admin",
            role: teacherRole,
            userId: teacher.id,
            userName: teacher.name,
            email: teacher.email,
            universityCode: teacher.universityCode || "dentshowa",
            subjectCode: teacher.subjectCode || "",
          }),
          userRole: "admin",
          userId: teacher.id,
          userName: teacher.name,
          teacherId: teacher.id,
          teacherName: teacher.name,
          teacherEmail: teacher.email,
          teacherRole,
          teacherRoom: teacher.assignedRoomNumber || "",
          universityCode: teacher.universityCode || "dentshowa",
          universityCodes: JSON.stringify([teacher.universityCode || "dentshowa"]),
          subjectCode: teacher.subjectCode || "",
          accountType: accountTypeMap[teacherRole] || "admin",
        }

        await showSessionStep(loginData, teacherRole, teacher.universityCode || "dentshowa", teacher.subjectCode || "")
        return
      }
    } catch (err) {
      console.error("[v0] Error checking teachers:", err)
    }

    setError("管理者IDまたはパスワードが正しくありません")
    setIsLoading(false)
  }

  const handleSessionSelect = (sessionId: string) => {
    for (const [key, value] of Object.entries(pendingLoginInfo)) {
      sessionStorage.setItem(key, value)
    }
    sessionStorage.setItem("testSessionId", sessionId)
    window.location.href = "/admin/dashboard"
  }

  const handleCreateSession = async () => {
    setCreateError("")
    if (!newTestCode || !newTestDate || !newDescription) {
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
          test_code: newTestCode,
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
      setNewTestCode("")
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
          <CardTitle className="text-2xl text-center">新規テストコード作成</CardTitle>
          <CardDescription className="text-center">新しい試験セッションを登録します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {createError && (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>テストコード <span className="text-destructive">*</span></Label>
            <Input
              placeholder="例: 2026-07-OSCE"
              value={newTestCode}
              onChange={(e) => setNewTestCode(e.target.value)}
            />
          </div>

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
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">試験セッション選択</CardTitle>
          <CardDescription className="text-center">
            {roleLabel}としてログイン中 - 管理する試験を選択してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3">
            {/* University filter: master_admin only */}
            {authRole === "master_admin" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">大学で絞り込み</Label>
                <Select value={filterUniversity} onValueChange={setFilterUniversity}>
                  <SelectTrigger>
                    <SelectValue placeholder="大学を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての大学</SelectItem>
                    {universities.map((u) => (
                      <SelectItem key={u.university_code} value={u.university_code}>
                        {u.university_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Subject filter: master_admin and university_admin */}
            {(authRole === "master_admin" || authRole === "university_admin") && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">教科で絞り込み</Label>
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="教科を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての教科</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.subjectCode} value={s.subjectCode}>
                        {s.subjectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Subject info for subject_admin */}
            {authRole === "subject_admin" && authSubjectCode && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-xs text-blue-600 font-medium">担当教科</p>
                <p className="text-sm font-bold text-blue-900">
                  {subjects.find((s) => s.subjectCode === authSubjectCode)?.subjectName || authSubjectCode}
                </p>
              </div>
            )}
          </div>

          {/* Session list */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {filteredSessions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                該当する試験セッションがありません
              </p>
            ) : (
              filteredSessions.map((session) => {
                const subjectName = subjects.find((s) => s.subjectCode === session.subject_code)?.subjectName
                const uniName = universities.find((u) => u.university_code === session.university_code)?.university_name
                return (
                  <Button
                    key={session.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4"
                    onClick={() => handleSessionSelect(session.id)}
                  >
                    <div className="text-left w-full">
                      <div className="font-medium">{session.description || session.test_code}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span>{session.test_date}</span>
                        <span className="font-mono">{session.test_code}</span>
                        {uniName && <span>{uniName}</span>}
                        {subjectName && <span>{subjectName}</span>}
                      </div>
                    </div>
                  </Button>
                )
              })
            )}
          </div>

          {/* New test code button: master_admin and university_admin */}
          {(authRole === "master_admin" || authRole === "university_admin") && (
            <Button
              variant="default"
              className="w-full"
              onClick={() => {
                setNewUniversityCode(authRole !== "master_admin" ? authUniversityCode : "")
                setStep("create")
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              テストコード新規作成
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => { setStep("credentials"); setError(""); setFilterUniversity("all"); setFilterSubject("all") }}
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
