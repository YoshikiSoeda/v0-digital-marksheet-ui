import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: "", ...options })
          },
        },
      },
    )

    const searchParams = request.nextUrl.searchParams
    const universityCode = searchParams.get("university_code")
    const subjectCode = searchParams.get("subject_code")

    let query = supabase.from("test_sessions").select("*").order("test_date", { ascending: false })

    if (universityCode && universityCode !== "ALL") {
      query = query.eq("university_code", universityCode)
    }

    if (subjectCode && subjectCode !== "all") {
      query = query.eq("subject_code", subjectCode)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Test sessions API error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error("[v0] Test sessions API exception:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: "", ...options })
          },
        },
      },
    )

    const body = await request.json()

    const { data, error } = await supabase
      .from("test_sessions")
      .insert({
        test_code: body.test_code,
        test_date: body.test_date,
        description: body.description,
        university_code: body.university_code,
        subject_code: body.subject_code || null,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Create test session error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("[v0] Create test session exception:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
