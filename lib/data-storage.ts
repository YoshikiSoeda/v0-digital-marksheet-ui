// 学生データの型定義
export interface Student {
  id: string
  studentId: string // 学籍番号
  name: string // 氏名
  email?: string // メールアドレス
  department: string // 学部・学科
  roomNumber: string // 部屋番号
  createdAt: string
  universityCode?: string // 大学コード
  subjectCode?: string // 担当教科コード
  testSessionId?: string // 試験セッションID
}

// 教員データの型定義
// 権限: general=一般教員, subject_admin=教科管理者, university_admin=大学管理者, master_admin=マスター管理者
export type TeacherRole = "general" | "subject_admin" | "university_admin" | "master_admin"

export interface Teacher {
  id: string
  teacherId: string
  name: string // 氏名
  email: string // メールアドレス（ログインID）
  password: string // ログインパスワード
  role: TeacherRole // 統合権限
  assignedRoomNumber: string // 担当部屋番号（単一）
  createdAt: string
  universityCode?: string // 大学コード
  subjectCode?: string // 担当教科コード
  testSessionId?: string // 試験セッションID
  // 後方互換用（非推奨）
  accountType?: string
  subjectRole?: string
}

// 患者役データの型定義
export interface Patient {
  id: string
  patientId: string
  name: string // 氏名
  email: string // メールアドレス（ログインID）
  password: string // ログインパスワード
  role: "general" // ADR-001 §7-2(b) で patient_admin は廃止、general のみ
  assignedRoomNumber: string // 担当部屋番号（単一）
  createdAt: string
  universityCode?: string // 大学コード
  accountType?: "special_master" | "university_master" | "admin" // アカウントタイプ
  subjectCode?: string // 担当教科コード
  testSessionId?: string // 試験セッションID
}

// 出席状況データの型定義
export interface AttendanceRecord {
  studentId: string
  status: "present" | "absent" | "pending" // 出席、欠席、未確認
  markedBy: string // 記録した評価者のID（teacherまたはpatient）
  markedByType: "teacher" | "patient" // 評価者の種別
  roomNumber: string // 部屋番号
  timestamp: string // 記録時刻
  universityCode?: string // 大学コード
  subjectCode?: string // 教科コード
  testSessionId?: string // 試験セッションID
}

// 評価結果データの型定義
export interface EvaluationResult {
  studentId: string
  evaluatorId: string // 教員または患者役のID
  evaluatorType: "teacher" | "patient"
  testId?: string // 紐づく試験(Test)ID — teacher/patient-exam-tabs で記録
  roomNumber: string
  answers: Record<number, number> // 問題番号: 回答値（1-5）
  totalScore: number
  answeredCount: number
  isCompleted: boolean
  hasAlert?: boolean // Add hasAlert flag to track if any answer triggers an alert
  completedAt?: string
  createdAt?: string // saveEvaluationResults 後に DB が付与
  updatedAt?: string // 同上
  timestamp?: string // teacher/patient-exam-tabs が記録時刻として渡す
  universityCode?: string // 大学コード
  testSessionId?: string // 試験セッションID
}

export interface Room {
  id: string
  roomNumber: string
  roomName: string
  createdAt: string
  universityCode?: string // 大学コード
  subjectCode?: string // 教科コード
  testSessionId?: string // 試験セッションID
}

// 問題管理データの型定義
export interface Question {
  id: string
  number: number // 問題番号（No）
  text: string // 問題文
  option1: string // 選択肢1
  option2: string // 選択肢2
  option3: string // 選択肢3
  option4: string // 選択肢4
  option5: string // 選択肢5
  isAlertTarget: boolean // アラート対象ON/OFF
  alertOptions: number[] // アラート対象の選択肢番号（1-5）
  universityCode?: string // 大学コード
}

export interface Category {
  id: string
  title: string // タイトル3（カテゴリ名）
  number: number // カテゴリ番号
  questions: Question[]
  universityCode?: string // 大学コード
}

export interface Sheet {
  id: string
  title: string // タイトル2（シート名）
  categories: Category[]
  universityCode?: string // 大学コード
}

