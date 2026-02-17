import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { universities } = body

    const { data, error } = await supabase
      .from("universities")
      .upsert(universities, {
        onConflict: "university_code",
      })
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, count: data.length })
  } catch (error) {
    console.error("Failed to bulk upload universities:", error)
    return NextResponse.json({ error: "Failed to bulk upload universities" }, { status: 500 })
  }
}
