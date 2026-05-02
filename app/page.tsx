import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogIn, Mail, ExternalLink } from "lucide-react"

/**
 * Phase 9d-1: ロール選択を廃止して単一の「ログイン」CTA に簡素化。
 * ログイン後はサーバ(/api/auth/login の redirectTo)が役割に応じた画面へ振り分ける。
 */
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-10">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">
              Digital Marksheet Exam System
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              医療面接評価システム
            </p>
          </div>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="space-y-4">
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <LogIn className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">ログイン</CardTitle>
              <CardDescription className="text-base text-center">
                管理者・教員・患者担当者のいずれもこちらからログインしてください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button className="w-full" size="lg">
                  ログイン画面へ
                </Button>
              </Link>
            </CardContent>
          </Card>
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
