"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, Shield } from "lucide-react"
import { loadTests, loadTestSessions, type Test, type TestSession } from "@/lib/data-storage"
import Link from "next/link"

interface TestSelectionScreenProps {
  examPath: string
  userType: "teacher" | "patient"
}

interface SubjectInfo {
  subject_code: string
  subject_name: string
}

export function TestSelectionScreen({ examPath, userType }: TestSelectionScreenProps) {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [testSessions, setTestSessions] = useState<TestSession[]>([])
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
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
        // 教科一覧を取得
        try {
          const subjectsRes = await fetch("/api/subjects")
          if (subjectsRes.ok) {
            const subjectsData = await subjectsRes.json()
            setSubjects(subjectsData)
            if (teacherSubjectCode) {
              const matched = subjectsData.find((s: any) => s.subject_code === teacherSubjectCode)
              if (matched) setSubjectName(matched.subject_name)
            }
          }
        } catch (err) {
          console.error("[v0] Error loading subjects:", err)
        }

        // テストセッション一覧を取得
        const universityCode = sessionStorage.getItem("universityCode") || undefined
        try {
          const sessions = await loadTestSessions(universityCode)
          setTestSessions(sessions)
        } catch (err) {
          console.error("[v0] Error loading test sessions:", err)
        }

        // テストを教科コードでフィルタして取得
        const fetchedTests = await loadTests(universityCode, teacherSubjectCode || undefined)
        if (Array.isArray(fetchedTests)) {
          const expectedRoleType = userType === "patient" ? "patient" : "teacher"
          const filtered = fetchedTests.filter((t) => (t.roleType || "teacher") === expectedRoleType)
          setTests(filtered)
        } else {
          setTests([])
        }
      } catch (error) {
        console.error("[v0] Error loading tests:", error)
        setTests([])
      }
    }
    fetchData()
  }, [userType])

  const getTestDate = (test: Test): string => {
    const session = testSessions.find((s) => s.id === test.testSessionId)
    if (session?.testDate) {
      return new Date(session.testDate).toLocaleDateString("ja-JP")
    }
    return "-"
  }

  const getSubjectName = (test: Test): string => {
    if (!test.subjectCode) return "-"
    const matched = subjects.find((s) => s.subject_code === test.subjectCode)
    return matched?.subject_name || test.subjectCode
  }

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
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">
              評価テスト選択
              {subjectName && (
                <span className="ml-3 text-base font-semibold text-muted-foreground">({subjectName})</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">実施するテストを選択してください</p>
          </div>
          {userType === "teacher" && teacherRole !== "general" && teacherRole !== "" && (
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm" className="flex items-center gap-2 border-blue-500 text-blue-700 hover:bg-blue-50">
                <Shield className="w-4 h-4" />
                管理画面
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">実施日</th>
                  <th className="text-left py-2 px-3 font-medium">テスト名</th>
                  <th className="text-left py-2 px-3 font-medium">教科名</th>
                  <th className="text-left py-2 px-3 font-medium">作成日</th>
                  <th className="py-2 px-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr
                    key={test.id}
                    className="border-b last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleSelectTest(test.id)}
                  >
                    <td className="py-2 px-3 text-sm font-medium whitespace-nowrap">
                      {getTestDate(test)}
                    </td>
                    <td className="py-2 px-3 text-sm font-semibold text-primary">
                      {test.title}
                    </td>
                    <td className="py-2 px-3 text-sm text-muted-foreground">
                      {getSubjectName(test)}
                    </td>
                    <td className="py-2 px-3 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(test.createdAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Button size="sm" variant="default" className="h-7 text-xs px-3">
                        選択
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
