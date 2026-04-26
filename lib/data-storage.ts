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
  role: "general" | "admin" // 権限（一般 or 管理者）
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

export async function loadTestSessions(universityCode?: string): Promise<TestSession[]> {
  const supabase = createClient()

  let query = supabase.from("test_sessions").select("*").order("test_date", { ascending: false })

  if (universityCode) {
    query = query.eq("university_code", universityCode)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading test sessions:", error)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id,
    testDate: row.test_date,
    description: row.description || "",
    universityCode: row.university_code,
    subjectCode: row.subject_code,
    passingScore: row.passing_score ?? null,
    status: row.status || "not_started",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
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
    subject_code: s.subjectCode || null,
    test_session_id: s.testSessionId || null,
  }))

  const { error } = await supabase.from("students").upsert(studentsData, { onConflict: "student_id,test_session_id" })

  if (error) {
    console.error("[v0] Error saving students:", error.message)
    throw error
  }

  return { success: true }
}

// 学生データの読み込み
export async function loadStudents(universityCode?: string, subjectCode?: string, testSessionId?: string): Promise<Student[]> {
  const supabase = createClient()

  let query = supabase.from("students").select("*").order("created_at", { ascending: true })

  if (testSessionId) {
    query = query.eq("test_session_id", testSessionId)
  }

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
    subjectCode: row.subject_code,
    testSessionId: row.test_session_id,
  }))
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
export async function loadTeachers(universityCode?: string, subjectCode?: string, testSessionId?: string): Promise<Teacher[]> {
  const supabase = createClient()

  let query = supabase
    .from("teachers")
    .select("*")
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

  if (testSessionId) {
    query = query.eq("test_session_id", testSessionId)
  }

  if (universityCode) {
    query = query.or(`university_code.eq.${universityCode},university_code.is.null`)
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
  testSessionId: row.test_session_id,
  }))
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
export async function loadPatients(universityCode?: string, subjectCode?: string, testSessionId?: string): Promise<Patient[]> {
  const supabase = createClient()

  let query = supabase
    .from("patients")
    .select("*")
    .order("assigned_room_number", { ascending: true, nullsFirst: false })

  if (testSessionId) {
    query = query.eq("test_session_id", testSessionId)
  }

  if (universityCode) {
    query = query.or(`university_code.eq.${universityCode},university_code.is.null`)
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
    testSessionId: row.test_session_id,
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
    test_session_id: r.testSessionId || null,
  }))

  const { error } = await supabase
    .from("attendance_records")
    .upsert(attendanceData, { onConflict: "student_id,room_number,test_session_id" })

  if (error) {
    console.error("[v0] Error saving attendance records:", error)
    return { success: false, error }
  }

  return { success: true }
}

export async function loadAttendanceRecords(universityCode?: string, testSessionId?: string): Promise<AttendanceRecord[]> {
  const supabase = createClient()

  let query = supabase.from("attendance_records").select("*").order("recorded_at", { ascending: false })

  if (testSessionId) {
    query = query.eq("test_session_id", testSessionId)
  }

  if (universityCode) {
    query = query.or(`university_code.eq.${universityCode},university_code.is.null`)
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
    testSessionId: row.test_session_id,
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
    test_session_id: r.testSessionId || null,
  }))

  const { error } = await supabase.from("exam_results").upsert(evaluationData, {
    onConflict: "student_id,evaluator_email,evaluator_type,room_number,test_session_id",
  })

  if (error) {
    console.error("[v0] Error saving evaluation results:", error)
    return { success: false, error }
  }

  return { success: true }
}

export async function loadEvaluationResults(universityCode?: string, testSessionId?: string): Promise<EvaluationResult[]> {
  const supabase = createClient()

  let query = supabase.from("exam_results").select("*").order("created_at", { ascending: false }).limit(1000)

  if (testSessionId) {
    query = query.eq("test_session_id", testSessionId)
  }

  if (universityCode) {
    query = query.or(`university_code.eq.${universityCode},university_code.is.null`)
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
    testSessionId: row.test_session_id,
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
    test_session_id: r.testSessionId || null,
  }))

  const { error } = await supabase.from("rooms").upsert(roomsData, { onConflict: "room_number,test_session_id" })

  if (error) {
    console.error("[v0] Error saving rooms:", error)
    return { success: false, error }
  }

  return { success: true }
}

