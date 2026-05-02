import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, UserCog, UserPlus, List, Home, Plus } from "lucide-react"

export default function AccountManagementPage() {
  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">アカウント管理</h1>
            <p className="text-muted-foreground">学生・教員・患者役の管理</p>
          </div>
          <Link href="/admin/dashboard">
            <Button variant="outline">
              <Home className="w-4 h-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </Link>
        </div>

        {/* Phase 9d-4a: 統合ユーザー追加(教員 + 患者役) */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Plus className="w-5 h-5" />
              ユーザー追加・一覧(教員・患者役)
            </CardTitle>
            <CardDescription>
              ユーザー追加(役割選択)、一覧の横断確認はこちら。
              CSV まとめ登録は下の専用ページから。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Link href="/admin/users/new">
              <Button className="w-full h-16">
                <Plus className="w-5 h-5 mr-2" />
                ユーザーを追加する
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="outline" className="w-full h-16 bg-transparent">
                <List className="w-5 h-5 mr-2" />
                ユーザー一覧(教員・患者役)
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Student Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              学生管理
            </CardTitle>
            <CardDescription>学生の登録と一覧表示</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Link href="/admin/register-students">
              <Button className="w-full h-20 bg-transparent" variant="outline">
                <div className="flex flex-col items-center gap-2">
                  <UserPlus className="w-6 h-6" />
                  <span>学生登録</span>
                </div>
              </Button>
            </Link>
            <Link href="/admin/students-list">
              <Button className="w-full h-20 bg-transparent" variant="outline">
                <div className="flex flex-col items-center gap-2">
                  <List className="w-6 h-6" />
                  <span>学生一覧</span>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Teacher Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              教員管理
            </CardTitle>
            <CardDescription>教員の登録と一覧表示</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Link href="/admin/register-teachers">
              <Button className="w-full h-20 bg-transparent" variant="outline">
                <div className="flex flex-col items-center gap-2">
                  <UserPlus className="w-6 h-6" />
                  <span>教員登録</span>
                </div>
              </Button>
            </Link>
            <Link href="/admin/teachers-list">
              <Button className="w-full h-20 bg-transparent" variant="outline">
                <div className="flex flex-col items-center gap-2">
                  <List className="w-6 h-6" />
                  <span>教員一覧</span>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Patient Role Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              患者役管理
            </CardTitle>
            <CardDescription>患者役の登録と一覧表示</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Link href="/admin/register-patients">
              <Button className="w-full h-20 bg-transparent" variant="outline">
                <div className="flex flex-col items-center gap-2">
                  <UserPlus className="w-6 h-6" />
                  <span>患者役登録</span>
                </div>
              </Button>
            </Link>
            <Link href="/admin/patients-list">
              <Button className="w-full h-20 bg-transparent" variant="outline">
                <div className="flex flex-col items-center gap-2">
                  <List className="w-6 h-6" />
                  <span>患者役一覧</span>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
