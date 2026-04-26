/**
 * Phase 8b: パスワードリセット API
 *
 * - email を受け取り、teachers / patients テーブルから対応行を探す
 * - 新しいパスワードを extensions.crypt(new_password, gen_salt('bf', 10)) で bcrypt 化して UPDATE
 * - サーバー側で service role key を使用するため、middleware の認証チェックは不要
 *   (このエンドポイントは PUBLIC_API_PATHS に登録)
 *
 * セキュリティ注意:
 * - このエンドポイントは未認証で叩ける = 任意 email のパスワードを書換できる状態
 * - 本来は「現パスワード確認」or「メール認証トークン」が必要
 * - 既存実装(client 側で loadTeachers() してパスワード書換)も同じリスクを抱えていたため、
 *   挙動は維持しつつ平文保存だけ解消する。本格的な保護は Phase 9 以降の課題。
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface ResetRequestBody {
  email?: string
  newPassword?: string
}

export async function POST(request: NextRequest) {
  let body: ResetRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const email = (body.email || "").trim()
  const newPassword = body.newPassword || ""

  if (!email || !newPassword) {
    return NextResponse.json(
      { error: "メールアドレスと新しいパスワードを入力してください" },
      { status: 400 },
    )
  }
  if (newPassword.length < 4) {
    return NextResponse.json(
      { error: "パスワードは4文字以上で入力してください" },
      { status: 400 },
    )
  }

  // 1. teachers から該当 email を探す
  const { data: teacherMatches } = await supabase
    .from("teachers")
    .select("id")
    .eq("email", email)

  if (Array.isArray(teacherMatches) && teacherMatches.length > 0) {
    // 同一 email が複数 test_session に紐づくため全部更新
    const ids = teacherMatches.map((t) => t.id)
    // bcrypt ハッシュは Supabase 側 RPC を使う(クライアントから crypt が呼べないため)
    const { error: hashErr } = await supabase.rpc("update_teacher_password_bulk", {
      p_ids: ids,
      p_new_password: newPassword,
    })
    if (hashErr) {
      console.error("[reset-password] teacher update error:", hashErr)
      return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, redirectTo: "/teacher/login" })
  }

  // 2. patients から該当 email を探す
  const { data: patientMatches } = await supabase
    .from("patients")
    .select("id")
    .eq("email", email)

  if (Array.isArray(patientMatches) && patientMatches.length > 0) {
    const ids = patientMatches.map((p) => p.id)
    const { error: hashErr } = await supabase.rpc("update_patient_password_bulk", {
      p_ids: ids,
      p_new_password: newPassword,
    })
    if (hashErr) {
      console.error("[reset-password] patient update error:", hashErr)
      return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, redirectTo: "/patient/login" })
  }

  return NextResponse.json(
    { error: "登録されていないメールアドレスです" },
    { status: 404 },
  )
}
