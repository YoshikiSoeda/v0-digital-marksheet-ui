"use client"

/**
 * A-? (2026-05-20 副田さん仕様): admin-like 教員 (master_admin / university_admin /
 * subject_admin) がログインした直後に「管理画面」か「試験セッション(採点)」を選ぶ画面。
 *
 * 動線:
 *   /login → /api/auth/login → (redirectTo) → /teacher/login-destination
 *     → 「管理画面」ボタン → /admin/dashboard
 *     → 「試験セッション」ボタン → /teacher/exam-info (既存の試験選択 UI)
 */
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth/use-session"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, ClipboardCheck, LogOut } from "lucide-react"

export function TeacherLoginDestination() {
  const router = useRouter()
  const { session, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  const roleLabel = (() => {
    switch (session?.role) {
      case "master_admin": return "マスター管理者"
      case "university_admin": return "大学管理者"
      case "subject_admin": return "教科管理者"
      default: return session?.role || ""
    }
  })()

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
    } catch {}
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl">移動先を選んでください</CardTitle>
          <CardDescription>
            {session?.userName ? `${session.userName} さん` : "ようこそ"}
            {roleLabel ? `(${roleLabel})` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full justify-start h-auto py-4"
            onClick={() => router.push("/admin/dashboard")}
          >
            <LayoutDashboard className="w-5 h-5 mr-3 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium">管理画面</div>
              <div className="text-xs opacity-80">ダッシュボード/問題管理/受験者管理</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => router.push("/teacher/exam-info")}
          >
            <ClipboardCheck className="w-5 h-5 mr-3 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium">試験セッション</div>
              <div className="text-xs text-muted-foreground">担当試験を選んで採点へ</div>
            </div>
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            ログアウト
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
