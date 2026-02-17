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
import { loadTeachers } from "@/lib/data-storage"

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

    if (!adminId || !password) {
      setError("管理者IDとパスワードを入力してください")
      setIsLoading(false)
      return
    }

    // 1. admin,admin でマスター管理者ログイン
    if (adminId === "admin" && password === "admin") {
      const supabase = createClient()
      const { data: admins } = await supabase
        .from("admins")
        .select("*")
        .eq("role", "master_admin")
        .limit(1)

      const admin = admins?.[0]
      if (admin) {
        const universityCodes = admin.university_codes || ["dentshowa"]
        sessionStorage.setItem("loginInfo", JSON.stringify({
          loginType: "admin",
          role: "master_admin",
          userId: admin.id,
          userName: admin.name,
          universityCodes,
        }))
        sessionStorage.setItem("userRole", "admin")
        sessionStorage.setItem("userId", admin.id)
        sessionStorage.setItem("userName", admin.name)
        sessionStorage.setItem("universityCodes", JSON.stringify(universityCodes))
        sessionStorage.setItem("accountType", "special_master")
        sessionStorage.setItem("teacherRole", "master_admin")

        window.location.href = "/admin/dashboard"
        return
      }
    }

    // 2. adminsテーブルから検索
    const supabase = createClient()
    const emailToCheck = adminId === "ediand" ? "ediand@system.local" : adminId

    const { data: admin } = await supabase
      .from("admins")
      .select("*")
      .eq("email", emailToCheck)
      .eq("password", password)
      .single()

    if (admin) {
      const role = admin.role || "master_admin"
      const accountTypeMap: Record<string, string> = {
        master_admin: "special_master",
        university_admin: "university_master",
      }
      const universityCodes = admin.university_codes || ["dentshowa"]

      sessionStorage.setItem("loginInfo", JSON.stringify({
        loginType: "admin",
        role,
        userId: admin.id,
        userName: admin.name,
        universityCodes,
      }))
      sessionStorage.setItem("userRole", "admin")
      sessionStorage.setItem("userId", admin.id)
      sessionStorage.setItem("userName", admin.name)
      sessionStorage.setItem("universityCodes", JSON.stringify(universityCodes))
      sessionStorage.setItem("accountType", accountTypeMap[role] || "admin")
      sessionStorage.setItem("teacherRole", role)

      window.location.href = "/admin/dashboard"
      return
    }

    // 3. teachersテーブルからuniversity_admin以上を検索
    try {
      const teachers = await loadTeachers()
      const teacher = teachers.find(
        (t) => t.email === adminId && t.password === password &&
               (t.role === "university_admin" || t.role === "master_admin" || t.role === "subject_admin")
      )

      if (teacher) {
        const teacherRole = teacher.role as string
        const accountTypeMap: Record<string, string> = {
          master_admin: "special_master",
          university_admin: "university_master",
          subject_admin: "subject_admin",
        }

        sessionStorage.setItem("loginInfo", JSON.stringify({
          loginType: "teacher_admin",
          role: teacherRole,
          userId: teacher.id,
          userName: teacher.name,
          email: teacher.email,
          universityCode: teacher.universityCode || "dentshowa",
          subjectCode: teacher.subjectCode || "",
        }))
        sessionStorage.setItem("userRole", "admin")
        sessionStorage.setItem("userId", teacher.id)
        sessionStorage.setItem("userName", teacher.name)
        sessionStorage.setItem("teacherId", teacher.id)
        sessionStorage.setItem("teacherName", teacher.name)
        sessionStorage.setItem("teacherEmail", teacher.email)
        sessionStorage.setItem("teacherRole", teacherRole)
        sessionStorage.setItem("teacherRoom", teacher.assignedRoomNumber || "")
        sessionStorage.setItem("universityCode", teacher.universityCode || "dentshowa")
        sessionStorage.setItem("universityCodes", JSON.stringify([teacher.universityCode || "dentshowa"]))
        sessionStorage.setItem("subjectCode", teacher.subjectCode || "")
        sessionStorage.setItem("accountType", accountTypeMap[teacherRole] || "admin")

        window.location.href = "/admin/dashboard"
        return
      }
    } catch (err) {
      console.error("[v0] Error checking teachers:", err)
    }

    setError("管理者IDまたはパスワードが正しくありません")
    setIsLoading(false)
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
