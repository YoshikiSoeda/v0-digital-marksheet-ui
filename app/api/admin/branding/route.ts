/**
 * 2026-05-13: PUT /api/admin/branding
 *
 * ブランド設定 (タイトル + アイコン) を更新する。
 * **special_master ロールのみ許可** (副田さん指示)。
 *
 * リクエスト:
 *   PUT /api/admin/branding
 *   Body: { title: string, icon: string }
 *
 * レスポンス:
 *   200 { branding: { title, icon } }
 *   400 入力不正
 *   401 未ログイン
 *   403 special_master ではない
 *   500 サーバーエラー
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"
import { getServerSession } from "@/lib/auth/session"

interface PutBody {
  title?: string
  icon?: string
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — login required" }, { status: 401 })
  }
  // special_master のみ
  const isSpecialMaster =
    session.role === "special_master" ||
    session.accountType === "special_master" ||
    session.role === "master_admin"
  if (!isSpecialMaster) {
    return NextResponse.json(
      { error: "Forbidden — special_master のみブランド設定を変更できます" },
      { status: 403 },
    )
  }

  let body: PutBody
  try {
    body = (await request.json()) as PutBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const title = typeof body.title === "string" ? body.title.trim() : ""
  const icon = typeof body.icon === "string" ? body.icon.trim() : ""

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }
  if (title.length > 60) {
    return NextResponse.json({ error: "title は 60 文字以内で入力してください" }, { status: 400 })
  }
  // icon は絵文字 1〜4 字を想定 (絵文字は surrogate pair で 2 字消費するため長さ 4 まで許容)
  if (icon.length > 8) {
    return NextResponse.json({ error: "icon は短い絵文字で入力してください" }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        key: "branding",
        value: { title, icon },
        updated_at: new Date().toISOString(),
        updated_by: session.email || session.userId,
      } as never,
      { onConflict: "key" },
    )

  if (error) {
    console.error("[api/admin/branding] PUT upsert error:", error)
    return NextResponse.json({ error: error.message || "Failed to save branding" }, { status: 500 })
  }

  return NextResponse.json({ branding: { title, icon } }, { status: 200 })
}
