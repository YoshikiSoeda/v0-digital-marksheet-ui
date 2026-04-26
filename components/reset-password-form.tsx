"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lock, Mail, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm() {
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !newPassword || !confirmPassword) {
      setError("すべての項目を入力してください")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません")
      return
    }
    if (newPassword.length < 4) {
      setError("パスワードは4文字以上で入力してください")
      return
    }

    setIsLoading(true)
    try {
      // Phase 8b: bcrypt 化はサーバー側 RPC で実施
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result?.error || "パスワード変更に失敗しました")
        setIsLoading(false)
        return
      }

      setSuccess(true)
      const redirectTo: string = result?.redirectTo || "/teacher/login"
      setTimeout(() => {
        router.push(redirectTo)
      }, 2000)
    } catch (err) {
      console.error("[reset-password] error:", err)
      setError("ログイン処理中にエラーが発生しました")
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-green-600">パスワード変更完了</CardTitle>
          <CardDescription className="text-center">新しいパスワードでログインしてください</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">2秒後にログイン画面に戻ります...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center text-primary">パスワード変更</CardTitle>
        <CardDescription className="text-center">新しいパスワードを設定してください</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">ログインID（メールアドレス）</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="example@university.ac.jp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">新しいパスワード</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">パスワード再入力</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {error && <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">{error}</div>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "変更中..." : "パスワードを変更"}
          </Button>

          <div className="text-center space-y-2">
            <Link
              href="/teacher/login"
              className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              教員ログインに戻る
            </Link>
            <Link
              href="/patient/login"
              className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              患者担当者ログインに戻る
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
