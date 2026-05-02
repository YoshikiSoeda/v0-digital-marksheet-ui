/**
 * Phase 9c-2: GET /api/tests(sheets/categories/questions の入れ子返却)
 * Phase 9c-4: POST /api/tests(全 test を upsert、無くなった sheet/category/question は cascade 削除)
 */
import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient, parseListQuery, requireAdmin } from "@/lib/api/_shared"

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
    console.error("[api/tests] GET error:", error)
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
              isAlertTarget: question.is_alert_target as boolean | undefined,
              alertOptions: question.alert_options as number[] | undefined,
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

interface UpsertQuestion {
  id: string
  number: number
  text: string
  option1?: string
  option2?: string
  option3?: string
  option4?: string
  option5?: string
  isAlertTarget?: boolean
  alertOptions?: number[]
}
interface UpsertCategory { id: string; title: string; number: number; questions: UpsertQuestion[] }
interface UpsertSheet { id: string; title: string; categories: UpsertCategory[] }
interface UpsertTest {
  id: string
  title: string
  testSessionId?: string
  subjectCode?: string
  universityCode?: string
  roleType?: string
  createdAt?: string
  updatedAt?: string
  sheets: UpsertSheet[]
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: { items?: UpsertTest[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const tests = Array.isArray(body.items) ? body.items : []
  if (tests.length === 0) return NextResponse.json({ ok: true, upserted: 0 })

  const supabase = getServiceClient()

  for (const test of tests) {
    // 1) tests upsert
    const { error: testError } = await supabase
      .from("tests")
      .upsert(
        ({
          id: test.id,
          title: test.title,
          test_session_id: test.testSessionId || null,
          created_at: test.createdAt,
          updated_at: test.updatedAt,
          university_code: test.universityCode || null,
          subject_code: test.subjectCode || null,
          role_type: test.roleType || "teacher",
        }) as never,
        { onConflict: "id" },
      )
    if (testError) {
      console.error("[api/tests] POST tests upsert error:", testError)
      return NextResponse.json({ error: testError.message }, { status: 500 })
    }

    const localSheetIds = test.sheets.map((s) => s.id)
    const localCategoryIds = test.sheets.flatMap((s) => s.categories.map((c) => c.id))
    const localQuestionIds = test.sheets.flatMap((s) =>
      s.categories.flatMap((c) => c.questions.map((q) => q.id)),
    )

    // 2) Cascade delete: DB に有るがローカルに無いものを削除
    const { data: dbSheets } = await supabase.from("sheets").select("id").eq("test_id", test.id)
    const dbSheetIds = (dbSheets || []).map((s: Record<string, unknown>) => s.id as string)

    if (dbSheetIds.length > 0) {
      const { data: dbCategories } = await supabase
        .from("categories").select("id, sheet_id").in("sheet_id", dbSheetIds)
      const dbCategoryIds = (dbCategories || []).map((c: Record<string, unknown>) => c.id as string)

      if (dbCategoryIds.length > 0) {
        const { data: dbQuestions } = await supabase
          .from("questions").select("id, category_id").in("category_id", dbCategoryIds)
        const dbQuestionIds = (dbQuestions || []).map((q: Record<string, unknown>) => q.id as string)

        const questionsToDelete = dbQuestionIds.filter((id: string) => !localQuestionIds.includes(id))
        if (questionsToDelete.length > 0) {
          await supabase.from("questions").delete().in("id", questionsToDelete)
        }
      }

      const categoriesToDelete = dbCategoryIds.filter((id: string) => !localCategoryIds.includes(id))
      if (categoriesToDelete.length > 0) {
        await supabase.from("questions").delete().in("category_id", categoriesToDelete)
        await supabase.from("categories").delete().in("id", categoriesToDelete)
      }
    }

    const sheetsToDelete = dbSheetIds.filter((id: string) => !localSheetIds.includes(id))
    if (sheetsToDelete.length > 0) {
      for (const sheetId of sheetsToDelete) {
        const { data: cats } = await supabase.from("categories").select("id").eq("sheet_id", sheetId)
        if (cats && cats.length > 0) {
          const catIds = (cats as Record<string, unknown>[]).map((c) => c.id as string)
          await supabase.from("questions").delete().in("category_id", catIds)
          await supabase.from("categories").delete().in("id", catIds)
        }
      }
      await supabase.from("sheets").delete().in("id", sheetsToDelete)
    }

    // 3) Upsert sheets / categories / questions (現状を保存)
    for (const sheet of test.sheets) {
      const { error: sheetError } = await supabase
        .from("sheets")
        .upsert({ id: sheet.id, test_id: test.id, title: sheet.title } as never, { onConflict: "id" })
      if (sheetError) {
        console.error("[api/tests] sheet upsert error:", sheetError)
        continue
      }
      for (const category of sheet.categories) {
        const { error: categoryError } = await supabase
          .from("categories")
          .upsert(
            { id: category.id, sheet_id: sheet.id, title: category.title, number: category.number } as never,
            { onConflict: "id" },
          )
        if (categoryError) {
          console.error("[api/tests] category upsert error:", categoryError)
          continue
        }
        for (const question of category.questions) {
          const { error: questionError } = await supabase.from("questions").upsert(
            ({
              id: question.id,
              category_id: category.id,
              number: question.number,
              text: question.text,
              option1: question.option1,
              option2: question.option2,
              option3: question.option3,
              option4: question.option4,
              option5: question.option5,
              is_alert_target: question.isAlertTarget,
              alert_options: question.alertOptions || [],
            }) as never,
            { onConflict: "id" },
          )
          if (questionError) {
            console.error("[api/tests] question upsert error:", questionError)
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, upserted: tests.length })
}
