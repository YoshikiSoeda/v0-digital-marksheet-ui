import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, Shield, UserCircle } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">Digital Marksheet Exam System</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">医療面接評価システム</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">患者担当者ログイン</CardTitle>
              <CardDescription className="text-base">患者担当の方はこちらからログイン下さい</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/student/login">
                <Button className="w-full" size="lg">
                  患者担当者としてログイン
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">教員ログイン</CardTitle>
              <CardDescription className="text-base">教員の方はこちらからログインしてください</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/teacher/login">
                <Button className="w-full" size="lg">
                  教員としてログイン
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">管理者ログイン</CardTitle>
              <CardDescription className="text-base">試験管理者の方はこちらからログインしてください</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/login">
                <Button variant="outline" className="w-full bg-transparent" size="lg">
                  管理者としてログイン
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
