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
  role: "general" | "admin" // 権限（一般 or 管理者）
  assignedRoomNumber: string // 担当部屋番号（単一）
  createdAt: string
  universityCode?: string // 大学コード
  accountType?: "special_master" | "university_master" | "admin" // アカウントタイプ
  subjectCode?: string // 担当教科コード
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
}

// 評価結果データの型定義
export interface EvaluationResult {
  studentId: string
  evaluatorId: string // 教員または患者役のID
  evaluatorType: "teacher" | "patient"
  roomNumber: string
  answers: Record<number, number> // 問題番号: 回答値（1-5）
  totalScore: number
  answeredCount: number
  isCompleted: boolean
  hasAlert?: boolean // Add hasAlert flag to track if any answer triggers an alert
  completedAt?: string
  createdAt: string
  updatedAt: string
  universityCode?: string // 大学コード
}

export interface Room {
  id: string
  roomNumber: string
  roomName: string
  createdAt: string
  universityCode?: string // 大学コード
  subjectCode?: string // 教科コード
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

import { createClient } from "./supabase/client"

// 学生データの保存
export async function saveStudents(students: Student[]) {
  const supabase = createClient()

  const studentsData = students.map((s) => ({
    student_id: s.studentId,
    name: s.name,
    email: s.email || null,
    department: s.department,
    room_number: s.roomNumber,
    university_code: s.universityCode || null,
    subject_code: s.subjectCode || null, // Add subject_code
  }))

  const { error } = await supabase.from("students").upsert(studentsData, { onConflict: "student_id" })

  if (error) {
    console.error("[v0] Error saving students:", error.message)
    throw error
  }

  return { success: true }
}

// 学生データの読み込み
export async function loadStudents(universityCode?: string, subjectCode?: string): Promise<Student[]> {
  const supabase = createClient()

  let query = supabase.from("students").select("*").order("created_at", { ascending: true })

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  if (subjectCode) {
    query = query.eq("subject_code", subjectCode)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading students:", error)
    return []
  }

  console.log("[v0] Loaded students data:", data)

  if (!data || !Array.isArray(data)) {
    console.error("[v0] Students data is not an array:", data)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    email: row.email,
    department: row.department,
    roomNumber: row.room_number || "",
    createdAt: row.created_at,
    universityCode: row.university_code,
    subjectCode: row.subject_code, // Add subject_code
  }))
}

// 教員データの保存
export async function saveTeachers(teachers: Teacher[]) {
  const supabase = createClient()

  const teachersData = teachers.map((t) => ({
  name: t.name,
  email: t.email,
  password: t.password,
  role: t.role, // general, subject_admin, university_admin, master_admin
  assigned_room_number: t.assignedRoomNumber,
  university_code: t.universityCode || null,
  subject_code: t.subjectCode || null,
  }))

  const { error } = await supabase.from("teachers").upsert(teachersData, { onConflict: "email" })

  if (error) {
    console.error("[v0] Error saving teachers:", error.message)
    throw error
  }

  return { success: true }
}

// 教員データの読み込み
export async function loadTeachers(universityCode?: string, subjectCode?: string): Promise<Teacher[]> {
  const supabase = createClient()

  let query = supabase
    .from("teachers")
    .select("*")
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  if (subjectCode) {
    query = query.eq("subject_code", subjectCode)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading teachers:", error)
    return []
  }

  console.log("[v0] Loaded teachers data:", data)

  if (!data || !Array.isArray(data)) {
    console.error("[v0] Teachers data is not an array:", data)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    teacherId: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    assignedRoomNumber: row.assigned_room_number || "",
    createdAt: row.created_at,
  universityCode: row.university_code,
  subjectCode: row.subject_code,
  }))
  }
  
  // 患者役データの保存
export async function savePatients(patients: Patient[]) {
  const supabase = createClient()

  const patientsData = patients.map((p) => ({
    name: p.name,
    email: p.email,
    password: p.password,
    role: p.role,
    assigned_room_number: p.assignedRoomNumber,
    university_code: p.universityCode || null,
    account_type: p.accountType || null,
    subject_code: p.subjectCode || null,
  }))

  const { error } = await supabase.from("patients").upsert(patientsData, { onConflict: "email" })

  if (error) {
    console.error("[v0] Error saving patients:", error.message)
    throw error
  }

  return { success: true }
}

