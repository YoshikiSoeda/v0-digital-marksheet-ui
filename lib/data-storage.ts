// 学生データの型定義
export interface Student {
  id: string
  studentId: string // 学籍番号
  name: string // 氏名
  email?: string // メールアドレス
  department: string // 学部・学科
  roomNumber: string // 部屋番号
  createdAt: string
}

// 教員データの型定義
export interface Teacher {
  id: string
  teacherId: string
  name: string // 氏名
  email: string // メールアドレス（ログインID）
  password: string // ログインパスワード
  role: "general" | "admin" // 権限（一般 or 管理者）
  assignedRoomNumber: string // 担当部屋番号（単一）
  createdAt: string
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
}

// 出席状況データの型定義
export interface AttendanceRecord {
  studentId: string
  status: "present" | "absent" | "pending" // 出席、欠席、未確認
  markedBy: string // 記録した評価者のID（teacherまたはpatient）
  markedByType: "teacher" | "patient" // 評価者の種別
  roomNumber: string // 部屋番号
  timestamp: string // 記録時刻
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
}

export interface Room {
  id: string
  roomNumber: string
  roomName: string
  createdAt: string
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
}

export interface Category {
  id: string
  title: string // タイトル3（カテゴリ名）
  number: number // カテゴリ番号
  questions: Question[]
}

export interface Sheet {
  id: string
  title: string // タイトル2（シート名）
  categories: Category[]
}

export interface Test {
  id: string
  title: string // タイトル1（テスト名）
  sheets: Sheet[]
  createdAt: string
  updatedAt: string
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
  }))

  const { error } = await supabase.from("students").upsert(studentsData, { onConflict: "student_id" })

  if (error) {
    console.error("[v0] Error saving students:", error.message)
    throw error
  }

  return { success: true }
}

// 学生データの読み込み
export async function loadStudents(): Promise<Student[]> {
  const supabase = createClient()

  const { data, error } = await supabase.from("students").select("*").order("created_at", { ascending: true })

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
  }))
}

// 教員データの保存
export async function saveTeachers(teachers: Teacher[]) {
  const supabase = createClient()

  const teachersData = teachers.map((t) => ({
    name: t.name,
    email: t.email,
    password: t.password,
    role: t.role,
    assigned_room_number: t.assignedRoomNumber,
  }))

  const { error } = await supabase.from("teachers").upsert(teachersData, { onConflict: "email" })

  if (error) {
    console.error("[v0] Error saving teachers:", error.message)
    throw error
  }

  return { success: true }
}

// 教員データの読み込み
export async function loadTeachers(): Promise<Teacher[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

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
  }))

  const { error } = await supabase.from("patients").upsert(patientsData, { onConflict: "email" })

  if (error) {
    console.error("[v0] Error saving patients:", error.message)
    throw error
  }

  return { success: true }
}

// 患者役データの読み込み
export async function loadPatients(): Promise<Patient[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

  if (error) {
    console.error("[v0] Error loading patients:", error)
    return []
  }

  console.log("[v0] Loaded patients data:", data)

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
  }))
}

export async function saveAttendanceRecords(records: AttendanceRecord[]) {
  const supabase = createClient()

  const attendanceData = records.map((r) => ({
    student_id: r.studentId,
    room_number: r.roomNumber,
    status: r.status,
    recorded_at: r.timestamp,
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

export async function loadAttendanceRecords(): Promise<AttendanceRecord[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .order("recorded_at", { ascending: false })

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
  }))

  const { error } = await supabase.from("exam_results").upsert(evaluationData)

  if (error) {
    console.error("[v0] Error saving evaluation results:", error)
    return { success: false, error }
  }

  return { success: true }
}

export async function loadEvaluationResults(): Promise<EvaluationResult[]> {
  const supabase = createClient()

  const { data, error } = await supabase.from("exam_results").select("*").order("created_at", { ascending: false })

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
  }))
}

export async function saveRooms(rooms: Room[]) {
  const supabase = createClient()

  const roomsData = rooms.map((r) => ({
    room_number: r.roomNumber,
    room_name: r.roomName,
    created_at: r.createdAt,
  }))

  const { error } = await supabase.from("rooms").upsert(roomsData, { onConflict: "room_number" })

  if (error) {
    console.error("[v0] Error saving rooms:", error)
    return { success: false, error }
  }

  return { success: true }
}

// ルームデータの読み込み
export async function loadRooms(): Promise<Room[]> {
  const supabase = createClient()

  const { data, error } = await supabase.from("rooms").select("*").order("room_number", { ascending: true })

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
  }))
}

// テストデータの保存
export async function saveTests(tests: Test[]) {
  const supabase = createClient()

  for (const test of tests) {
    // Save test
    const { data: testData, error: testError } = await supabase
      .from("tests")
      .upsert(
        {
          id: test.id,
          title: test.title,
          created_at: test.createdAt,
          updated_at: test.updatedAt,
        },
        { onConflict: "id" },
      )
      .select()

    if (testError) {
      console.error("[v0] Error saving test:", testError)
      continue
    }

    // Save sheets
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

      // Save categories
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

        // Save questions
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
export async function loadTests(): Promise<Test[]> {
  const supabase = createClient()

  // Load tests with all related data
  const { data: tests, error: testsError } = await supabase
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

  if (testsError) {
    console.error("[v0] Error loading tests:", testsError)
    return []
  }

  return (tests || []).map((test) => ({
    id: test.id,
    title: test.title,
    sheets: (test.sheets || []).map((sheet: any) => ({
      id: sheet.id,
      title: sheet.title,
      categories: (sheet.categories || [])
        .sort((a: any, b: any) => a.number - b.number) // Sort categories by number
        .map((category: any) => ({
          id: category.id,
          title: category.title,
          number: category.number,
          questions: (category.questions || [])
            .sort((a: any, b: any) => a.number - b.number) // Sort questions by number
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
  }))
}
