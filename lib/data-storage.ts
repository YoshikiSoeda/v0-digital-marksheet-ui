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
  assignedStudents: string[] // 評価対象の学生ID配列
  roomNumber: string // 担当部屋番号
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
  assignedStudents: string[] // 評価対象の学生ID配列
  roomNumber: string // 担当部屋番号
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
  answers: Record<number, number> // 問題番号: 回答値（0-3）
  totalScore: number
  answeredCount: number
  isCompleted: boolean
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

// localStorage キー
const STORAGE_KEYS = {
  students: "medical_exam_students",
  teachers: "medical_exam_teachers",
  patients: "medical_exam_patients",
  attendance: "medical_exam_attendance",
  evaluations: "medical_exam_evaluations",
  rooms: "medical_exam_rooms", // Adding rooms key
}

// 学生データの保存
export function saveStudents(students: Student[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students))
  }
  return { success: true }
}

// 学生データの読み込み
export function loadStudents(): Student[] {
  if (typeof window === "undefined") return []

  const data = localStorage.getItem(STORAGE_KEYS.students)
  if (!data) return []

  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 教員データの保存
export function saveTeachers(teachers: Teacher[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.teachers, JSON.stringify(teachers))
  }
  return { success: true }
}

// 教員データの読み込み
export function loadTeachers(): Teacher[] {
  if (typeof window === "undefined") return []

  const data = localStorage.getItem(STORAGE_KEYS.teachers)
  if (!data) return []

  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 患者役データの保存
export function savePatients(patients: Patient[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(patients))
  }
  return { success: true }
}

// 患者役データの読み込み
export function loadPatients(): Patient[] {
  if (typeof window === "undefined") return []

  const data = localStorage.getItem(STORAGE_KEYS.patients)
  if (!data) return []

  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

export function saveAttendanceRecords(records: AttendanceRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(records))
  }
  return { success: true }
}

export function loadAttendanceRecords(): AttendanceRecord[] {
  if (typeof window === "undefined") return []

  const data = localStorage.getItem(STORAGE_KEYS.attendance)
  if (!data) return []

  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

export function saveEvaluationResults(results: EvaluationResult[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.evaluations, JSON.stringify(results))
  }
  return { success: true }
}

export function loadEvaluationResults(): EvaluationResult[] {
  if (typeof window === "undefined") return []

  const data = localStorage.getItem(STORAGE_KEYS.evaluations)
  if (!data) return []

  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

export function saveRooms(rooms: Room[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(rooms))
  }
  return { success: true }
}

export function loadRooms(): Room[] {
  if (typeof window === "undefined") return []

  const data = localStorage.getItem(STORAGE_KEYS.rooms)
  if (!data) return []

  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}
