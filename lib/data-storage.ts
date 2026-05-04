/**
 * @deprecated Phase 9c-5: lib/data-storage.ts は後方互換のための薄い shim になりました。
 *
 * 推奨 import 先(新規コード):
 * - 型: `import type { Student, ... } from "@/lib/types"`
 * - 読込: `import { listStudents, ... } from "@/lib/api/<resource>"`
 * - 書込: `import { upsertStudents, deleteTestApi, ... } from "@/lib/api/<resource>"`
 *
 * 本 shim は既存の `loadXxx(uc, sc, tsId)` / `saveXxx(items)` 呼び出しを壊さないために
 * 残置しています。lib/api の関数は引数が object 形式なので、ここで positional →
 * object へ変換するラッパとして実装しています。
 */

// 型は lib/types に集約済み(後方互換のため re-export)
export * from "./types"

import type {
  Student,
  Teacher,
  Patient,
  Room,
  AttendanceRecord,
  EvaluationResult,
  Test,
  Subject,
  TestSession,
} from "./types"

// === Read 関数 ===

export async function loadStudents(
  universityCode?: string,
  subjectCode?: string,
  testSessionId?: string,
  grade?: string,
): Promise<Student[]> {
  const { listStudents } = await import("./api/students")
  return listStudents({ universityCode, subjectCode, testSessionId, grade })
}

export async function loadTeachers(
  universityCode?: string,
  subjectCode?: string,
  testSessionId?: string,
): Promise<Teacher[]> {
  const { listTeachers } = await import("./api/teachers")
  return listTeachers({ universityCode, subjectCode, testSessionId })
}

export async function loadPatients(
  universityCode?: string,
  subjectCode?: string,
  testSessionId?: string,
): Promise<Patient[]> {
  const { listPatients } = await import("./api/patients")
  return listPatients({ universityCode, subjectCode, testSessionId })
}

export async function loadRooms(
  universityCode?: string,
  subjectCode?: string,
  testSessionId?: string,
): Promise<Room[]> {
  const { listRooms } = await import("./api/rooms")
  return listRooms({ universityCode, subjectCode, testSessionId })
}

export async function loadTests(
  universityCode?: string,
  subjectCode?: string,
): Promise<Test[]> {
  const { listTests } = await import("./api/tests")
  return listTests({ universityCode, subjectCode })
}

export async function loadAttendanceRecords(
  universityCode?: string,
  testSessionId?: string,
): Promise<AttendanceRecord[]> {
  const { listAttendanceRecords } = await import("./api/attendance-records")
  return listAttendanceRecords({ universityCode, testSessionId })
}

export async function loadEvaluationResults(
  universityCode?: string,
  testSessionId?: string,
): Promise<EvaluationResult[]> {
  const { listEvaluationResults } = await import("./api/evaluation-results")
  return listEvaluationResults({ universityCode, testSessionId })
}

export async function loadTestSessions(universityCode?: string): Promise<TestSession[]> {
  const { listTestSessions } = await import("./api/test-sessions")
  return listTestSessions({ universityCode })
}

export async function loadSubjects(universityCode?: string): Promise<Subject[]> {
  const { listSubjects } = await import("./api/subjects")
  return listSubjects({ universityCode })
}

// === Write 関数 ===

export async function saveStudents(students: Student[]) {
  const { upsertStudents } = await import("./api/students")
  return upsertStudents(students)
}

export async function saveRooms(rooms: Room[]) {
  const { upsertRooms } = await import("./api/rooms")
  return upsertRooms(rooms)
}

export async function saveAttendanceRecords(records: AttendanceRecord[]) {
  const { upsertAttendanceRecords } = await import("./api/attendance-records")
  return upsertAttendanceRecords(records)
}

export async function saveEvaluationResults(results: EvaluationResult[]) {
  const { upsertEvaluationResults } = await import("./api/evaluation-results")
  return upsertEvaluationResults(results)
}

export async function saveTests(tests: Test[]) {
  const { upsertTests } = await import("./api/tests")
  return upsertTests(tests)
}

export async function deleteTest(testId: string) {
  const { deleteTestApi } = await import("./api/tests")
  return deleteTestApi(testId)
}

export async function saveSubjects(subjects: Subject[]) {
  const { upsertSubjects } = await import("./api/subjects")
  return upsertSubjects(subjects)
}

export async function deleteTeacher(teacherId: string) {
  const { deleteTeacherApi } = await import("./api/teachers")
  return deleteTeacherApi(teacherId)
}

// teachers / patients の write は Phase 8c で /api/admin/register-* に migration 済み。
export async function saveTeachers(teachers: Teacher[]) {
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return { success: true, upserted: 0 }
  }
  const response = await fetch("/api/admin/register-teachers", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teachers }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.error || `saveTeachers failed: ${response.status}`)
  }
  return response.json()
}

export async function savePatients(patients: Patient[]) {
  if (!Array.isArray(patients) || patients.length === 0) {
    return { success: true, upserted: 0 }
  }
  const response = await fetch("/api/admin/register-patients", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patients }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.error || `savePatients failed: ${response.status}`)
  }
  return response.json()
}
