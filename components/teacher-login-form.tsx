"use client"

import type React from "react"
import { loadTeachers, loadTestSessions, type Teacher, type TestSession } from "@/lib/data-storage"
import { setLoginCookie } from "@/lib/auth/cookie"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserCircle, ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"

export function TeacherLoginForm() {
  const router = useRouter()
  const [teacherId, setTeacherId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  // Session selection state
  const [step, setStep] = useState<"credentials" | "session">("credentials")
  const [matchedTeachers, setMatchedTeachers] = useState<Teacher[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!teacherId || !password) {
      setError("IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    try {
      // Load all teachers (no session filter) to verify credentials
      const teachers = await loadTeachers()

      if (!Array.isArray(teachers)) {
        setError("データの読み込みに失敗しました")
        setIsLoading(false)
        return
      }

      // Find all teacher records matching this email/password (may exist in multiple sessions)
      const matched = teachers.filter((t) => t.email === teacherId && t.password === password)

      if (matched.length === 0) {
        setError("IDまたはパスワードが正しくありません")
        setIsLoading(false)
        return
      }

      // Load available test sessions
      const universityCode = matched[0].universityCode || "dentshowa"
      const allSessions = await loadTestSessions(universityCode)

      // Filter sessions that this teacher is registered for
      const teacherSessionIds = new Set(matched.map((t) => t.testSessionId).filter(Boolean))
      const availableSessions = allSessions.filter((s) => teacherSessionIds.has(s.id))

      if (availableSessions.length === 1) {
        // Only one session - auto-select
        const teacher = matched.find((t) => t.testSessionId === availableSessions[0].id) || matched[0]
        completeLogin(teacher, availableSessions[0].id)
      } else if (availableSessions.length > 1) {
        // Multiple sessions - show selection
        setMatchedTeachers(matched)
        setSessions(availableSessions)
        setStep("session")
        setIsLoading(false)
      } else {
        // No sessions found - fallback with first matched teacher
        completeLogin(matched[0], matched[0].testSessionId || "")
      }
    } catch (error) {
      console.error("[v0] Error during login:", error)
      setError("ログイン処理中にエラーが発生しました")
      setIsLoading(false)
    }
  }

  const handleSessionSelect = (sessionId: string) => {
    const teacher = matchedTeachers.find((t) => t.testSessionId === sessionId) || matchedTeachers[0]
    completeLogin(teacher, sessionId)
  }

  const completeLogin = (teacher: Teacher, testSessionId: string) => {
    const teacherRole = teacher.role as string

    const loginInfo = {
      loginType: "teacher",
      role: teacherRole,
      userId: teacher.id,
      userName: teacher.name,
      email: teacher.email,
      assignedRoomNumber: teacher.assignedRoomNumber || "",
      universityCode: teacher.universityCode || "dentshowa",
      subjectCode: teacher.subjectCode || "",
      testSessionId,
    }

    sessionStorage.setItem("loginInfo", JSON.stringify(loginInfo))
    sessionStorage.setItem("teacherId", teacher.id)
    sessionStorage.setItem("teacherName", teacher.name)
    sessionStorage.setItem("teacherEmail", teacher.email)
    sessionStorage.setItem("teacherRole", teacherRole)
    sessionStorage.setItem("teacherRoom", teacher.assignedRoomNumber || "")
    sessionStorage.setItem("universityCode", teacher.universityCode || "dentshowa")
    sessionStorage.setItem("subjectCode", teacher.subjectCode || "")
    sessionStorage.setItem("testSessionId", testSessionId)
    const accountTypeMap: Record<string, string> = {
      master_admin: "special_master",
      university_admin: "university_master",
      subject_admin: "subject_admin",
      general: "general",
    }
    sessionStorage.setItem("accountType", accountTypeMap[teacherRole] || "general")

    // middleware が認可判定に使う Cookie も書く(Phase 7)
    setLoginCookie({
      loginType: "teacher",
      role: teacherRole,
      userId: teacher.id,
      userName: teacher.name,
      universityCode: teacher.universityCode || "dentshowa",
      subjectCode: teacher.subjectCode || "",
    })

    window.location.href = "/teacher/exam-info"
  }

  if (step === "session") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">試験の選択</CardTitle>
          <CardDescription className="text-center">参加する試験を選択してください</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.map((session) => (
            <Button
              key={session.id}
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={() => handleSessionSelect(session.id)}
            >
              <div className="text-left">
                <div className="font-medium">{session.description || "(名称未設定)"}</div>
                <div className="text-sm text-muted-foreground">{session.testDate}</div>
              </div>
            </Button>
          ))}
          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => { setStep("credentials"); setError("") }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
          <UserCircle className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">教員ログイン</CardTitle>
        <CardDescription className="text-center">IDとパスワードを入力してください</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="teacherId">ID</Label>
            <Input
              id="teacherId"
              type="text"
              placeholder="メールアドレスまたはID"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
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

          <div className="text-center space-y-2 pt-2">
            <Link href="/reset-password" className="text-sm text-primary hover:underline">
              パスワードを忘れた方はこちら
            </Link>
          </div>

          <div className="text-center pt-2">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              ← トップページに戻る
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
