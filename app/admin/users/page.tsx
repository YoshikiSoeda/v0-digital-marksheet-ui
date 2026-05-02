"use client"

/**
 * Phase 9d-4b: /admin/users 一覧統合(教員 + 患者役)
 *
 * ADR-001 §7-2(b) で確定した B-modified の一覧側。タブで教員・患者役を切り替えて
 * 横断的に確認できる "at-a-glance" 画面。
 *
 * 既存の /admin/teachers-list, /admin/patients-list は残置(編集・削除・CSV 出力等の
 * リッチ機能が要るときの詳細管理画面として継続)。本画面は閲覧+詳細管理画面への
 * 動線提供が役割。
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, UserCog, Search, ExternalLink, Plus, Filter } from "lucide-react"
import { useSession } from "@/lib/auth/use-session"
import { listTeachers } from "@/lib/api/teachers"
import { listPatients } from "@/lib/api/patients"
import { listSubjects } from "@/lib/api/subjects"
import type { Teacher, Patient, Subject } from "@/lib/types"

const TEACHER_ROLE_LABELS: Record<string, string> = {
  master_admin: "マスター管理者",
  university_admin: "大学管理者",
  subject_admin: "教科責任者",
  general: "一般教員",
}

const TEACHER_ROLE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  master_admin: "destructive",
  university_admin: "default",
  subject_admin: "secondary",
  general: "outline",
}

export default function AdminUsersPage() {
  const { session, isLoading: isSessionLoading } = useSession()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [search, setSearch] = useState("")
  const [subjectFilter, setSubjectFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isSessionLoading || !session) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const isMaster = session.accountType === "special_master"
        const universityCode = isMaster ? undefined : session.universityCode
        const [t, p, s] = await Promise.all([
          listTeachers({ universityCode }),
          listPatients({ universityCode }),
          listSubjects(isMaster ? {} : { universityCode }),
        ])
        setTeachers(t)
        setPatients(p)
        setSubjects(s)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [session, isSessionLoading])

  const subjectName = (code?: string): string => {
    if (!code) return "—"
    const found = subjects.find((s) => s.subjectCode === code)
    return found?.subjectName || code
  }

  const matchSearch = (s: string): boolean => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.toLowerCase().includes(q)
  }

  const filteredTeachers = teachers.filter((t) => {
    if (!matchSearch(`${t.name} ${t.email}`)) return false
    if (subjectFilter !== "all" && t.subjectCode !== subjectFilter) return false
    return true
  })
  const filteredPatients = patients.filter((p) => {
    if (!matchSearch(`${p.name} ${p.email}`)) return false
    if (subjectFilter !== "all" && p.subjectCode !== subjectFilter) return false
    return true
  })

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">ユーザー一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            教員と患者役を横断的に確認できます。詳細編集は各タブ右上の「詳細管理」から。
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button>
            <Plus className="w-4 h-4 mr-1.5" />
            ユーザー追加
          </Button>
        </Link>
      </div>

      {/* フィルタ */}
      <Card className="mb-4">
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="氏名・メールで検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">全ての教科</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.subjectCode}>
                  {s.subjectName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="teachers" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="teachers" className="flex items-center gap-1.5">
            <UserCog className="w-4 h-4" />
            教員 <Badge variant="outline" className="ml-1 text-xs">{filteredTeachers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="patients" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            患者役 <Badge variant="outline" className="ml-1 text-xs">{filteredPatients.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg">教員一覧</CardTitle>
                <CardDescription>役割・担当教科・担当部屋を確認</CardDescription>
              </div>
              <Link href="/admin/teachers-list">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  詳細管理
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-center text-muted-foreground">読み込み中…</p>
              ) : filteredTeachers.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">該当する教員はいません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">氏名</th>
                        <th className="text-left py-2 px-3 font-medium">メール</th>
                        <th className="text-left py-2 px-3 font-medium">役割</th>
                        <th className="text-left py-2 px-3 font-medium">担当教科</th>
                        <th className="text-left py-2 px-3 font-medium">担当部屋</th>
                        {session?.accountType === "special_master" && (
                          <th className="text-left py-2 px-3 font-medium">大学</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeachers.map((t) => (
                        <tr key={t.id} className="border-t hover:bg-accent/30">
                          <td className="py-2 px-3 font-medium">{t.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{t.email}</td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={TEACHER_ROLE_VARIANT[t.role] || "outline"}
                              className="text-xs"
                            >
                              {TEACHER_ROLE_LABELS[t.role] || t.role}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">{subjectName(t.subjectCode)}</td>
                          <td className="py-2 px-3">{t.assignedRoomNumber || "—"}</td>
                          {session?.accountType === "special_master" && (
                            <td className="py-2 px-3 text-muted-foreground">
                              {t.universityCode || "—"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patients" className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg">患者役一覧</CardTitle>
                <CardDescription>担当教科・担当部屋を確認</CardDescription>
              </div>
              <Link href="/admin/patients-list">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  詳細管理
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-center text-muted-foreground">読み込み中…</p>
              ) : filteredPatients.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">該当する患者役はいません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">氏名</th>
                        <th className="text-left py-2 px-3 font-medium">メール</th>
                        <th className="text-left py-2 px-3 font-medium">担当教科</th>
                        <th className="text-left py-2 px-3 font-medium">担当部屋</th>
                        {session?.accountType === "special_master" && (
                          <th className="text-left py-2 px-3 font-medium">大学</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((p) => (
                        <tr key={p.id} className="border-t hover:bg-accent/30">
                          <td className="py-2 px-3 font-medium">{p.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{p.email}</td>
                          <td className="py-2 px-3">{subjectName(p.subjectCode)}</td>
                          <td className="py-2 px-3">{p.assignedRoomNumber || "—"}</td>
                          {session?.accountType === "special_master" && (
                            <td className="py-2 px-3 text-muted-foreground">
                              {p.universityCode || "—"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
