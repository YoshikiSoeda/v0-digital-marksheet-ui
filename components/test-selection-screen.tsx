"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, ChevronRight, Calendar, Shield } from "lucide-react"
import { loadTests, type Test } from "@/lib/data-storage"
import Link from "next/link"

interface TestSelectionScreenProps {
  examPath: string
  userType: "teacher" | "patient"
}

export function TestSelectionScreen({ examPath, userType }: TestSelectionScreenProps) {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [teacherRole, setTeacherRole] = useState<string>("")
  const [subjectName, setSubjectName] = useState<string>("")

  useEffect(() => {
    let teacherSubjectCode = ""

    if (userType === "teacher") {
      const role = sessionStorage.getItem("teacherRole") || "general"
      setTeacherRole(role)
      teacherSubjectCode = sessionStorage.getItem("subjectCode") || ""
    }

    const fetchData = async () => {
      try {
        // 教科名を取得
        if (teacherSubjectCode) {
          try {
            const subjectsRes = await fetch("/api/subjects")
            if (subjectsRes.ok) {
              const subjects = await subjectsRes.json()
              const matched = subjects.find((s: any) => s.subject_code === teacherSubjectCode)
              if (matched) setSubjectName(matched.subject_name)
            }
          } catch (err) {
            console.error("[v0] Error loading subjects:", err)
          }
        }

        // テストを教科コードでフィルタして取得
        const universityCode = sessionStorage.getItem("universityCode") || undefined
        const fetchedTests = await loadTests(universityCode, teacherSubjectCode || undefined)
        if (Array.isArray(fetchedTests)) {
          // roleTypeでフィルタ: 教員はteacher, 患者役はpatientのテストのみ表示
          const expectedRoleType = userType === "patient" ? "patient" : "teacher"
          const filtered = fetchedTests.filter((t) => (t.roleType || "teacher") === expectedRoleType)
          setTests(filtered)
        } else {
          console.error("[v0] loadTests did not return an array:", fetchedTests)
          setTests([])
        }
      } catch (error) {
        console.error("[v0] Error loading tests:", error)
        setTests([])
      }
    }
    fetchData()
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              評価テスト選択
              {subjectName && (
                <span className="ml-3 text-lg font-semibold text-muted-foreground">({subjectName})</span>
              )}
            </h1>
            <p className="text-muted-foreground mt-2">実施するテストを選択してください</p>
          </div>
          {userType === "teacher" && teacherRole !== "general" && teacherRole !== "" && (
            <Link href="/admin/dashboard">
              <Button variant="outline" className="flex items-center gap-2 border-blue-500 text-blue-700 hover:bg-blue-50">
                <Shield className="w-4 h-4" />
                管理画面
              </Button>
            </Link>
          )}
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
