/**
 * PUT /api/admin/branding
 *
 * 大学ごとのブランド設定 (タイトル + アイコン) を更新する。
 *
 * 権限:
 *   - special_master: 全大学の branding を更新可
 *   - university_master / university_admin: 自大学のみ更新可
 *   - その他: 403
 *
 * リクエスト:
 *   PUT /api/admin/branding
 *   Body: { universityCode: string, title: string, icon: string }
 *
 * レスポンス:
 *   200 { universityCode, branding: { title, icon } }
 *   400 入力不正
 *   401 未ログイン
 *   403 権限不足 (special_master でないのに他大学を指定 / 編集権限ロールでない)
 *   500 サーバーエラー
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"
import { getServerSession } from "@/lib/auth/session"

interface PutBody {
  universityCode?: string
  title?: string
  icon?: string
}

const SPECIAL_MASTER_KEYS = new Set(["special_master", "master_admin"])
const UNIVERSITY_MASTER_KEYS = new Set(["university_master", "university_admin"])

export async function PUT(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — login required" }, { status: 401 })
  }

  const isSpecialMaster = SPECIAL_MASTER_KEYS.has(session.role) || SPECIAL_MASTER_KEYS.has(session.accountType)
  const isUniversityMaster = UNIVERSITY_MASTER_KEYS.has(session.role) || UNIVERSITY_MASTER_KEYS.has(session.accountType)

  if (!isSpecialMaster && !isUniversityMaster) {
    return NextResponse.json(
      { error: "Forbidden — スーパーマスター または 大学管理者 のみブランド設定を変更できます" },
      { status: 403 },
    )
  }

  let body: PutBody
  try {
    body = (await request.json()) as PutBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const universityCode = typeof body.universityCode === "string" ? body.universityCode.trim() : ""
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const icon = typeof body.icon === "string" ? body.icon.trim() : ""

  if (!universityCode) {
    return NextResponse.json({ error: "universityCode is required" }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }
  if (title.length > 60) {
    return NextResponse.json({ error: "title は 60 文字以内で入力してください" }, { status: 400 })
  }
  if (icon.length > 8) {
    return NextResponse.json({ error: "icon は短い絵文字で入力してください" }, { status: 400 })
  }

  // university_master / university_admin は自大学のみ
  if (!isSpecialMaster && universityCode !== session.universityCode) {
    return NextResponse.json(
      { error: `Forbidden — 大学管理者は自大学 (${session.universityCode}) のブランドのみ変更できます` },
      { status: 403 },
    )
  }

  const supabase = getServiceClient()
  // 2026-05-13 (改訂): 既存の iconUrl 等は保持してマージ更新する
  const { data: existing } = await supabase
    .from("universities")
    .select("branding")
    .eq("university_code", universityCode)
    .maybeSingle()
  const oldBranding = ((existing as Record<string, unknown> | null)?.branding as Record<string, unknown>) || {}
  const merged = { ...oldBranding, title, icon }

  const { data, error } = await supabase
    .from("universities")
    .update({ branding: merged } as never)
    .eq("university_code", universityCode)
    .select("university_code")
    .maybeSingle()

  if (error) {
    console.error("[api/admin/branding] PUT update error:", error)
    return NextResponse.json({ error: error.message || "Failed to save branding" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: `university_code が見つかりません: ${universityCode}` }, { status: 404 })
  }

  return NextResponse.json(
    { universityCode, branding: merged },
    { status: 200 },
  )
}
