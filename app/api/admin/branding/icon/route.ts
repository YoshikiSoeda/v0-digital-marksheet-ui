/**
 * POST   /api/admin/branding/icon  — 画像アップロード
 * DELETE /api/admin/branding/icon  — アップロード済み画像をクリア (絵文字に戻す)
 *
 * 権限:
 *   - special_master: 全大学
 *   - university_master / university_admin: 自大学のみ
 *
 * 保存先: Supabase Storage バケット "branding-icons"、
 *         オブジェクト名 "<university_code>/<timestamp>.<ext>"
 *
 * POST body: multipart/form-data
 *   - universityCode (form field): string
 *   - file: image/png | image/jpeg | image/svg+xml | image/webp
 *
 * レスポンス (POST):
 *   200 { universityCode, iconUrl }
 *   400 入力不正 / type 不一致 / size 超過
 *   401 未ログイン
 *   403 権限不足
 *   500 サーバーエラー
 *
 * DELETE query: ?universityCode=xxx
 *   200 { universityCode, iconUrl: null }
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"
import { getServerSession } from "@/lib/auth/session"

const SPECIAL_MASTER_KEYS = new Set(["special_master", "master_admin"])
const UNIVERSITY_MASTER_KEYS = new Set(["university_master", "university_admin"])
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"])
const MAX_BYTES = 1024 * 1024 // 1 MB
const BUCKET = "branding-icons"

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png": return "png"
    case "image/jpeg": return "jpg"
    case "image/svg+xml": return "svg"
    case "image/webp": return "webp"
    default: return "bin"
  }
}

async function authorize(request: NextRequest): Promise<
  | { ok: true; isSpecialMaster: boolean; universityCode: string }
  | { ok: false; status: number; error: string }
> {
  const session = await getServerSession()
  if (!session) {
    return { ok: false, status: 401, error: "Unauthorized — login required" }
  }
  const isSpecialMaster =
    SPECIAL_MASTER_KEYS.has(session.role) || SPECIAL_MASTER_KEYS.has(session.accountType)
  const isUniversityMaster =
    UNIVERSITY_MASTER_KEYS.has(session.role) || UNIVERSITY_MASTER_KEYS.has(session.accountType)
  if (!isSpecialMaster && !isUniversityMaster) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden — スーパーマスター または 大学管理者 のみアイコン画像を変更できます",
    }
  }
  void request
  return { ok: true, isSpecialMaster, universityCode: session.universityCode }
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 })
  }

  const universityCode = (form.get("universityCode") as string | null)?.trim() || ""
  const file = form.get("file") as File | null

  if (!universityCode) {
    return NextResponse.json({ error: "universityCode is required" }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }

  // university_master / university_admin は自大学のみ
  if (!auth.isSpecialMaster && universityCode !== auth.universityCode) {
    return NextResponse.json(
      { error: `Forbidden — 大学管理者は自大学 (${auth.universityCode}) のアイコンのみ変更できます` },
      { status: 403 },
    )
  }

  const mime = file.type || "application/octet-stream"
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `許可されていないファイル形式です (${mime}). PNG / JPEG / SVG / WEBP のみ` },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `ファイルサイズが大きすぎます (${file.size} bytes > ${MAX_BYTES})` },
      { status: 400 },
    )
  }

  const supabase = getServiceClient()
  const objectName = `${universityCode}/${Date.now()}.${extensionFor(mime)}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(objectName, buffer, {
    contentType: mime,
    cacheControl: "60",
    upsert: false,
  })
  if (uploadErr) {
    console.error("[api/admin/branding/icon] storage upload error:", uploadErr)
    return NextResponse.json({ error: uploadErr.message || "Failed to upload" }, { status: 500 })
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectName)
  const iconUrl = pub?.publicUrl
  if (!iconUrl) {
    return NextResponse.json({ error: "Failed to resolve public URL" }, { status: 500 })
  }

  // 既存の universities.branding をマージしつつ iconUrl を更新
  const { data: existing } = await supabase
    .from("universities")
    .select("branding")
    .eq("university_code", universityCode)
    .maybeSingle()
  const oldBranding = ((existing as Record<string, unknown> | null)?.branding as Record<string, unknown>) || {}
  const merged = { ...oldBranding, iconUrl }

  const { error: updateErr } = await supabase
    .from("universities")
    .update({ branding: merged } as never)
    .eq("university_code", universityCode)
  if (updateErr) {
    console.error("[api/admin/branding/icon] universities update error:", updateErr)
    return NextResponse.json({ error: updateErr.message || "Failed to save iconUrl" }, { status: 500 })
  }

  return NextResponse.json({ universityCode, iconUrl }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const universityCode = (request.nextUrl.searchParams.get("universityCode") || "").trim()
  if (!universityCode) {
    return NextResponse.json({ error: "universityCode is required" }, { status: 400 })
  }
  if (!auth.isSpecialMaster && universityCode !== auth.universityCode) {
    return NextResponse.json(
      { error: `Forbidden — 大学管理者は自大学 (${auth.universityCode}) のアイコンのみ変更できます` },
      { status: 403 },
    )
  }

  const supabase = getServiceClient()
  const { data: existing } = await supabase
    .from("universities")
    .select("branding")
    .eq("university_code", universityCode)
    .maybeSingle()
  const oldBranding = ((existing as Record<string, unknown> | null)?.branding as Record<string, unknown>) || {}
  // 物件削除は best-effort (オブジェクトパスを iconUrl から導けるが、複数履歴があり得るのでスキップ)
  const merged = { ...oldBranding, iconUrl: null }

  const { error: updateErr } = await supabase
    .from("universities")
    .update({ branding: merged } as never)
    .eq("university_code", universityCode)
  if (updateErr) {
    console.error("[api/admin/branding/icon] DELETE update error:", updateErr)
    return NextResponse.json({ error: updateErr.message || "Failed to clear iconUrl" }, { status: 500 })
  }

  return NextResponse.json({ universityCode, iconUrl: null }, { status: 200 })
}
