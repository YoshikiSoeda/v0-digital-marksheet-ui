/**
 * GET /api/branding?university_code=xxx (public, middleware で許可)
 *
 * 大学ごとのブランド設定 (タイトル + アイコン) を返す。
 * university_code 未指定 or 該当大学の branding が NULL の場合は
 * デフォルト「医療面接評価システム」「🏥」を返す。
 *
 * 副田さん指示 (2026-05-13 追加開発):
 *   「大学ごとに設定できる、デフォルトは医療面接評価システム」
 *
 * 書き込みは PUT /api/admin/branding (university_master / special_master のみ)。
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"

export interface Branding {
  title: string
  icon: string
}

const DEFAULT_BRANDING: Branding = {
  title: "医療面接評価システム",
  icon: "🏥",
}

export async function GET(request: NextRequest) {
  const universityCode = request.nextUrl.searchParams.get("university_code") || ""

  // 大学指定なし → 即デフォルト (top page など)
  if (!universityCode) {
    return NextResponse.json(
      { branding: DEFAULT_BRANDING },
      { status: 200, headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    )
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("universities")
    .select("branding")
    .eq("university_code", universityCode)
    .maybeSingle()

  if (error) {
    console.error("[api/branding] GET error:", error)
    // 失敗時もデフォルトを返してアプリ動作を継続
    return NextResponse.json({ branding: DEFAULT_BRANDING }, { status: 200 })
  }

  const raw = (data as Record<string, unknown> | null)?.branding as Partial<Branding> | null | undefined
  const branding: Branding = {
    title: typeof raw?.title === "string" && raw.title ? raw.title : DEFAULT_BRANDING.title,
    icon: typeof raw?.icon === "string" && raw.icon ? raw.icon : DEFAULT_BRANDING.icon,
  }
  return NextResponse.json(
    { branding },
    { status: 200, headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
  )
}
