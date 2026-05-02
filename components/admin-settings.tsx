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
import { useSession } from "@/lib/auth/use-session"

export function AdminSettings() {
  const [autoSave, setAutoSave] = useState(true)
  const [backupFormat, setBackupFormat] = useState("csv")
  const [isSpecialMaster, setIsSpecialMaster] = useState(false)
  const [universities, setUniversities] = useState<Array<{ code: string; name: string }>>([])
  const [selectedUniversity, setSelectedUniversity] = useState<string>("")
  const [testDuration, setTestDuration] = useState<Record<string, string>>({})
  const [maxUsers, setMaxUsers] = useState<Record<string, string>>({})
  const [testSessions, setTestSessions] = useState<any[]>([])
  const [passingScores, setPassingScores] = useState<Record<string, string>>({})
  const [savingPassingScore, setSavingPassingScore] = useState<string | null>(null)

  // Phase 9b-β2c: sessionStorage("accountType"|"universityCode") を useSession() に置換
  const { session, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading || !session) return
    const accountType = session.accountType
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
        .catch((err) => {})
    } else {
      setSelectedUniversity(session.universityCode || "")
    }

    // 試験セッション取得
    fetch("/api/test-sessions")
      .then((res) => res.json())
      .then((data) => {
        setTestSessions(data || [])
        const scores: Record<string, string> = {}
        ;(data || []).forEach((s: any) => {
          if (s.passing_score != null) {
            scores[s.id] = String(s.passing_score)
          }
        })
        setPassingScores(scores)
      })
      .catch((err) => {})
  }, [session, isSessionLoading])

  const handleSavePassingScore = async (sessionId: string) => {
    setSavingPassingScore(sessionId)
    try {
      const score = passingScores[sessionId]
      const res = await fetch(`/api/test-sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passing_score: score ? parseInt(score, 10) : null,
        }),
      })
      if (res.ok) {
        alert("合格ラインを保存しました")
      } else {
        alert("保存に失敗しました")
      }
    } catch (err) {
      alert("エラーが発生しました")
    } finally {
      setSavingPassingScore(null)
    }
  }

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
            <CardTitle>合格ライン設定</CardTitle>
            <CardDescription>試験セッションごとに合格ライン（教員側＋患者役側の合計点）を設定します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {testSessions
              .filter((s) => !selectedUniversity || s.university_code === selectedUniversity)
              .map((session) => (
                <div key={session.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{session.description || "(名称未設定)"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(session.test_date).toLocaleDateString("ja-JP")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      className="w-24 h-8 text-sm"
                      placeholder="未設定"
                      value={passingScores[session.id] || ""}
                      onChange={(e) => setPassingScores({ ...passingScores, [session.id]: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">点</span>
                    <Button
                      size="sm"
                      className="h-8 bg-[#00417A] hover:bg-[#00417A]/90"
                      onClick={() => handleSavePassingScore(session.id)}
                      disabled={savingPassingScore === session.id}
                    >
                      {savingPassingScore === session.id ? "..." : "保存"}
                    </Button>
                  </div>
                </div>
              ))}
            {testSessions.filter((s) => !selectedUniversity || s.university_code === selectedUniversity).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">試験セッションが登録されていません</p>
            )}
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
