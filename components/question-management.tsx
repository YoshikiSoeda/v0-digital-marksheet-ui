"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { loadTests, saveTests, type Test } from "@/lib/data-storage"
import { useRouter } from "next/navigation"

export function QuestionManagement() {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const fetchTests = async () => {
      const loadedTests = await loadTests()
      setTests(Array.isArray(loadedTests) ? loadedTests : [])
    }
    fetchTests()
  }, [])

  const filteredTests = tests.filter((test) => test.title.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleDelete = async (testId: string) => {
    if (!confirm("このテストを削除してもよろしいですか？")) return

    const updatedTests = tests.filter((t) => t.id !== testId)
    setTests(updatedTests)
    await saveTests(updatedTests)
  }

  const handleCreateNew = () => {
    router.push("/admin/question-management/create")
  }

  const handleEdit = (testId: string) => {
    router.push(`/admin/question-management/edit/${testId}`)
  }

  return (
    <div className="min-h-screen bg-[#E5EFFC] p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                ダッシュボードに戻る
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#00417A]">問題管理</h1>
          </div>
          <Button onClick={handleCreateNew} className="bg-[#00417A] hover:bg-[#00417A]/90">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>テスト一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="テスト名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>

            {filteredTests.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                {searchTerm
                  ? "検索結果が見つかりませんでした"
                  : "テストが登録されていません。新規作成ボタンから作成してください。"}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTests.map((test) => (
                  <div key={test.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
                    <div>
                      <h3 className="font-semibold text-[#00417A]">{test.title}</h3>
                      <p className="text-sm text-gray-500">
                        シート数: {test.sheets.length} | 作成日: {new Date(test.createdAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(test.id)}>
                        <Edit className="mr-1 h-4 w-4" />
                        編集
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(test.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        削除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
