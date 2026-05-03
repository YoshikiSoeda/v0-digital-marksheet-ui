/**
 * Phase 9c-1: GET /api/students/[id]
 *
 * ADR-004 Phase B-2-c: students.test_session_id / room_number 列を application 層から
 * 読まないようにした(後続 PR で RPC 書き込みも外し、最終的に DROP COLUMN する)。
 * 単一 GET は canonical な学生本体のみ返す。session 紐付け (room_number / testSessionId)
 * が必要な場合は GET /api/students?testSessionId=... を使う。
 */
import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/api/_shared"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("students")
    .select("id, student_id, name, email, department, grade, university_code, subject_code, created_at")
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.error("[api/students/:id] error:", error)
    return NextResponse.json({ error: "Failed to load student" }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const row = data as Record<string, unknown>
  const item = {
    id: row.id as string,
    studentId: row.student_id as string,
    name: row.name as string,
    email: row.email as string | undefined,
    department: row.department as string | undefined,
    grade: row.grade as string | undefined,
    // ADR-004 Phase B-2-c: 単一 GET では session 文脈なし → roomNumber / testSessionId は空。
    roomNumber: "",
    createdAt: row.created_at as string,
    universityCode: row.university_code as string | undefined,
    subjectCode: row.subject_code as string | undefined,
    testSessionId: undefined,
  }
  return NextResponse.json({ item }, { status: 200 })
}
