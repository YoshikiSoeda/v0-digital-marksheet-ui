"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserCircle } from "lucide-react"
import Link from "next/link"

export function TeacherLoginForm() {
  const router = useRouter()
  const [teacherId, setTeacherId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Form validation
    if (!teacherId || !password) {
      setError("教員IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    sessionStorage.setItem("teacherId", teacherId)

    // Simulate login - In production, this would call an API
    setTimeout(() => {
      setIsLoading(false)
      router.push("/teacher/exam-info")
    }, 1000)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
          <UserCircle className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">教員ログイン</CardTitle>
        <CardDescription className="text-center">教員IDとパスワードを入力してください</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="teacherId">教員ID</Label>
            <Input
              id="teacherId"
              type="text"
              placeholder="例: 2024-TC-001"
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
