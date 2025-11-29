"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Users, Clock, CheckCircle, XCircle, FileText, Settings, DoorOpen, Home } from "lucide-react"

const generateRoomData = () => {
  const rooms = []
  for (let i = 1; i <= 100; i++) {
    const studentsInRoom = 7 // 700 students / 100 rooms
    const completed = Math.floor(Math.random() * studentsInRoom)
    const inProgress = Math.floor(Math.random() * (studentsInRoom - completed))
    const notStarted = studentsInRoom - completed - inProgress

    rooms.push({
      roomNumber: i,
      totalStudents: studentsInRoom,
      completed,
      inProgress,
      notStarted,
      averageScore: completed > 0 ? Math.floor(Math.random() * 30 + 60) : 0,
      progressPercentage: ((completed + inProgress * 0.5) / studentsInRoom) * 100,
    })
  }
  return rooms
}

const mockStats = {
  totalStudents: 700,
  inProgress: 245,
  completed: 320,
  notStarted: 135,
  totalRooms: 100,
  totalAnswered: 565,
}

export function AdminDashboard() {
  const roomData = generateRoomData()
  const completedRooms = roomData.filter((r) => r.completed === r.totalStudents).length

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">管理者ダッシュボード</h1>
            <p className="text-muted-foreground">試験の進行状況を管理</p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline">
                <Home className="w-4 h-4 mr-2" />
                トップページ
              </Button>
            </Link>
            <Link href="/admin/questions">
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                問題管理
              </Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                設定
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">総受験者数</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{mockStats.totalStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">登録済み受験者</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">部屋数</CardTitle>
              <DoorOpen className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{mockStats.totalRooms}</div>
              <p className="text-xs text-muted-foreground mt-1">{completedRooms}部屋完了</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">試験中</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{mockStats.inProgress}</div>
              <p className="text-xs text-muted-foreground mt-1">現在受験中</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">提出済み</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{mockStats.completed}</div>
              <p className="text-xs text-muted-foreground mt-1">試験完了</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">未着手</CardTitle>
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{mockStats.notStarted}</div>
              <p className="text-xs text-muted-foreground mt-1">未開始</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress overview */}
        <Card>
          <CardHeader>
            <CardTitle>回答進行状況</CardTitle>
            <CardDescription>全体の回答率を表示</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>全体進捗</span>
                <span className="font-semibold">
                  {mockStats.totalAnswered} / {mockStats.totalStudents} 回答済み
                </span>
              </div>
              <Progress value={(mockStats.totalAnswered / mockStats.totalStudents) * 100} className="h-3" />
            </div>
            <div className="text-center text-4xl font-bold text-primary">
              {Math.round((mockStats.totalAnswered / mockStats.totalStudents) * 100)}%
            </div>
          </CardContent>
        </Card>

        {/* Student list link */}
        <Card>
          <CardHeader>
            <CardTitle>受験者一覧</CardTitle>
            <CardDescription>詳細な受験者情報と結果を確認</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/students">
              <Button className="w-full" size="lg">
                受験者一覧を表示
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>部屋別進捗状況</CardTitle>
            <CardDescription>各部屋の回答進捗を表示（7名/部屋）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-96 overflow-y-auto">
              {roomData.map((room) => (
                <Card key={room.roomNumber} className="bg-accent/30 hover:bg-accent/50 transition-colors">
                  <CardContent className="p-3">
                    <div className="text-center space-y-2">
                      <div className="font-bold text-lg text-primary">部屋 {room.roomNumber}</div>
                      <Progress value={room.progressPercentage} className="h-2" />
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">完了:</span>
                          <span className="font-semibold text-green-600">{room.completed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">進行中:</span>
                          <span className="font-semibold text-blue-600">{room.inProgress}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">未着手:</span>
                          <span className="font-semibold text-orange-600">{room.notStarted}</span>
                        </div>
                        {room.averageScore > 0 && (
                          <div className="text-center pt-1 border-t">
                            <span className="text-muted-foreground">平均: </span>
                            <span className="font-bold text-primary">{room.averageScore}点</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
