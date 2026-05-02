"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, DoorOpen, BookOpen, ArrowLeft } from "lucide-react"
import { useSession } from "@/lib/auth/use-session"

/**
 * Phase 9b-β2a: sessionStorage("accountType") を useSession() に置換。
 *
 * 動作:
 * - 未ログイン(session === null)→ /admin/login へリダイレクト
 *   ※ middleware が /admin/master-management を Cookie ガードしているため
 *      実際にはここに到達した時点で session ありが期待値だが、二重防御として残す
 * - special_master のみ「大学マスター管理」カードを表示
 *
 * このファイルは β2 の最小先行サンプル。残りの consumer も順次同パターンで置換していく。
 */
export default function MasterManagementPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!session) {
    if (typeof window !== "undefined") {
      router.push("/admin/login")
    }
    return null
  }

  const accountType = session.accountType

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button onClick={() => router.push("/admin/dashboard")} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          ダッシュボードへ戻る
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">マスター管理</h1>
        <p className="text-muted-foreground">大学、部屋、教科のマスターデータを管理します</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accountType === "special_master" && (
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push("/admin/university-management")}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>大学マスター管理</CardTitle>
              </div>
              <CardDescription>大学の登録・編集・削除を行います</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push("/admin/university-management")
                }}
              >
                大学マスター管理を開く
              </Button>
            </CardContent>
          </Card>
        )}

        <Card
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push("/admin/room-management")}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <DoorOpen className="h-6 w-6 text-blue-500" />
              </div>
              <CardTitle>部屋マスター管理</CardTitle>
            </div>
            <CardDescription>試験室・面接室などの部屋情報を管理します</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-transparent"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                router.push("/admin/room-management")
              }}
            >
              部屋マスター管理を開く
            </Button>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push("/admin/subject-management")}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <BookOpen className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle>教科マスター管理</CardTitle>
            </div>
            <CardDescription>教科の登録・編集・削除を行います（大学ごと）</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-transparent"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                router.push("/admin/subject-management")
              }}
            >
              教科マスター管理を開く
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