// 患者役データの読み込み
export async function loadPatients(universityCode?: string, subjectCode?: string): Promise<Patient[]> {
  const supabase = createClient()

  let query = supabase
    .from("patients")
    .select("*")
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  if (subjectCode) {
    query = query.eq("subject_code", subjectCode)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading patients:", error)
    return []
  }

  if (!data || !Array.isArray(data)) {
    console.error("[v0] Patients data is not an array:", data)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    patientId: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    assignedRoomNumber: row.assigned_room_number || "",
    createdAt: row.created_at,
    universityCode: row.university_code,
    accountType: row.account_type,
    subjectCode: row.subject_code,
  }))
}

export async function saveAttendanceRecords(records: AttendanceRecord[]) {
  const supabase = createClient()

  const attendanceData = records.map((r) => ({
    student_id: r.studentId,
    room_number: r.roomNumber,
    status: r.status,
    recorded_at: r.timestamp,
    university_code: r.universityCode || null,
  }))

  const { error } = await supabase
    .from("attendance_records")
    .upsert(attendanceData, { onConflict: "student_id,room_number" })

  if (error) {
    console.error("[v0] Error saving attendance records:", error)
    return { success: false, error }
  }

  return { success: true }
}

export async function loadAttendanceRecords(universityCode?: string): Promise<AttendanceRecord[]> {
  const supabase = createClient()

  let query = supabase.from("attendance_records").select("*").order("recorded_at", { ascending: false })

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading attendance records:", error)
    return []
  }

  return (data || []).map((row) => ({
    studentId: row.student_id,
    status: row.status,
    markedBy: "", // Will need to be derived from evaluator
    markedByType: "teacher", // Default
    roomNumber: row.room_number,
    timestamp: row.recorded_at,
    universityCode: row.university_code,
  }))
}

export async function saveEvaluationResults(results: EvaluationResult[]) {
  const supabase = createClient()

  const evaluationData = results.map((r) => ({
    student_id: r.studentId,
    room_number: r.roomNumber,
    evaluator_email: r.evaluatorId,
    evaluator_type: r.evaluatorType,
    evaluations: r.answers,
    total_score: r.totalScore,
    is_completed: r.isCompleted,
    has_alert: r.hasAlert || false,
    university_code: r.universityCode || null,
  }))

  const { error } = await supabase.from("exam_results").upsert(evaluationData)

  if (error) {
    console.error("[v0] Error saving evaluation results:", error)
    return { success: false, error }
  }

  return { success: true }
}

export async function loadEvaluationResults(universityCode?: string): Promise<EvaluationResult[]> {
  const supabase = createClient()

  let query = supabase.from("exam_results").select("*").order("created_at", { ascending: false }).limit(1000) // Limit to most recent 1000 records

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading evaluation results:", error)
    return []
  }

  return (data || []).map((row) => ({
    studentId: row.student_id,
    evaluatorId: row.evaluator_email,
    evaluatorType: row.evaluator_type,
    roomNumber: row.room_number,
    answers: row.evaluations || {},
    totalScore: row.total_score || 0,
    answeredCount: Object.keys(row.evaluations || {}).length,
    isCompleted: row.is_completed || false,
    hasAlert: row.has_alert || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    universityCode: row.university_code,
  }))
}

export async function saveRooms(rooms: Room[]) {
  const supabase = createClient()

  const roomsData = rooms.map((r) => ({
    room_number: r.roomNumber,
    room_name: r.roomName,
    created_at: r.createdAt,
    university_code: r.universityCode || null,
    subject_code: r.subjectCode || null,
  }))

  const { error } = await supabase.from("rooms").upsert(roomsData, { onConflict: "room_number" })

  if (error) {
    console.error("[v0] Error saving rooms:", error)
    return { success: false, error }
  }

  return { success: true }
}

// ルームデータの読み込み
export async function loadRooms(universityCode?: string, subjectCode?: string): Promise<Room[]> {
  const supabase = createClient()

  let query = supabase.from("rooms").select("*").order("room_number", { ascending: true })

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  if (subjectCode) {
    query = query.eq("subject_code", subjectCode)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading rooms:", error)
    return []
  }

  console.log("[v0] Loaded rooms data:", data)

  if (!data || !Array.isArray(data)) {
    console.error("[v0] Rooms data is not an array:", data)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    roomNumber: row.room_number,
    roomName: row.room_name,
    createdAt: row.created_at,
    universityCode: row.university_code,
    subjectCode: row.subject_code,
  }))
}

