"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, DoorOpen, BookOpen, ArrowLeft } from "lucide-react"

export default function MasterManagementPage() {
  const router = useRouter()
  const [accountType, setAccountType] = useState<string | null>(null)

  useEffect(() => {
    const storedAccountType = sessionStorage.getItem("accountType")
    setAccountType(storedAccountType)

    if (!storedAccountType) {
      router.push("/admin/login")
    }
  }, [router])

  if (!accountType) {
    return null
  }

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
