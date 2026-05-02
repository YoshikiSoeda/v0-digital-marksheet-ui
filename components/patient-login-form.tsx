"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GraduationCap, ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"
import { loadTestSessions, type Patient, type TestSession } from "@/lib/data-storage"

export function PatientLoginForm() {
  const router = useRouter()
  const [patientId, setPatientId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<"credentials" | "session">("credentials")
  const [matchedPatients, setMatchedPatients] = useState<Patient[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!patientId || !password) {
      setError("患者担当者IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    try {
      // Phase 8: 認証はサーバー側 API で実施(bcrypt 照合 + HttpOnly cookie 発行)
      const res = await fetch("/api/auth/patient/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: patientId, password }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result?.error || "認証エラーが発生しました")
        setIsLoading(false)
        return
      }

      // 複数セッション持ちの場合: API は needsSessionSelection を返す
      if (result?.needsSessionSelection && Array.isArray(result.sessions)) {
        // 既存のセッション選択 UI を再利用するため、loadTestSessions で詳細を取得
        const universityCode = result.sessions[0]?.universityCode || "dentshowa"
        const allSessions = await loadTestSessions(universityCode)
        const sessionIds = new Set(result.sessions.map((s: { id: string | null }) => s.id).filter(Boolean))
        const availableSessions = allSessions.filter((s) => sessionIds.has(s.id))

        // matchedPatients は再ログイン時に session 選択するためのキャッシュ。
        // API 呼び直しで対応するため、ここでは session 一覧と email/password だけ覚えておく。
        // 既存の matchedPatients 型に合わせるため、最低限のフィールドで埋める。
        const placeholder: Patient[] = result.sessions.map((s: {
          id: string | null
          name: string
          assignedRoomNumber: string | null
          universityCode: string | null
          subjectCode: string | null
        }) => ({
          id: "", // API 再呼び出しで埋める
          email: patientId,
          password: "", // 既に検証済みのため保持しない(Phase 8: 平文を保持しない)
          name: s.name,
          role: "general",
          assignedRoomNumber: s.assignedRoomNumber || "",
          createdAt: new Date().toISOString(),
          universityCode: s.universityCode || "dentshowa",
          subjectCode: s.subjectCode || "",
          testSessionId: s.id || "",
        }))
        setMatchedPatients(placeholder)
        setSessions(availableSessions)
        setStep("session")
        setIsLoading(false)
        return
      }

      // 単一セッション or testSessionId 指定済み: completeLogin に相当する処理
      completeLoginFromApi(result)
    } catch (error) {
      setError("ログイン処理中にエラーが発生しました")
      setIsLoading(false)
    }
  }

  // セッション選択時に再度 API を呼ぶ(testSessionId を渡してログインを完了させる)
  const handleSessionSelectViaApi = async (sessionId: string) => {
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/patient/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: patientId, password, testSessionId: sessionId }),
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

  // API レスポンスを受けて sessionStorage を埋め、画面遷移する
  const completeLoginFromApi = (apiResult: {
    patientId: string
    patientName: string
    patientEmail: string
    patientRoom: string
    universityCode: string
    subjectCode: string
    testSessionId: string
    userRole: string
    accountType: string
  }) => {
    sessionStorage.setItem(
      "loginInfo",
      JSON.stringify({
        id: apiResult.patientId,
        loginType: "patient",
        name: apiResult.patientName,
        email: apiResult.patientEmail,
        assignedRoomNumber: apiResult.patientRoom,
        role: apiResult.userRole,
        universityCode: apiResult.universityCode,
        subjectCode: apiResult.subjectCode,
        testSessionId: apiResult.testSessionId,
      }),
    )
    sessionStorage.setItem("patientId", apiResult.patientId)
    sessionStorage.setItem("patientName", apiResult.patientName)
    sessionStorage.setItem("patientEmail", apiResult.patientEmail)
    sessionStorage.setItem("patientRoom", apiResult.patientRoom)
    sessionStorage.setItem("userRole", apiResult.userRole)
    sessionStorage.setItem("universityCode", apiResult.universityCode)
    sessionStorage.setItem("subjectCode", apiResult.subjectCode)
    sessionStorage.setItem("testSessionId", apiResult.testSessionId)
    sessionStorage.setItem("accountType", apiResult.accountType)

    window.location.href = "/patient/exam-info"
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
          <GraduationCap className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">患者担当者ログイン</CardTitle>
        <CardDescription className="text-center">患者担当者IDとパスワードを入力してください</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="patientId">患者担当者ID</Label>
            <Input
              id="patientId"
              type="text"
              placeholder="例: 2024-PT-001"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
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
