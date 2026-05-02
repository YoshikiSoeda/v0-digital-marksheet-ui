/**
 * Phase 9b-α: 統合認証ヘルパー。
 *
 * すべての login API(admin/teacher/patient/login = 統合)から呼ばれる
 * 単一の credential verification 関数を提供する。
 *
 * 振る舞い:
 *  1. admins テーブル → teachers → patients の順で照合
 *  2. teachers/patients は同一メールで複数 test_session に紐づく場合があるため、
 *     candidates が複数で testSessionId 未指定なら session_select を返す
 *  3. すべて空なら not_found
 *
 * このファイルが追加された後、既存の /api/auth/{admin,teacher,patient}/login は
 * 動作を変えない(後方互換)。新 /api/auth/login がこの helper を直接使う。
 */
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type LoginSource = "admins" | "teachers" | "patients"

export interface VerifiedUser {
  source: LoginSource
  id: string
  name: string
  email: string
  role: string
  accountType: string
  universityCode: string
  universityCodes: string[]
  subjectCode: string
  testSessionId: string
  assignedRoomNumber: string
}

export interface SessionCandidate {
  source: Extract<LoginSource, "teachers" | "patients">
  id: string // test_session_id
  name: string
  assignedRoomNumber: string
  universityCode: string
  subjectCode: string
}

export type AuthOutcome =
  | { kind: "match"; user: VerifiedUser }
  | { kind: "session_select"; source: Extract<LoginSource, "teachers" | "patients">; candidates: SessionCandidate[] }
  | { kind: "not_found" }
  | { kind: "error"; message: string }

const ADMIN_LIKE_ROLES = new Set(["master_admin", "university_admin", "subject_admin"])

function deriveAccountType(source: LoginSource, role: string): string {
  if (source === "admins") {
    if (role === "master_admin") return "special_master"
    if (role === "university_admin") return "university_master"
    return "admin"
  }
  if (source === "teachers") {
    if (role === "master_admin") return "special_master"
    if (role === "university_admin") return "university_master"
    if (role === "subject_admin") return "subject_admin"
    return "general"
  }
  // patients
  return role === "admin" ? "admin" : "general"
}

export async function verifyCredentials(
  rawLoginId: string,
  password: string,
  testSessionId?: string,
): Promise<AuthOutcome> {
  const loginId = (rawLoginId || "").trim()
  if (!loginId || !password) {
    return { kind: "not_found" }
  }

  // ediand alias 互換(既存 admin login の挙動を維持)
  const adminIdentifier = loginId === "ediand" ? "ediand@system.local" : loginId

  // 1) admins
  {
    const { data, error } = await supabase.rpc("verify_admin_login", {
      p_identifier: adminIdentifier,
      p_password: password,
    })
    if (error) {
      return { kind: "error", message: `admin RPC error: ${error.message}` }
    }
    const admin = Array.isArray(data) ? data[0] : data
    if (admin) {
      const role: string = admin.role || "master_admin"
      const universityCodes: string[] = admin.university_codes || ["dentshowa"]
      const universityCode = universityCodes.includes("ALL") ? "" : universityCodes[0] || "dentshowa"
      return {
        kind: "match",
        user: {
          source: "admins",
          id: admin.id,
          name: admin.name || "",
          email: admin.email || "",
          role,
          accountType: deriveAccountType("admins", role),
          universityCode,
          universityCodes,
          subjectCode: "",
          testSessionId: "",
          assignedRoomNumber: "",
        },
      }
    }
  }

  // 2) teachers
  {
    const { data, error } = await supabase.rpc("verify_teacher_login", {
      p_email: loginId,
      p_password: password,
    })
    if (error) {
      return { kind: "error", message: `teacher RPC error: ${error.message}` }
    }
    type TeacherRow = {
      id: string
      email: string
      name: string
      role: string
      assigned_room_number: string | null
      university_code: string | null
      subject_code: string | null
      test_session_id: string | null
    }
    const rows = (data || []) as TeacherRow[]

    if (rows.length > 0) {
      // multi-session disambiguation
      if (rows.length > 1 && !testSessionId) {
        return {
          kind: "session_select",
          source: "teachers",
          candidates: rows.map((r) => ({
            source: "teachers",
            id: r.test_session_id || "",
            name: r.name,
            assignedRoomNumber: r.assigned_room_number || "",
            universityCode: r.university_code || "",
            subjectCode: r.subject_code || "",
          })),
        }
      }
      let row = rows[0]
      if (testSessionId) {
        const matched = rows.find((r) => r.test_session_id === testSessionId)
        if (matched) row = matched
      }
      const role = row.role || "general"
      return {
        kind: "match",
        user: {
          source: "teachers",
          id: row.id,
          name: row.name || "",
          email: row.email || "",
          role,
          accountType: deriveAccountType("teachers", role),
          universityCode: row.university_code || "dentshowa",
          universityCodes: [row.university_code || "dentshowa"],
          subjectCode: row.subject_code || "",
          testSessionId: row.test_session_id || "",
          assignedRoomNumber: row.assigned_room_number || "",
        },
      }
    }
  }

  // 3) patients
  {
    const { data, error } = await supabase.rpc("verify_patient_login", {
      p_email: loginId,
      p_password: password,
    })
    if (error) {
      return { kind: "error", message: `patient RPC error: ${error.message}` }
    }
    type PatientRow = {
      id: string
      email: string
      name: string
      role: string
      assigned_room_number: string | null
      university_code: string | null
      subject_code: string | null
      test_session_id: string | null
    }
    const rows = (data || []) as PatientRow[]

    if (rows.length > 0) {
      if (rows.length > 1 && !testSessionId) {
        return {
          kind: "session_select",
          source: "patients",
          candidates: rows.map((r) => ({
            source: "patients",
            id: r.test_session_id || "",
            name: r.name,
            assignedRoomNumber: r.assigned_room_number || "",
            universityCode: r.university_code || "",
            subjectCode: r.subject_code || "",
          })),
        }
      }
      let row = rows[0]
      if (testSessionId) {
        const matched = rows.find((r) => r.test_session_id === testSessionId)
        if (matched) row = matched
      }
      const role = row.role || "general"
      return {
        kind: "match",
        user: {
          source: "patients",
          id: row.id,
          name: row.name || "",
          email: row.email || "",
          role,
          accountType: deriveAccountType("patients", role),
          universityCode: row.university_code || "dentshowa",
          universityCodes: [row.university_code || "dentshowa"],
          subjectCode: row.subject_code || "",
          testSessionId: row.test_session_id || "",
          assignedRoomNumber: row.assigned_room_number || "",
        },
      }
    }
  }

  return { kind: "not_found" }
}

/**
 * ログイン成功時に返す redirectTo を決定する。
 *
 * 9d で URL 再編される予定だが、本フェーズでは既存パスへの redirect を維持する:
 *  - admin系 (special_master/university_master/admin/subject_admin/master_admin/university_admin)
 *    → /admin/dashboard
 *  - 教員 general → /teacher/exam-info(将来 /sessions)
 *  - 患者役       → /patient/exam-info(将来 /sessions)
 */
export function getRedirectTo(user: VerifiedUser): string {
  if (user.source === "admins") return "/admin/dashboard"
  if (user.source === "teachers") {
    if (ADMIN_LIKE_ROLES.has(user.role)) return "/admin/dashboard"
    return "/teacher/exam-info"
  }
  return "/patient/exam-info"
}
