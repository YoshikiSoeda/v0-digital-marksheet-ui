"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Download, LogOut, Clock, Target } from "lucide-react"

export function ExamResultsScreen() {
  const router = useRouter()
  const [score, setScore] = useState(0)

  useEffect(() => {
    const savedScore = sessionStorage.getItem("examScore")
    if (savedScore) {
      setScore(Number(savedScore))
    }
  }, [])

  const handleDownloadCSV = () => {
    const csvContent = `受験ID,試験名,得点,正答率,回答時間\n2024-ST-001,全身の医療面接評価シート,${score},${score}%,67分30秒`
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "試験結果.csv"
    link.click()
  }

  const handleExit = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl">試験完了</CardTitle>
          <p className="text-muted-foreground">お疲れ様でした。試験結果を確認してください。</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center p-8 bg-secondary/50 rounded-lg border-2 border-primary/20">
            <div className="text-6xl font-bold text-primary mb-2">{score}</div>
            <div className="text-2xl text-muted-foreground">/ 100点</div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg">
              <Target className="w-5 h-5 text-primary mt-1" />
              <div>
                <div className="text-sm text-muted-foreground">正答率</div>
                <div className="text-2xl font-bold">{score}%</div>
                <div className="text-sm text-muted-foreground mt-1">{score}問正解 / 100問</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg">
              <Clock className="w-5 h-5 text-primary mt-1" />
              <div>
                <div className="text-sm text-muted-foreground">回答時間</div>
                <div className="text-2xl font-bold">67分30秒</div>
                <div className="text-sm text-muted-foreground mt-1">残り時間: 22分30秒</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={handleDownloadCSV} variant="outline" className="flex-1 bg-transparent" size="lg">
              <Download className="w-4 h-4 mr-2" />
              結果をダウンロード (CSV)
            </Button>
            <Button onClick={handleExit} className="flex-1" size="lg">
              <LogOut className="w-4 h-4 mr-2" />
              退出する
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
