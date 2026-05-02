"use client"

import type React from "react"
import { loadTestSessions, type Teacher, type TestSession } from "@/lib/data-storage"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserCircle, ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"

/**
 * Phase 9b-β1: 統合 /api/auth/login へ切替。
 * - sessionStorage 書き込みは consumer 互換のため残置(β2 で順次撤去)
 * - 教員以外がここに入ってきた場合は 401 として扱う(form-side gating)
 */

interface UnifiedLoginUser {
  source: "admins" | "teachers" | "patients"
  id: string
  name: string
  email: string
  role: string
  accountType: string
  universityCode: string
  universityCodes: string[]
  subjectCode: string
  testSessionId: string
  assignedRoomNumber: string
}

interface UnifiedLoginResponse {
  user?: UnifiedLoginUser
  redirectTo?: string
  needsSessionSelection?: boolean
  source?: "teachers" | "patients"
  candidates?: Array<{
    source: "teachers" | "patients"
    id: string
    name: string
    assignedRoomNumber: string
    universityCode: string
    subjectCode: string
  }>
  error?: string
}

export function TeacherLoginForm() {
  const router = useRouter()
  const [teacherId, setTeacherId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<"credentials" | "session">("credentials")
  const [matchedTeachers, setMatchedTeachers] = useState<Teacher[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])

  const callUnifiedLogin = async (testSessionId?: string): Promise<UnifiedLoginResponse | null> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: teacherId, password, testSessionId }),
      })
      const result = (await res.json()) as UnifiedLoginResponse
      if (!res.ok) {
        setError(result?.error || "認証エラーが発生しました")
        return null
      }
      return result
    } catch {
      setError("ログイン処理中にエラーが発生しました")
      return null
    }
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!teacherId || !password) {
      setError("IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    const result = await callUnifiedLogin()
    if (!result) {
      setIsLoading(false)
      return
    }

    // 複数セッション持ち
    if (result.needsSessionSelection && result.candidates && result.source === "teachers") {
      const universityCode = result.candidates[0]?.universityCode || "dentshowa"
      const allSessions = await loadTestSessions(universityCode)
      const sessionIds = new Set(result.candidates.map((c) => c.id).filter(Boolean))
      const availableSessions = allSessions.filter((s) => sessionIds.has(s.id))

      const placeholder: Teacher[] = result.candidates.map((c) => ({
        id: "",
        teacherId: "",
        email: teacherId,
        password: "",
        name: c.name,
        role: "general",
        assignedRoomNumber: c.assignedRoomNumber || "",
        createdAt: new Date().toISOString(),
        universityCode: c.universityCode || "dentshowa",
        subjectCode: c.subjectCode || "",
        testSessionId: c.id || "",
      }))
      setMatchedTeachers(placeholder)
      setSessions(availableSessions)
      setStep("session")
      setIsLoading(false)
      return
    }

    if (!result.user) {
      setError("認証エラーが発生しました")
      setIsLoading(false)
      return
    }

    // form-side gating: teacher 以外がここから入ってきた場合は拒否
    if (result.user.source !== "teachers") {
      setError("教員アカウントではありません。正しいログイン画面をご利用ください")
      setIsLoading(false)
      return
    }

    completeLogin(result.user, result.redirectTo)
  }

  const handleSessionSelectViaApi = async (sessionId: string) => {
    setError("")
    setIsLoading(true)
    const result = await callUnifiedLogin(sessionId)
    if (!result || !result.user) {
      setIsLoading(false)
      return
    }
    if (result.user.source !== "teachers") {
      setError("教員アカウントではありません")
      setIsLoading(false)
      return
    }
    completeLogin(result.user, result.redirectTo)
  }

  // β1: sessionStorage 書き込みは consumer 互換のため維持。β2 で撤去予定。
  const completeLogin = (user: UnifiedLoginUser, redirectTo?: string) => {
    sessionStorage.setItem(
      "loginInfo",
      JSON.stringify({
        loginType: "teacher",
        role: user.role,
        userId: user.id,
        userName: user.name,
        email: user.email,
        assignedRoomNumber: user.assignedRoomNumber,
        universityCode: user.universityCode,
        subjectCode: user.subjectCode,
        testSessionId: user.testSessionId,
      }),
    )
    sessionStorage.setItem("teacherId", user.id)
    sessionStorage.setItem("teacherName", user.name)
    sessionStorage.setItem("teacherEmail", user.email)
    sessionStorage.setItem("teacherRole", user.role)
    sessionStorage.setItem("teacherRoom", user.assignedRoomNumber)
    sessionStorage.setItem("universityCode", user.universityCode)
    sessionStorage.setItem("subjectCode", user.subjectCode)
    sessionStorage.setItem("testSessionId", user.testSessionId)
    sessionStorage.setItem("accountType", user.accountType)

    window.location.href = redirectTo || "/teacher/exam-info"
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
              onClick={() => handleSessionSelectViaApi(session.id)}
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