export interface Test {
  id: string
  title: string // タイトル1（テスト名）
  sheets: Sheet[]
  createdAt: string
  updatedAt: string
  universityCode?: string // 大学コード
  testSessionId?: string // Add test_session_id
  subjectCode?: string // 教科コード
  roleType?: "teacher" | "patient" // 教員側 or 患者役側
}

// 試験セッションデータの型定義
export type TestSessionStatus = "not_started" | "in_progress" | "completed"

export interface TestSession {
  id: string
  testDate: string
  description: string
  universityCode: string
  subjectCode?: string
  passingScore?: number | null
  status: TestSessionStatus
  createdAt: string
  updatedAt: string
}

// Phase 9c-2: anon SELECT 撤廃 → /api/test-sessions 経由(既存 API)。
export async function loadTestSessions(universityCode?: string): Promise<TestSession[]> {
  const { listTestSessions } = await import("./api/test-sessions")
  return listTestSessions({ universityCode })
}

// localStorage キー
const STORAGE_KEYS = {
  students: "medical_exam_students",
  teachers: "medical_exam_teachers",
  patients: "medical_exam_patients",
  attendance: "medical_exam_attendance",
  evaluations: "medical_exam_evaluations",
  rooms: "medical_exam_rooms",
  tests: "medical_exam_tests", // Adding tests storage key
  subjects: "medical_exam_subjects", // Adding subjects storage key
}


// 学生データの保存
// Phase 9c-4: anon UPSERT 撤廃 → /api/students 経由。
export async function saveStudents(students: Student[]) {
  const { upsertStudents } = await import("./api/students")
  return upsertStudents(students)
}

// 学生データの読み込み
// Phase 9c-1: anon SELECT を撤廃し、サーバ /api/students 経由に統一。
export async function loadStudents(universityCode?: string, subjectCode?: string, testSessionId?: string): Promise<Student[]> {
  const { listStudents } = await import("./api/students")
  return listStudents({ universityCode, subjectCode, testSessionId })
}

// 教員データの保存
// Phase 8c (2026-04-26 以降): /api/admin/register-teachers 経由でサーバーサイド bcrypt 化。
//   平文 password はここで送られる時点では平文だが、API → RPC で hash 化されて DB に入る。
//   既存 hash はそのまま据え置き(register_teachers_bulk RPC 内で判別)。
export async function saveTeachers(teachers: Teacher[]) {
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return { success: true, upserted: 0 }
  }

  const payload = teachers.map((t) => ({
    name: t.name,
    email: t.email,
    password: t.password,
    role: t.role,
    assignedRoomNumber: t.assignedRoomNumber || "",
    subjectCode: t.subjectCode || "",
    universityCode: t.universityCode || "",
    accountType: (t as any).accountType || "",
    testSessionId: t.testSessionId || "",
  }))

  const response = await fetch("/api/admin/register-teachers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ teachers: payload }),
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {}
    console.error("[v0] Error saving teachers:", message)
    throw new Error(message)
  }

  return { success: true, ...(await response.json().catch(() => ({}))) }
}

// 教員データの読み込み
// Phase 9c-1: anon SELECT を撤廃し、サーバ /api/teachers 経由(service role)に統一。
// Phase 9 RLS 有効化に向けた地ならし。
export async function loadTeachers(universityCode?: string, subjectCode?: string, testSessionId?: string): Promise<Teacher[]> {
  const { listTeachers } = await import("./api/teachers")
  return listTeachers({ universityCode, subjectCode, testSessionId })
}
  
  // 患者役データの保存
// Phase 8c (2026-04-26 以降): /api/admin/register-patients 経由でサーバーサイド bcrypt 化。
//   平文 password はここで送られる時点では平文だが、API → RPC で hash 化されて DB に入る。
//   既存 hash はそのまま据え置き(register_patients_bulk RPC 内で判別)。
export async function savePatients(patients: Patient[]) {
  if (!Array.isArray(patients) || patients.length === 0) {
    return { success: true, upserted: 0 }
  }

  const payload = patients.map((p) => ({
    name: p.name,
    email: p.email,
    password: p.password,
    role: p.role,
    assignedRoomNumber: p.assignedRoomNumber || "",
    subjectCode: p.subjectCode || "",
    universityCode: p.universityCode || "",
    accountType: (p as any).accountType || "",
    testSessionId: p.testSessionId || "",
  }))

  const response = await fetch("/api/admin/register-patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ patients: payload }),
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {}
    console.error("[v0] Error saving patients:", message)
    throw new Error(message)
  }

  return { success: true, ...(await response.json().catch(() => ({}))) }
}

