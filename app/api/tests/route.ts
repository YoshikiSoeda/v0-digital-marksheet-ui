/**
 * Phase 9c-2: GET /api/tests
 * フィルタ: universityCode, subjectCode
 *
 * tests + sheets + categories + questions の入れ子構造を一度に返す
 * (loadTests と同じ形)。
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery } from "@/lib/api/_shared"

export async function GET(request: NextRequest) {
  const filters = parseListQuery(request, ["universityCode", "subjectCode"] as const)
  const supabase = getServiceClient()

  let query = supabase
    .from("tests")
    .select(`
      *,
      sheets:sheets (
        *,
        categories:categories (
          *,
          questions:questions (*)
        )
      )
    `)
    .order("created_at", { ascending: true })
  if (filters.universityCode) query = query.eq("university_code", filters.universityCode)
  if (filters.subjectCode) query = query.eq("subject_code", filters.subjectCode)

  const { data, error } = await query
  if (error) {
    console.error("[api/tests] error:", error)
    return NextResponse.json({ error: "Failed to load tests" }, { status: 500 })
  }
  const items = (data || []).map((test: Record<string, unknown>) => ({
    id: test.id as string,
    title: test.title as string,
    testSessionId: test.test_session_id as string | undefined,
    subjectCode: test.subject_code as string | undefined,
    roleType: (test.role_type as string) || "teacher",
    sheets: ((test.sheets as Record<string, unknown>[]) || []).map((sheet) => ({
      id: sheet.id as string,
      title: sheet.title as string,
      categories: ((sheet.categories as Record<string, unknown>[]) || [])
        .sort((a, b) => (a.number as number) - (b.number as number))
        .map((category) => ({
          id: category.id as string,
          title: category.title as string,
          number: category.number as number,
          questions: ((category.questions as Record<string, unknown>[]) || [])
            .sort((a, b) => (a.number as number) - (b.number as number))
            .map((question) => ({
              id: question.id as string,
              number: question.number as number,
              text: question.text as string,
              option1: question.option1 as string | undefined,
              option2: question.option2 as string | undefined,
              option3: question.option3 as string | undefined,
              option4: question.option4 as string | undefined,
              option5: question.option5 as string | undefined,
              correctAnswer: question.correct_answer as number | undefined,
              alertOnAnswer: question.alert_on_answer as number | undefined,
            })),
        })),
    })),
    universityCode: test.university_code as string | undefined,
    description: test.description as string | undefined,
    createdAt: test.created_at as string,
    updatedAt: test.updated_at as string | undefined,
    passingScore: test.passing_score as number | undefined,
  }))
  return NextResponse.json({ items }, { status: 200 })
}
