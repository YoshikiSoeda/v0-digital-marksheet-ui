"use client"

import type React from "react"
import { loadTeachers } from "@/lib/data-storage"
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

    if (!teacherId || !password) {
      setError("IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    try {
      const teachers = await loadTeachers()

      if (!Array.isArray(teachers)) {
        console.error("[v0] Teachers is not an array:", teachers)
        setError("データの読み込みに失敗しました")
        setIsLoading(false)
        return
      }

      const teacher = teachers.find((t) => t.email === teacherId && t.password === password)

      if (!teacher) {
        setError("IDまたはパスワードが正しくありません")
        setIsLoading(false)
        return
      }

      const loginInfo = {
        role: "teacher",
        userId: teacher.id,
        userName: teacher.name,
        email: teacher.email,
        assignedRoomNumber: teacher.assignedRoomNumber || "",
      }

      sessionStorage.setItem("loginInfo", JSON.stringify(loginInfo))
      // Keep legacy keys for backward compatibility
      sessionStorage.setItem("teacherId", teacher.id)
      sessionStorage.setItem("teacherName", teacher.name)
      sessionStorage.setItem("teacherEmail", teacher.email)
      sessionStorage.setItem("teacherRole", teacher.role)
      sessionStorage.setItem("teacherRoom", teacher.assignedRoomNumber || "")

      console.log("[v0] Teacher login successful, info:", loginInfo)

      // Use window.location.href for more reliable navigation
      window.location.href = "/teacher/exam-info"
    } catch (error) {
      console.error("[v0] Error during login:", error)
      setError("ログイン処理中にエラーが発生しました")
      setIsLoading(false)
    }
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
