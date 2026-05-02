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
      // Phase 8: 認証はサーバー側 API で実施(bcrypt 照合 + HttpOnly cookie 発行)
      const res = await fetch("/api/auth/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: teacherId, password }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result?.error || "認証エラーが発生しました")
        setIsLoading(false)
        return
      }

      if (result?.needsSessionSelection && Array.isArray(result.sessions)) {
        const universityCode = result.sessions[0]?.universityCode || "dentshowa"
        const allSessions = await loadTestSessions(universityCode)
        const sessionIds = new Set(result.sessions.map((s: { id: string | null }) => s.id).filter(Boolean))
        const availableSessions = allSessions.filter((s) => sessionIds.has(s.id))

        const placeholder: Teacher[] = result.sessions.map((s: {
          id: string | null
          name: string
          assignedRoomNumber: string | null
          universityCode: string | null
          subjectCode: string | null
        }) => ({
          id: "",
          teacherId: "",
          email: teacherId,
          password: "", // Phase 8: 平文を保持しない
          name: s.name,
          role: "general",
          assignedRoomNumber: s.assignedRoomNumber || "",
          createdAt: new Date().toISOString(),
          universityCode: s.universityCode || "dentshowa",
          subjectCode: s.subjectCode || "",
          testSessionId: s.id || "",
        }))
        setMatchedTeachers(placeholder)
        setSessions(availableSessions)
        setStep("session")
        setIsLoading(false)
        return
      }

      completeLoginFromApi(result)
    } catch (error) {
      setError("ログイン処理中にエラーが発生しました")
      setIsLoading(false)
    }
  }

  const handleSessionSelectViaApi = async (sessionId: string) => {
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: teacherId, password, testSessionId: sessionId }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result?.error || "認証エラーが発生しました")
        setIsLoading(false)
        return
      }
      completeLoginFromApi(result)
    } catch (error) {
      setError("ログイン処理中にエラーが発生しました")
      setIsLoading(false)
    }
  }

  const completeLoginFromApi = (apiResult: {
    teacherId: string
    teacherName: string
    teacherEmail: string
    teacherRole: string
    teacherRoom: string
    universityCode: string
    subjectCode: string
    testSessionId: string
    accountType: string
  }) => {
    sessionStorage.setItem(
      "loginInfo",
      JSON.stringify({
        loginType: "teacher",
        role: apiResult.teacherRole,
        userId: apiResult.teacherId,
        userName: apiResult.teacherName,
        email: apiResult.teacherEmail,
        assignedRoomNumber: apiResult.teacherRoom,
        universityCode: apiResult.universityCode,
        subjectCode: apiResult.subjectCode,
        testSessionId: apiResult.testSessionId,
      }),
    )
    sessionStorage.setItem("teacherId", apiResult.teacherId)
    sessionStorage.setItem("teacherName", apiResult.teacherName)
    sessionStorage.setItem("teacherEmail", apiResult.teacherEmail)
    sessionStorage.setItem("teacherRole", apiResult.teacherRole)
    sessionStorage.setItem("teacherRoom", apiResult.teacherRoom)
    sessionStorage.setItem("universityCode", apiResult.universityCode)
    sessionStorage.setItem("subjectCode", apiResult.subjectCode)
    sessionStorage.setItem("testSessionId", apiResult.testSessionId)
    sessionStorage.setItem("accountType", apiResult.accountType)

    window.location.href = "/teacher/exam-info"
  }

  // 旧 handleSessionSelect/completeLogin は handleSessionSelectViaApi/completeLoginFromApi に統合済み

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
