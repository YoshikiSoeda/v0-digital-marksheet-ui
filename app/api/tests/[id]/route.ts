import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("tests")
    .select(`
      *,
      sheets:sheets ( *, categories:categories ( *, questions:questions (*) ) )
    `)
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // Reuse list mapping logic — or inline shorter version (id only path is rarely used)
  return NextResponse.json({ item: data })
}