// テストデータの保存
export async function saveTests(tests: Test[]) {
  const supabase = createClient()

  for (const test of tests) {
    const { data: testData, error: testError } = await supabase
      .from("tests")
      .upsert(
        {
          id: test.id,
          title: test.title,
          test_session_id: test.testSessionId || null,
          created_at: test.createdAt,
          updated_at: test.updatedAt,
          university_code: test.universityCode || null,
          subject_code: test.subjectCode || null, // Add subject_code
        },
        { onConflict: "id" },
      )
      .select()

    if (testError) {
      console.error("[v0] Error saving test:", testError.message)
      throw testError
    }

    for (const sheet of test.sheets) {
      const { data: sheetData, error: sheetError } = await supabase
        .from("sheets")
        .upsert(
          {
            id: sheet.id,
            test_id: test.id,
            title: sheet.title,
          },
          { onConflict: "id" },
        )
        .select()

      if (sheetError) {
        console.error("[v0] Error saving sheet:", sheetError)
        continue
      }

      for (const category of sheet.categories) {
        const { data: categoryData, error: categoryError } = await supabase
          .from("categories")
          .upsert(
            {
              id: category.id,
              sheet_id: sheet.id,
              title: category.title,
              number: category.number,
            },
            { onConflict: "id" },
          )
          .select()

        if (categoryError) {
          console.error("[v0] Error saving category:", categoryError)
          continue
        }

        for (const question of category.questions) {
          const { error: questionError } = await supabase.from("questions").upsert(
            {
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
            },
            { onConflict: "id" },
          )

          if (questionError) {
            console.error("[v0] Error saving question:", questionError)
          }
        }
      }
    }
  }

  return { success: true }
}

// テストデータの読み込み
export async function loadTests(universityCode?: string, subjectCode?: string): Promise<Test[]> {
  const supabase = createClient()

  // Load tests with all related data including test_session_id
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

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  if (subjectCode) {
    query = query.eq("subject_code", subjectCode)
  }

  const { data: tests, error: testsError } = await query

  if (testsError) {
    console.error("[v0] Error loading tests:", testsError)
    return []
  }

  console.log("[v0] Loaded tests from DB:", tests)

  return (tests || []).map((test) => ({
    id: test.id,
    title: test.title,
    testSessionId: test.test_session_id, // Add test_session_id
    subjectCode: test.subject_code, // Add subject_code
    sheets: (test.sheets || []).map((sheet: any) => ({
      id: sheet.id,
      title: sheet.title,
      categories: (sheet.categories || [])
        .sort((a: any, b: any) => a.number - b.number)
        .map((category: any) => ({
          id: category.id,
          title: category.title,
          number: category.number,
          questions: (category.questions || [])
            .sort((a: any, b: any) => a.number - b.number)
            .map((question: any) => ({
              id: question.id,
              number: question.number,
              text: question.text,
              option1: question.option1,
              option2: question.option2,
              option3: question.option3,
              option4: question.option4,
              option5: question.option5,
              isAlertTarget: question.is_alert_target,
              alertOptions: question.alert_options || [],
            })),
        })),
    })),
    createdAt: test.created_at,
    updatedAt: test.updated_at,
    universityCode: test.university_code, // Add university_code
  }))
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

export async function saveSubjects(subjects: Subject[]) {
  const supabase = createClient()

  const subjectsData = subjects.map((s) => ({
    subject_code: s.subjectCode,
    subject_name: s.subjectName,
    university_code: s.universityCode,
    description: s.description || null,
    is_active: s.isActive,
  }))

  const { error } = await supabase.from("subjects").upsert(subjectsData, { onConflict: "subject_code" })

  if (error) {
    console.error("[v0] Error saving subjects:", error.message)
    throw error
  }

  return { success: true }
}

export async function loadSubjects(universityCode?: string): Promise<Subject[]> {
  const supabase = createClient()

  let query = supabase.from("subjects").select("*").order("subject_code", { ascending: true })

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading subjects:", error)
    return []
  }

  console.log("[v0] Loaded subjects data:", data)

  if (!data || !Array.isArray(data)) {
    console.error("[v0] Subjects data is not an array:", data)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    universityCode: row.university_code,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function deleteTeacher(teacherId: string) {
  const supabase = createClient()

  console.log("[v0] Deleting teacher from database:", teacherId)

  const { error } = await supabase.from("teachers").delete().eq("id", teacherId)

  if (error) {
    console.error("[v0] Error deleting teacher:", error.message)
    throw error
  }

  console.log("[v0] Teacher deleted successfully from database")
  return { success: true }
}
