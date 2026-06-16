/**
 * HOTFIX: Phase 9 RLS 有効化後、anon key では SELECT が 0 行になるため
 * service role(getServiceClient)に切替。
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient()
    const searchParams = request.nextUrl.searchParams
    const universityCode = searchParams.get("university_code")
    const subjectCode = searchParams.get("subject_code")

    let query = supabase
      .from("test_sessions")
      .select("*")
      .order("test_date", { ascending: false })

    if (universityCode && universityCode !== "ALL") {
      query = query.eq("university_code", universityCode)
    }
    if (subjectCode && subjectCode !== "all") {
      query = query.eq("subject_code", subjectCode)
    }

    const { data, error } = await query
    if (error) {
      console.error("[api/test-sessions] GET error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data || [])
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[api/test-sessions] GET exception:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard
  try {
    const supabase = getServiceClient()
    const body = await request.json()
    // 2026-05-20 副田さん仕様 (PR #138/#139): 試験セッションは subject_code 必須
    // クライアント (question-create / question-management) で必須化済みだが、
    // 直接 API を叩かれた場合も弾けるよう server side でも validation する。
    if (!body.description || !body.test_date || !body.university_code) {
      return NextResponse.json(
        { error: "description / test_date / university_code は必須です" },
        { status: 400 },
      )
    }
    if (!body.subject_code) {
      return NextResponse.json(
        { error: "subject_code は必須です (試験セッションは教科に属する必要があります)" },
        { status: 400 },
      )
    }
    const { data, error } = await supabase
      .from("test_sessions")
      .insert({
        test_date: body.test_date,
        description: body.description,
        university_code: body.university_code,
        subject_code: body.subject_code,
        passing_score: body.passing_score ?? null,
        duration_minutes: body.duration_minutes ?? null,
      } as never)
      .select()
      .single()
    if (error) {
      console.error("[api/test-sessions] POST error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
