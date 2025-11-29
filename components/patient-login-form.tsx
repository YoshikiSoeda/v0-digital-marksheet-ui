"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GraduationCap } from "lucide-react"
import Link from "next/link"
import { loadPatients } from "@/lib/data-storage"

export function PatientLoginForm() {
  const router = useRouter()
  const [patientId, setPatientId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!patientId || !password) {
      setError("患者担当者IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    const patients = loadPatients()
    const patient = patients.find((p) => p.email === patientId && p.password === password)

    if (!patient) {
      setError("患者担当者IDまたはパスワードが正しくありません")
      setIsLoading(false)
      return
    }

    // Store logged-in patient info
    sessionStorage.setItem("patientId", patient.id)
    sessionStorage.setItem("patientName", JSON.stringify(patient.name))
    sessionStorage.setItem("patientEmail", JSON.stringify(patient.email))
    sessionStorage.setItem("patientRoom", JSON.stringify(patient.roomNumber))
    sessionStorage.setItem("assignedStudentIds", JSON.stringify(patient.assignedStudents))

    setTimeout(() => {
      setIsLoading(false)
      router.push("/patient/exam-info")
    }, 500)
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
