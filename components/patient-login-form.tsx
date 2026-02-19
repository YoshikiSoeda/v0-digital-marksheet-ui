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
import { loadPatients, loadTestSessions, type Patient, type TestSession } from "@/lib/data-storage"

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
      const patients = await loadPatients()

      if (!Array.isArray(patients)) {
        setError("データの読み込みに失敗しました")
        setIsLoading(false)
        return
      }

      const matched = patients.filter((p) => p.email === patientId && p.password === password)

      if (matched.length === 0) {
        setError("患者担当者IDまたはパスワードが正しくありません")
        setIsLoading(false)
        return
      }

      const universityCode = matched[0].universityCode || "dentshowa"
      const allSessions = await loadTestSessions(universityCode)
      const patientSessionIds = new Set(matched.map((p) => p.testSessionId).filter(Boolean))
      const availableSessions = allSessions.filter((s) => patientSessionIds.has(s.id))

      if (availableSessions.length === 1) {
        const patient = matched.find((p) => p.testSessionId === availableSessions[0].id) || matched[0]
        completeLogin(patient, availableSessions[0].id)
      } else if (availableSessions.length > 1) {
        setMatchedPatients(matched)
        setSessions(availableSessions)
        setStep("session")
        setIsLoading(false)
      } else {
        completeLogin(matched[0], matched[0].testSessionId || "")
      }
    } catch (error) {
      console.error("[v0] Error during patient login:", error)
      setError("ログイン処理中にエラーが発生しました")
      setIsLoading(false)
    }
  }

  const handleSessionSelect = (sessionId: string) => {
    const patient = matchedPatients.find((p) => p.testSessionId === sessionId) || matchedPatients[0]
    completeLogin(patient, sessionId)
  }

  const completeLogin = (patient: Patient, testSessionId: string) => {
    sessionStorage.setItem(
      "loginInfo",
      JSON.stringify({
        id: patient.id,
        loginType: "patient",
        name: patient.name,
        email: patient.email,
        assignedRoomNumber: patient.assignedRoomNumber || "",
        role: patient.role,
        universityCode: patient.universityCode || "dentshowa",
        subjectCode: patient.subjectCode || "",
        testSessionId,
      }),
    )

    sessionStorage.setItem("patientId", patient.id)
    sessionStorage.setItem("patientName", patient.name)
    sessionStorage.setItem("patientEmail", patient.email)
    sessionStorage.setItem("patientRoom", patient.assignedRoomNumber || "")
    sessionStorage.setItem("userRole", patient.role)
    sessionStorage.setItem("universityCode", patient.universityCode || "dentshowa")
    sessionStorage.setItem("subjectCode", patient.subjectCode || "")
    sessionStorage.setItem("testSessionId", testSessionId)

    window.location.href = "/patient/exam-info"
  }

  if (step === "session") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">試験セッション選択</CardTitle>
          <CardDescription className="text-center">参加する試験セッションを選択してください</CardDescription>
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
                <div className="font-medium">{session.description || session.testCode}</div>
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
