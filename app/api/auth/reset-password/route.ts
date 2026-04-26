/**
 * Phase 8c: パスワード変更 API (公開エンドポイント)
 *
 * - middleware の PUBLIC_API_PATHS に追加されており、未ログインで呼べる
 * - service role で `update_user_password(p_email, p_password)` RPC を呼ぶ
 * - RPC 内部で teachers → patients の順に email 検索し、見つかった方を hash 化して UPDATE
 *
 * 注意: 認証なしの公開エンドポイントなので、リソース消費を抑えるため最低限の
 *      バリデーションのみ。将来的にメール所有確認などを足すこと。
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface ResetPasswordRequestBody {
  email?: string
  newPassword?: string
}

export async function POST(request: NextRequest) {
  let body: ResetPasswordRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const email = (body.email || "").trim()
  const newPassword = body.newPassword || ""

  if (!email || !newPassword) {
    return NextResponse.json(
      { error: "email と newPassword は必須です" },
      { status: 400 },
    )
  }
  if (newPassword.length < 4) {
    return NextResponse.json(
      { error: "パスワードは4文字以上で入力してください" },
      { status: 400 },
    )
  }

  const { data, error } = await supabase.rpc("update_user_password", {
    p_email: email,
    p_password: newPassword,
  })
  if (error) {
    console.error("[api/auth/reset-password] RPC error:", error)
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    )
  }

  // RPC 戻値: { updated: 'teachers'|'patients'|null, rows: N }
  const result = (data ?? {}) as { updated?: string | null; rows?: number }
  if (!result.updated) {
    return NextResponse.json(
      { error: "登録されていないメールアドレスです" },
      { status: 404 },
    )
  }

  return NextResponse.json(
    { updated: result.updated, rows: result.rows ?? 0 },
    { status: 200 },
  )
}
