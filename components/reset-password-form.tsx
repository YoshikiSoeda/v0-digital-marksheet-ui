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

/**
 * Phase 8c (2026-04-26 以降):
 *   /api/auth/reset-password 経由で password 変更。
 *   サーバー側で bcrypt ハッシュ化して該当 1 件だけ UPDATE する。
 *   旧実装(load 全件 → 配列内書き換え → save 全件)は削除済み。
 */
export function ResetPasswordForm() {
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [updated, setUpdated] = useState<"teachers" | "patients" | null>(null)
  const [submitting, setSubmitting] = useState(false)
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

    setSubmitting(true)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), newPassword }),
      })

      if (response.status === 404) {
        setError("登録されていないメールアドレスです")
        return
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body?.error || `エラーが発生しました (HTTP ${response.status})`)
        return
      }

      const body = await response.json().catch(() => ({}))
      const target = (body?.updated === "teachers" || body?.updated === "patients") ? body.updated : null
      setUpdated(target)
      setSuccess(true)
      setTimeout(() => {
        router.push(target === "patients" ? "/patient/login" : "/teacher/login")
      }, 2000)
    } catch (err) {
      console.error("[reset-password] fetch error:", err)
      setError("通信エラーが発生しました")
    } finally {
      setSubmitting(false)
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
          <p className="text-sm text-muted-foreground">
            2秒後に{updated === "patients" ? "患者担当者" : "教員"}ログイン画面に戻ります...
          </p>
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

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "変更中..." : "パスワードを変更"}
          </Button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-primary hover:underline inline-flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              ログインに戻る
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
