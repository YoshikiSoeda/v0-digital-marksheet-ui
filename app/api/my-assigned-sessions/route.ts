/**
 * 2026-07-10 副田さん報告: 教員 (general / subject_admin) が自教科でない試験
 *   セッションでも「割当されていれば参加できる」ようにしたい。
 *
 * 本 API は login 中の教員/患者役に紐付く全 test_session_id を返す。
 * client の /admin ではない場所 (試験選択画面) が subject フィルタを
 * 素通しさせるかどうかの判定に使う。
 *
 * GET /api/my-assigned-sessions
 *   → { sessionIds: string[] }
 *   admin / master 系ログインの場合は空配列 (client 側で「制限なし」扱い)。
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/session"
import { getServiceClient } from "@/lib/api/_shared"

export async function GET() {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loginType = session.loginType
  if (loginType !== "teacher" && loginType !== "patient") {
    return NextResponse.json({ sessionIds: [] })
  }

  const userId = session.userId
  if (!userId) {
    return NextResponse.json({ sessionIds: [] })
  }

  const supabase = getServiceClient()
  const junction =
    loginType === "teacher"
      ? "teacher_test_session_assignments"
      : "patient_test_session_assignments"
  const idKey = loginType === "teacher" ? "teacher_id" : "patient_id"

  const { data, error } = await supabase
    .from(junction)
    .select("test_session_id")
    .eq(idKey, userId)

  if (error) {
    console.error("[my-assigned-sessions] error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sessionIds = Array.from(
    new Set(
      (data || [])
        .map((a) => (a as { test_session_id?: string }).test_session_id)
        .filter((s): s is string => Boolean(s)),
    ),
  )
  return NextResponse.json({ sessionIds })
}
