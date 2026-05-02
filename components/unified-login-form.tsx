"use client"

/**
 * Phase 9d-1: 共通 /login 画面のフォーム。
 * ADR-001 §7-1 で確定したログインモデルを実装する:
 *   - ロール選択 UI なし
 *   - 入力は ID(またはメール) + パスワードのみ
 *   - サーバが verifyCredentials で 3 テーブル(admins/teachers/patients)を順次照合し、
 *     ロールと redirectTo を決定する
 *   - 教員/患者役で複数セッションに紐づく場合は session 選択ステップを挟む
 */

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LogIn, ArrowLeft, Calendar } from "lucide-react"
import { listTestSessions } from "@/lib/api/test-sessions"
import type { TestSession } from "@/lib/types"

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

export function UnifiedLoginForm() {
  const router = useRouter()
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<"credentials" | "session">("credentials")
  const [sessions, setSessions] = useState<TestSession[]>([])

  const callLogin = async (testSessionId?: string): Promise<UnifiedLoginResponse | null> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password, testSessionId }),
        credentials: "same-origin",
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

  const completeLogin = (user: UnifiedLoginUser, redirectTo?: string) => {
    // Phase 9b-β2f2 で sessionStorage 認可キーは廃止済み。
    // 試験中の testSessionId のみ UI 状態として書き込む(test-selection-screen が上書きする)。
    sessionStorage.setItem("testSessionId", user.testSessionId)
    window.location.href = redirectTo || "/"
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!loginId || !password) {
      setError("IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    const result = await callLogin()
    if (!result) {
      setIsLoading(false)
      return
    }

    // 複数セッション選択待ち(教員 or 患者役)
    if (result.needsSessionSelection && result.candidates && result.source) {
      const universityCode = result.candidates[0]?.universityCode || "dentshowa"
      const allSessions = await listTestSessions({ universityCode })
      const candidateIds = new Set(result.candidates.map((c) => c.id).filter(Boolean))
      const availableSessions = allSessions.filter((s) => candidateIds.has(s.id))
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

    completeLogin(result.user, result.redirectTo)
  }

  const handleSessionSelect = async (sessionId: string) => {
    setError("")
    setIsLoading(true)
    const result = await callLogin(sessionId)
    if (!result || !result.user) {
      setIsLoading(false)
      return
    }
    completeLogin(result.user, result.redirectTo)
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
              disabled={isLoading}
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
            onClick={() => {
              setStep("credentials")
              setError("")
            }}
            disabled={isLoading}
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
          <LogIn className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">ログイン</CardTitle>
        <CardDescription className="text-center">
          IDまたはメールアドレスとパスワードを入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="loginId">ID / メールアドレス</Label>
            <Input
              id="loginId"
              type="text"
              autoComplete="username"
              placeholder="管理者ID、教員/患者担当者のメールアドレス"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="パスワード"
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
