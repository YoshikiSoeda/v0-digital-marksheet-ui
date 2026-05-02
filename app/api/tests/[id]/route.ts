/**
 * Phase 9c-2: GET /api/tests/[id]
 * Phase 9c-4: DELETE /api/tests/[id](cascade で sheets/categories/questions も削除)
 */
import { NextResponse, type NextRequest } from "next/server"
import { getServiceClient, requireAdmin } from "@/lib/api/_shared"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("tests")
    .select(`*, sheets:sheets ( *, categories:categories ( *, questions:questions (*) ) )`)
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ item: data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard
  const { id: testId } = await params
  const supabase = getServiceClient()

  const { data: sheets } = await supabase.from("sheets").select("id").eq("test_id", testId)
  if (sheets) {
    for (const sheet of sheets as Record<string, unknown>[]) {
      const sheetId = sheet.id as string
      const { data: categories } = await supabase.from("categories").select("id").eq("sheet_id", sheetId)
      if (categories) {
        for (const cat of categories as Record<string, unknown>[]) {
          await supabase.from("questions").delete().eq("category_id", cat.id as string)
        }
        await supabase.from("categories").delete().eq("sheet_id", sheetId)
      }
    }
    await supabase.from("sheets").delete().eq("test_id", testId)
  }

  const { error } = await supabase.from("tests").delete().eq("id", testId)
  if (error) {
    console.error("[api/tests/:id] DELETE error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
