"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, FileText, AlertCircle } from "lucide-react"

export function ExamInfoScreen() {
  const router = useRouter()

  const handleStartExam = () => {
    router.push("/student/exam")
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="text-3xl text-center">全身の医療面接評価シート</CardTitle>
            <CardDescription className="text-center text-base">
              以下の試験情報を確認してから開始してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-semibold">制限時間</div>
                  <div className="text-2xl font-bold text-primary">90分</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
                <FileText className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-semibold">問題数</div>
                  <div className="text-2xl font-bold text-primary">100問</div>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-accent/50 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">注意事項</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                <li>• 各問題には選択肢A〜Eがあります</li>
                <li>• 一度提出した回答は変更できません</li>
                <li>• 通信が切断された場合、自動的に保存されます</li>
                <li>• 制限時間を過ぎると自動的に提出されます</li>
                <li>• 全ての問題に回答してから提出ボタンを押してください</li>
              </ul>
            </div>

            <Button onClick={handleStartExam} size="lg" className="w-full text-lg h-12">
              試験を開始する
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
