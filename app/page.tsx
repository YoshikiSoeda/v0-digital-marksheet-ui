import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, Shield, UserCircle, Mail, ExternalLink } from "lucide-react"

export default function HomePage() {
  console.log("[v0] HomePage rendering")
  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <main className="flex-1 flex items-center justify-center p-4">
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
                <Link href="/patient/login">
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
      </main>

      <footer className="border-t bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="https://www.ediand.co.jp/" target="_blank" rel="noopener noreferrer">
              <Image
                src="/images/ediand-logo.png"
                alt="EDIAND Inc."
                width={160}
                height={40}
                className="h-8 w-auto"
              />
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">
                利用規約
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                プライバシーポリシー
              </Link>
              <a
                href="mailto:support@ediand.co.jp"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                お問い合わせ
              </a>
              <a
                href="https://www.ediand.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                会社HP
              </a>
            </nav>
          </div>

          <div className="mt-4 pt-4 border-t text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} EDIAND Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
