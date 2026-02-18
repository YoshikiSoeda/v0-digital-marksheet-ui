import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase.from("universities").select("*").order("university_code")

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Failed to fetch universities:", error)
    return NextResponse.json({ error: "Failed to fetch universities" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { university_code, university_name, department_name } = body

    const { data, error } = await supabase
      .from("universities")
      .insert({
        university_code,
        university_name,
        department_name,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Failed to create university:", error)
    return NextResponse.json({ error: "Failed to create university" }, { status: 500 })
  }
}