// ルームデータの読み込み
export async function loadRooms(universityCode?: string, subjectCode?: string, testSessionId?: string): Promise<Room[]> {
  const supabase = createClient()

  let query = supabase.from("rooms").select("*").order("room_number", { ascending: true })

  if (testSessionId) {
    query = query.eq("test_session_id", testSessionId)
  }

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
    testSessionId: row.test_session_id,
  }))
}

// テストデータの削除（カスケードで sheets/categories/questions も削除）
export async function deleteTest(testId: string) {
  const supabase = createClient()

  // sheets -> categories -> questions をカスケード削除
  const { data: sheets } = await supabase.from("sheets").select("id").eq("test_id", testId)
  if (sheets) {
    for (const sheet of sheets) {
      const { data: categories } = await supabase.from("categories").select("id").eq("sheet_id", sheet.id)
      if (categories) {
        for (const cat of categories) {
          await supabase.from("questions").delete().eq("category_id", cat.id)
        }
        await supabase.from("categories").delete().eq("sheet_id", sheet.id)
      }
    }
    await supabase.from("sheets").delete().eq("test_id", testId)
  }

  const { error } = await supabase.from("tests").delete().eq("id", testId)
  if (error) {
    console.error("[v0] Error deleting test:", error.message)
    throw error
  }
}

// テストデータの保存（削除された問題・カテゴリ・シートもDB上から削除）
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
          subject_code: test.subjectCode || null,
          role_type: test.roleType || "teacher",
        },
        { onConflict: "id" },
      )
      .select()

    if (testError) {
      console.error("[v0] Error saving test:", testError.message)
      throw testError
    }

    // 現在のローカルのIDセットを収集
    const localSheetIds = test.sheets.map((s) => s.id)
    const localCategoryIds = test.sheets.flatMap((s) => s.categories.map((c) => c.id))
    const localQuestionIds = test.sheets.flatMap((s) =>
      s.categories.flatMap((c) => c.questions.map((q) => q.id))
    )

    // DB上の既存データを取得
    const { data: dbSheets } = await supabase.from("sheets").select("id").eq("test_id", test.id)
    const dbSheetIds = (dbSheets || []).map((s: any) => s.id)

    if (dbSheetIds.length > 0) {
      const { data: dbCategories } = await supabase.from("categories").select("id, sheet_id").in("sheet_id", dbSheetIds)
      const dbCategoryIds = (dbCategories || []).map((c: any) => c.id)

      if (dbCategoryIds.length > 0) {
        const { data: dbQuestions } = await supabase.from("questions").select("id, category_id").in("category_id", dbCategoryIds)
        const dbQuestionIds = (dbQuestions || []).map((q: any) => q.id)

        // ローカルにないquestionsをDBから削除
        const questionsToDelete = dbQuestionIds.filter((id: string) => !localQuestionIds.includes(id))
        if (questionsToDelete.length > 0) {
          await supabase.from("questions").delete().in("id", questionsToDelete)
        }
      }

      // ローカルにないcategoriesをDBから削除（子のquestionsもカスケード）
      const categoriesToDelete = dbCategoryIds.filter((id: string) => !localCategoryIds.includes(id))
      if (categoriesToDelete.length > 0) {
        // まずカテゴリに属するquestionsを削除
        await supabase.from("questions").delete().in("category_id", categoriesToDelete)
        await supabase.from("categories").delete().in("id", categoriesToDelete)
      }
    }

    // ローカルにないsheetsをDBから削除（子のcategories/questionsもカスケード）
    const sheetsToDelete = dbSheetIds.filter((id: string) => !localSheetIds.includes(id))
    if (sheetsToDelete.length > 0) {
      for (const sheetId of sheetsToDelete) {
        const { data: cats } = await supabase.from("categories").select("id").eq("sheet_id", sheetId)
        if (cats && cats.length > 0) {
          const catIds = cats.map((c: any) => c.id)
          await supabase.from("questions").delete().in("category_id", catIds)
          await supabase.from("categories").delete().in("id", catIds)
        }
      }
      await supabase.from("sheets").delete().in("id", sheetsToDelete)
    }

    // Upsertで残りのデータを保存
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
    testSessionId: test.test_session_id,
    subjectCode: test.subject_code,
    roleType: test.role_type || "teacher",
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
