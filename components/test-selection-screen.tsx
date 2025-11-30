"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, ChevronRight, Calendar } from "lucide-react"
import { loadTests, type Test } from "@/lib/data-storage"

interface TestSelectionScreenProps {
  examPath: string
  userType: "teacher" | "patient"
}

export function TestSelectionScreen({ examPath, userType }: TestSelectionScreenProps) {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const fetchedTests = await loadTests()
        if (Array.isArray(fetchedTests)) {
          setTests(fetchedTests)
        } else {
          console.error("[v0] loadTests did not return an array:", fetchedTests)
          setTests([])
        }
      } catch (error) {
        console.error("[v0] Error loading tests:", error)
        setTests([])
      }
    }
    fetchTests()
  }, [])

  const handleSelectTest = (testId: string) => {
    sessionStorage.setItem(`${userType}_selected_test`, testId)
    router.push(examPath)
  }

  if (tests.length === 0) {
    return (
      <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">テストが登録されていません</CardTitle>
              <CardDescription className="text-center">
                管理者に問題管理画面からテストを登録するよう依頼してください
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button variant="outline" onClick={() => router.push("/")}>
                トップページに戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">評価テスト選択</h1>
          <p className="text-muted-foreground mt-2">実施するテストを選択してください</p>
        </div>

        <div className="grid gap-4">
          {tests.map((test) => (
            <Card key={test.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{test.title}</CardTitle>
                    <CardDescription className="mt-2">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {test.sheets.length} シート
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          作成: {new Date(test.createdAt).toLocaleDateString("ja-JP")}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleSelectTest(test.id)} className="ml-4">
                    選択
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm font-medium">含まれるシート:</div>
                  <div className="flex flex-wrap gap-2">
                    {test.sheets.map((sheet) => (
                      <div key={sheet.id} className="px-3 py-1 bg-secondary rounded-md text-sm">
                        {sheet.title}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
