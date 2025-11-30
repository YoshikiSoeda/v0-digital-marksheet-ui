"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield } from "lucide-react"
import Link from "next/link"
import { loadTeachers } from "@/lib/data-storage"

const MASTER_ACCOUNT = {
  id: "admin",
  password: "admin",
}

export function AdminLoginForm() {
  const router = useRouter()
  const [adminId, setAdminId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    console.log("[v0] Admin login attempt:", { adminId, hasPassword: !!password })

    if (!adminId || !password) {
      setError("管理者IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    if (adminId === MASTER_ACCOUNT.id && password === MASTER_ACCOUNT.password) {
      console.log("[v0] Master account login successful")
      const loginInfo = {
        role: "admin",
        userId: adminId,
        userName: "マスター管理者",
      }
      sessionStorage.setItem("loginInfo", JSON.stringify(loginInfo))
      sessionStorage.setItem("userRole", "admin")
      sessionStorage.setItem("userId", adminId)
      sessionStorage.setItem("userName", "マスター管理者")
      console.log("[v0] Session storage set, redirecting to /admin/dashboard")

      window.location.href = "/admin/dashboard"
      return
    }

    const teachers = await loadTeachers()
    console.log("[v0] Loaded teachers data:", teachers)
    const teacher = teachers.find((t) => t.email === adminId && t.password === password)

    if (teacher) {
      console.log("[v0] Teacher found:", { name: teacher.name, role: teacher.role })
      if (teacher.role === "admin") {
        const loginInfo = {
          role: "admin",
          userId: teacher.id,
          userName: teacher.name,
        }
        sessionStorage.setItem("loginInfo", JSON.stringify(loginInfo))
        sessionStorage.setItem("userRole", "admin")
        sessionStorage.setItem("userId", teacher.id)
        sessionStorage.setItem("userName", teacher.name)
        console.log("[v0] Session storage set, redirecting to /admin/dashboard")

        window.location.href = "/admin/dashboard"
      } else {
        console.log("[v0] Teacher does not have admin role")
        setError("管理者権限がありません。一般教員は採点画面からログインしてください。")
        setIsLoading(false)
      }
    } else {
      console.log("[v0] No matching teacher or master account found")
      setError("管理者IDまたはパスワードが正しくありません")
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">管理者ログイン</CardTitle>
        <CardDescription className="text-center">
          マスターアカウント、または管理者権限を持つ教員IDでログインしてください
        </CardDescription>
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
              placeholder="例: admin または teacher@example.com"
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
