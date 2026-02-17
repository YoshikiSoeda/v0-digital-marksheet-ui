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
import { createClient } from "@/lib/supabase/client"

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

    const supabase = createClient()

    const emailToCheck = adminId === "ediand" ? "ediand@system.local" : adminId

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("*")
      .eq("email", emailToCheck)
      .eq("password", password)
      .single()

    if (adminError) {
      console.log("[v0] Admin login error:", adminError)
    }

    if (admin) {
      console.log("[v0] Admin login successful:", {
        name: admin.name,
        accountType: admin.account_type,
        universityCodes: admin.university_codes,
      })

      const accountType = admin.account_type || "admin"
      const universityCodes = admin.university_codes || ["dentshowa"]

      const loginInfo = {
        role: "admin",
        userId: admin.id,
        userName: admin.name,
        universityCodes,
        accountType,
      }

      sessionStorage.setItem("loginInfo", JSON.stringify(loginInfo))
      sessionStorage.setItem("userRole", "admin")
      sessionStorage.setItem("userId", admin.id)
      sessionStorage.setItem("userName", admin.name)
      sessionStorage.setItem("universityCodes", JSON.stringify(universityCodes))
      sessionStorage.setItem("accountType", accountType)

      console.log("[v0] Session storage set, redirecting to /admin/dashboard")

      window.location.href = "/admin/dashboard"
    } else {
      console.log("[v0] No matching admin account found")
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
        <CardDescription className="text-center">管理者アカウントでログインしてください</CardDescription>
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
              placeholder="例: ediand または admin@example.com"
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
