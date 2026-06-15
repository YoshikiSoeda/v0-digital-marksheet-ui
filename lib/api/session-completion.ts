/**
 * A-3: 試験セッションの自動完了判定
 *
 * 副田さん仕様(2026-05-19):
 *   セッションに含まれる全テスト(教員側 N + 患者側 M)について、
 *   出席している全学生の評価が完了したら、セッションを自動的に completed にする。
 *
 * 判定式:
 *   - tests テーブルから teacher 数 (=N) / patient 数 (=M) を取得
 *   - attendance_records.status='present' な学生を抽出
 *   - 各学生について、exam_results (test_session_id=X, student_id=Y, is_completed=true) を
 *     evaluator_type ごとに distinct evaluator_email で数え、teacher >= N かつ patient >= M
 *   - 全 present 学生で条件を満たす → status='completed' に更新
 *
 * エッジケース:
 *   - tests が 0 件 → 判定対象なし (false)
 *   - present 学生が 0 件 → 判定対象なし (false)
 *   - 既に completed → 何もせず true を返す
 */
import type { SupabaseClient } from "@supabase/supabase-js"

interface ExamResultRow {
  student_id: string
  evaluator_email: string
  evaluator_type: string
  is_completed: boolean
}

export async function checkAndMaybeMarkSessionComplete(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ completed: boolean; reason?: string }> {
  // 1. tests 取得 → required slot count
  const { data: tests, error: testsErr } = await supabase
    .from("tests")
    .select("role_type")
    .eq("test_session_id", sessionId)
  if (testsErr) return { completed: false, reason: `tests fetch failed: ${testsErr.message}` }
  if (!tests || tests.length === 0) return { completed: false, reason: "no tests in session" }

  const teacherSlots = (tests as Array<{ role_type: string }>).filter(
    (t) => t.role_type === "teacher",
  ).length
  const patientSlots = (tests as Array<{ role_type: string }>).filter(
    (t) => t.role_type === "patient",
  ).length

  // 2. session 取得 (既に completed なら早期 return)
  const { data: ses, error: sesErr } = await supabase
    .from("test_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle()
  if (sesErr) return { completed: false, reason: `session fetch failed: ${sesErr.message}` }
  if (ses && (ses as { status: string }).status === "completed") {
    return { completed: true, reason: "already completed" }
  }

  // 3. attendance: 出席している学生のみ
  const { data: present, error: attErr } = await supabase
    .from("attendance_records")
    .select("student_id")
    .eq("test_session_id", sessionId)
    .eq("status", "present")
  if (attErr) return { completed: false, reason: `attendance fetch failed: ${attErr.message}` }
  if (!present || present.length === 0) {
    return { completed: false, reason: "no present students" }
  }
  const presentIds = Array.from(
    new Set((present as Array<{ student_id: string }>).map((a) => a.student_id)),
  )

  // 4. exam_results (is_completed=true) を student ごと、evaluator_type ごとに集計
  const { data: results, error: resErr } = await supabase
    .from("exam_results")
    .select("student_id, evaluator_email, evaluator_type, is_completed")
    .eq("test_session_id", sessionId)
    .eq("is_completed", true)
  if (resErr) return { completed: false, reason: `exam_results fetch failed: ${resErr.message}` }

  const map: Record<string, { teacher: Set<string>; patient: Set<string> }> = {}
  for (const r of (results || []) as ExamResultRow[]) {
    const slot = map[r.student_id] || (map[r.student_id] = { teacher: new Set(), patient: new Set() })
    if (r.evaluator_type === "teacher") slot.teacher.add(r.evaluator_email)
    else if (r.evaluator_type === "patient") slot.patient.add(r.evaluator_email)
  }

  // 5. 全 present 学生で OK チェック
  for (const sid of presentIds) {
    const o = map[sid]
    if (!o) return { completed: false, reason: `student ${sid} has no completed evaluation` }
    if (o.teacher.size < teacherSlots) {
      return { completed: false, reason: `student ${sid} teacher ${o.teacher.size}/${teacherSlots}` }
    }
    if (o.patient.size < patientSlots) {
      return { completed: false, reason: `student ${sid} patient ${o.patient.size}/${patientSlots}` }
    }
  }

  // 6. status='completed' に更新
  const { error: updErr } = await supabase
    .from("test_sessions")
    .update({ status: "completed" })
    .eq("id", sessionId)
  if (updErr) return { completed: false, reason: `status update failed: ${updErr.message}` }
  return { completed: true, reason: "auto-marked completed" }
}
