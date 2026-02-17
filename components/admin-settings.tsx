"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function AdminSettings() {
  const [autoSave, setAutoSave] = useState(true)
  const [backupFormat, setBackupFormat] = useState("csv")
  const [isSpecialMaster, setIsSpecialMaster] = useState(false)
  const [universities, setUniversities] = useState<Array<{ code: string; name: string }>>([])
  const [selectedUniversity, setSelectedUniversity] = useState<string>("")
  const [testDuration, setTestDuration] = useState<Record<string, string>>({})
  const [maxUsers, setMaxUsers] = useState<Record<string, string>>({})

  useEffect(() => {
    const accountType = sessionStorage.getItem("accountType")
    setIsSpecialMaster(accountType === "special_master")

    if (accountType === "special_master") {
      fetch("/api/universities")
        .then((res) => res.json())
        .then((data) => {
          const universityList: Array<{ code: string; name: string }> = []
          data.forEach((uni: any) => {
            universityList.push({ code: uni.university_code, name: uni.university_name })
          })
          setUniversities(universityList)
          if (universityList.length > 0) {
            setSelectedUniversity(universityList[0].code)
          }
        })
        .catch((err) => console.error("[v0] Failed to fetch universities:", err))
    } else {
      const universityCode = sessionStorage.getItem("universityCode") || ""
      setSelectedUniversity(universityCode)
    }
  }, [])

  const currentTestDuration = testDuration[selectedUniversity] || "90"
  const currentMaxUsers = maxUsers[selectedUniversity] || "1000"

  const handleTestDurationChange = (value: string) => {
    setTestDuration({ ...testDuration, [selectedUniversity]: value })
  }

  const handleMaxUsersChange = (value: string) => {
    setMaxUsers({ ...maxUsers, [selectedUniversity]: value })
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-primary">システム設定</h1>
          <p className="text-muted-foreground">試験システムの設定を管理</p>
        </div>

        {isSpecialMaster && (
          <Card>
            <CardHeader>
              <CardTitle>大学選択</CardTitle>
              <CardDescription>設定を変更する大学を選択してください</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {universities.map((uni) => (
                    <SelectItem key={uni.code} value={uni.code}>
                      {uni.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>試験設定</CardTitle>
            <CardDescription>
              {isSpecialMaster && selectedUniversity
                ? `${universities.find((u) => u.code === selectedUniversity)?.name || ""} の試験時間と制限の設定`
                : "試験時間と制限の設定"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="duration">試験時間（分）</Label>
              <Input
                id="duration"
                type="number"
                placeholder="90"
                value={currentTestDuration}
                onChange={(e) => handleTestDurationChange(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">試験の制限時間を設定してください</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUsers">同時アクセス上限</Label>
              <Input
                id="maxUsers"
                type="number"
                placeholder="1000"
                value={currentMaxUsers}
                onChange={(e) => handleMaxUsersChange(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">同時に受験可能な人数の上限</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>データ管理</CardTitle>
            <CardDescription>バックアップと保存の設定</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="autoSave">通信切断時の自動保存</Label>
                <p className="text-sm text-muted-foreground">接続が切れた場合に回答を自動保存</p>
              </div>
              <Switch id="autoSave" checked={autoSave} onCheckedChange={setAutoSave} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backup">データバックアップ形式</Label>
              <Select value={backupFormat} onValueChange={setBackupFormat}>
                <SelectTrigger id="backup">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="both">両方</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">データをエクスポートする際のファイル形式</p>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg">
          <Save className="w-4 h-4 mr-2" />
          設定を保存
        </Button>
      </div>
    </div>
  )
}
