/**
 * Phase 7+: GET / POST(single) for subjects.
 * Phase 9c-4: bulk upsert support added(items 配列を受ける場合は upsert)
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

export async function GET() {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("subject_code", { ascending: true })
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[api/subjects] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 })
  }
}

interface UpsertSubject {
  subjectCode?: string
  subject_code?: string
  subjectName?: string
  subject_name?: string
  universityCode?: string
  university_code?: string
  description?: string | null
  isActive?: boolean
  is_active?: boolean
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: UpsertSubject | { items?: UpsertSubject[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const items: UpsertSubject[] = Array.isArray((body as { items?: UpsertSubject[] }).items)
    ? (body as { items: UpsertSubject[] }).items
    : [body as UpsertSubject]

  // 互換: 単一 row 受領の場合は従来通り insert.select() で 1 行返す。
  // bulk(items 配列)の場合は upsert で OK 応答のみ。
  const isBulk = Array.isArray((body as { items?: UpsertSubject[] }).items)
  const supabase = getServiceClient()

  if (isBulk) {
    const rows = items.map((s) => ({
      subject_code: s.subjectCode || s.subject_code,
      subject_name: s.subjectName || s.subject_name,
      university_code: s.universityCode || s.university_code,
      description: s.description ?? null,
      is_active: s.isActive ?? s.is_active ?? true,
    }))
    const { error } = await supabase.from("subjects").upsert(rows as never, { onConflict: "subject_code" })
    if (error) {
      console.error("[api/subjects] POST bulk error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, upserted: rows.length })
  }

  // 旧来の単一 row insert
  const s = items[0]
  const { data, error } = await supabase
    .from("subjects")
    .insert([
      {
        subject_code: s.subjectCode || s.subject_code,
        subject_name: s.subjectName || s.subject_name,
        university_code: s.universityCode || s.university_code,
        description: s.description ?? null,
        is_active: s.isActive ?? s.is_active ?? true,
      },
    ] as never)
    .select()
  if (error) {
    console.error("[api/subjects] POST single error:", error)
    return NextResponse.json({ error: "Failed to create subject" }, { status: 500 })
  }
  return NextResponse.json(data?.[0] ?? null, { status: 201 })
}
