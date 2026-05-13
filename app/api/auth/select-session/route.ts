/**
 * 2026-05-13: 試験セッション切替で Cookie の assignedRoomNumber / testSessionId を更新する
 * エンドポイント。
 *
 * 背景:
 *   ログイン時に Cookie へ書き込まれる assignedRoomNumber は、login で選んだ 1 つの
 *   session の room しか反映しない。test-selection-screen で別 session を選んだ場合、
 *   Cookie の room は古いまま (PR #102 useExamPageGuard が古い room を前提に
 *   "セッション情報が不完全です" と誤判定する原因)。
 *
 *   本エンドポイントは、現在の Cookie から user_id を取り出し、リクエストの
 *   testSessionId に対応する assignment を junction から引いて Cookie を更新する。
 *
 * リクエスト:
 *   POST /api/auth/select-session
 *   Body: { testSessionId: string }
 *
 * レスポンス:
 *   200 { user: { ...更新後 } }
 *   401 未ログイン
 *   404 該当 session の assignment がない
 *   500 サーバーエラー
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/session"
import { attachLoginCookie } from "@/lib/auth/http-cookie"
import { getServiceClient } from "@/lib/api/_shared"

interface RequestBody {
  testSessionId?: string
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — login required" }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const testSessionId = (body.testSessionId || "").trim()
  if (!testSessionId) {
    return NextResponse.json({ error: "testSessionId is required" }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 教員 / 患者役: 自分の assignment を junction から引く
  // admin login type には room の概念がないので、testSessionId だけ更新する
  let nextRoom = ""
  if (session.loginType === "teacher") {
    const { data, error } = await supabase
      .from("teacher_test_session_assignments")
      .select("assigned_room_number")
      .eq("teacher_id", session.userId)
      .eq("test_session_id", testSessionId)
      .maybeSingle()
    if (error) {
      console.error("[auth/select-session] teacher junction lookup error:", error)
      return NextResponse.json({ error: "Failed to load assignment" }, { status: 500 })
    }
    nextRoom = ((data as Record<string, unknown> | null)?.assigned_room_number as string) || ""
  } else if (session.loginType === "patient") {
    const { data, error } = await supabase
      .from("patient_test_session_assignments")
      .select("assigned_room_number")
      .eq("patient_id", session.userId)
      .eq("test_session_id", testSessionId)
      .maybeSingle()
    if (error) {
      console.error("[auth/select-session] patient junction lookup error:", error)
      return NextResponse.json({ error: "Failed to load assignment" }, { status: 500 })
    }
    nextRoom = ((data as Record<string, unknown> | null)?.assigned_room_number as string) || ""
  } else {
    // admin: room 概念なし。testSessionId だけ更新する。
    nextRoom = session.assignedRoomNumber
  }

  // 患者役 / 一般教員で assignment が無い場合は 404 を返す (admin 兼任ロールは素通し)
  const ELEVATED_ROLES = new Set(["master_admin", "university_admin", "subject_admin"])
  const isElevated = ELEVATED_ROLES.has(session.role)
  if (session.loginType === "patient" && !nextRoom) {
    return NextResponse.json(
      {
        error:
          "このセッションへの割り当てがありません。管理者に部屋への割当を依頼してください。",
      },
      { status: 404 },
    )
  }
  if (session.loginType === "teacher" && !nextRoom && !isElevated) {
    return NextResponse.json(
      {
        error: "このセッションへの担当部屋割当がありません。管理者に依頼してください。",
      },
      { status: 404 },
    )
  }

  // Cookie を更新
  const response = NextResponse.json(
    {
      user: {
        loginType: session.loginType,
        role: session.role,
        userId: session.userId,
        userName: session.userName,
        email: session.email,
        accountType: session.accountType,
        universityCode: session.universityCode,
        subjectCode: session.subjectCode,
        testSessionId,
        assignedRoomNumber: nextRoom,
      },
    },
    { status: 200 },
  )

  attachLoginCookie(response, {
    loginType: session.loginType,
    role: session.role,
    userId: session.userId,
    userName: session.userName,
    email: session.email,
    assignedRoomNumber: nextRoom,
    universityCode: session.universityCode,
    universityCodes: session.universityCodes,
    subjectCode: session.subjectCode,
    testSessionId,
    accountType: session.accountType,
  })

  return response
}