// 患者役データの読み込み
// Phase 9c-1: anon SELECT を撤廃し、サーバ /api/patients 経由に統一。
export async function loadPatients(universityCode?: string, subjectCode?: string, testSessionId?: string): Promise<Patient[]> {
  const { listPatients } = await import("./api/patients")
  return listPatients({ universityCode, subjectCode, testSessionId })
}

// Phase 9c-4: anon UPSERT 撤廃 → /api/attendance-records 経由。
export async function saveAttendanceRecords(records: AttendanceRecord[]) {
  const { upsertAttendanceRecords } = await import("./api/attendance-records")
  return upsertAttendanceRecords(records)
}

// Phase 9c-2: anon SELECT 撤廃 → /api/attendance-records 経由。
export async function loadAttendanceRecords(universityCode?: string, testSessionId?: string): Promise<AttendanceRecord[]> {
  const { listAttendanceRecords } = await import("./api/attendance-records")
  return listAttendanceRecords({ universityCode, testSessionId })
}

// Phase 9c-4: anon UPSERT 撤廃 → /api/evaluation-results 経由。
export async function saveEvaluationResults(results: EvaluationResult[]) {
  const { upsertEvaluationResults } = await import("./api/evaluation-results")
  return upsertEvaluationResults(results)
}

// Phase 9c-2: anon SELECT 撤廃 → /api/evaluation-results 経由。
export async function loadEvaluationResults(universityCode?: string, testSessionId?: string): Promise<EvaluationResult[]> {
  const { listEvaluationResults } = await import("./api/evaluation-results")
  return listEvaluationResults({ universityCode, testSessionId })
}

// Phase 9c-4: anon UPSERT 撤廃 → /api/rooms 経由。
export async function saveRooms(rooms: Room[]) {
  const { upsertRooms } = await import("./api/rooms")
  return upsertRooms(rooms)
}

// ルームデータの読み込み
// Phase 9c-2: anon SELECT 撤廃 → /api/rooms 経由。
export async function loadRooms(universityCode?: string, subjectCode?: string, testSessionId?: string): Promise<Room[]> {
  const { listRooms } = await import("./api/rooms")
  return listRooms({ universityCode, subjectCode, testSessionId })
}

// テストデータの削除（カスケードで sheets/categories/questions も削除）
// Phase 9c-4: anon DELETE 撤廃 → /api/tests/[id] 経由。
export async function deleteTest(testId: string) {
  const { deleteTestApi } = await import("./api/tests")
  return deleteTestApi(testId)
}

// テストデータの保存（削除された問題・カテゴリ・シートもDB上から削除）
// Phase 9c-4: anon UPSERT(複雑なカスケード)撤廃 → /api/tests POST 経由。
export async function saveTests(tests: Test[]) {
  const { upsertTests } = await import("./api/tests")
  return upsertTests(tests)
}

// テストデータの読み込み
// Phase 9c-2: anon SELECT 撤廃 → /api/tests 経由。
export async function loadTests(universityCode?: string, subjectCode?: string): Promise<Test[]> {
  const { listTests } = await import("./api/tests")
  return listTests({ universityCode, subjectCode })
}

export interface Subject {
  id: string
  subjectCode: string
  subjectName: string
  universityCode: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Phase 9c-4: anon UPSERT 撤廃 → /api/subjects 経由。
export async function saveSubjects(subjects: Subject[]) {
  const { upsertSubjects } = await import("./api/subjects")
  return upsertSubjects(subjects)
}

// Phase 9c-2: anon SELECT 撤廃 → /api/subjects 経由(既存 API)。
export async function loadSubjects(universityCode?: string): Promise<Subject[]> {
  const { listSubjects } = await import("./api/subjects")
  return listSubjects({ universityCode })
}

// Phase 9c-4: anon DELETE 撤廃 → /api/teachers/[id] DELETE 経由。
export async function deleteTeacher(teacherId: string) {
  const { deleteTeacherApi } = await import("./api/teachers")
  return deleteTeacherApi(teacherId)
}
