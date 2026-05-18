/**
 * 2026-05-13: GET /api/branding (public)
 *
 * app_settings.branding を読んで { title, icon } を返す。
 * 未ログイン画面 (/login) でもヘッダーで表示するため middleware で public 化。
 * 書き込みは PUT /api/admin/branding (special_master のみ) で別エンドポイント。
 */
import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"

export interface Branding {
  title: string
  icon: string
}

const DEFAULT_BRANDING: Branding = {
  title: "医療面接評価システム",
  icon: "🏥",
}

export async function GET() {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "branding")
    .maybeSingle()

  if (error) {
    console.error("[api/branding] GET error:", error)
    // 失敗時もデフォルトを返してアプリ動作を継続
    return NextResponse.json({ branding: DEFAULT_BRANDING }, { status: 200 })
  }

  const raw = (data as Record<string, unknown> | null)?.value as Partial<Branding> | undefined
  const branding: Branding = {
    title: typeof raw?.title === "string" && raw.title ? raw.title : DEFAULT_BRANDING.title,
    icon: typeof raw?.icon === "string" && raw.icon ? raw.icon : DEFAULT_BRANDING.icon,
  }
  // ブラウザに 60 秒キャッシュ (頻繁更新しない設定なので OK)
  return NextResponse.json(
    { branding },
    { status: 200, headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
  )
}
