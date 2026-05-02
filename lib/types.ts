/**
 * Phase 9c-5: 全 ドメイン 型定義の集約。
 *
 * 旧 lib/data-storage.ts から types を切り出し。新規コードは本ファイルから import すること。
 * 関数(load/save 系)は lib/api/<resource>.ts に移行済み。
 */

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
  /** 制限時間(分)。NULL/undefined は制限時間未設定。 */
  durationMinutes?: number | null
  status: TestSessionStatus
  createdAt: string
  updatedAt: string
}


// 教科データの型定義
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
