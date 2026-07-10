"use client"

/**
 * 2026-05-08 (ADR-001 §1.2 F4 部分): exam page wrapper の重複削減。
 *
 * teacher/exam/page.tsx と patient/exam/page.tsx は ほぼ同じガード処理:
 *   1. session loading 表示
 *   2. session 無し → /login へ redirect
 *   3. ロール不一致 → エラー UI(管理者の場合は /admin/dashboard 案内付き)
 *   4. selectedTestId 無し → /exam-info へ redirect
 *   5. 必須情報欠落(email など) → エラー UI
 *
 * これを <ExamErrorScreen> + useExamPageGuard() に抽出する。
 *
 * F4 全体 (ExamTabs 本体 1200 行 の共通化) は本 PR スコープ外。
 * 本 PR は page wrapper のみで risk を最小化。
 */

import { useRouter } from "next/navigation"
import { useState, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { useSession } from "@/lib/auth/use-session"
import type { Session } from "@/lib/auth/session"

const ADMIN_ROLES = new Set([
  "master_admin",
  "university_admin",
  "subject_admin",
  "admin",
  "special_master",
  "university_master",
])

// 2026-07-10 副田さん要望: 大学管理者/教科管理者/マスター管理者は代理入力として
//   /teacher/exam だけでなく /patient/exam にも入れる。teachers.role がこのいずれかで
//   /patient/exam にアクセスした場合は loginType 不一致でも通す。
const ADMIN_LIKE_TEACHER_ROLES = new Set([
  "master_admin",
  "university_admin",
  "subject_admin",
])

interface ExamErrorScreenProps {
  title: string
  message: string
  primaryLabel: string
  primaryAction: () => void
  secondaryLabel?: string
  secondaryAction?: () => void
}

export function ExamErrorScreen({
  title,
  message,
  primaryLabel,
  primaryAction,
  secondaryLabel,
  secondaryAction,
}: ExamErrorScreenProps) {
  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-lg p-6 space-y-4 text-center shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={primaryAction}>{primaryLabel}</Button>
          {secondaryLabel && secondaryAction && (
            <Button variant="outline" onClick={secondaryAction}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export type ExamPageGuardOutcome =
  | { kind: "loading" }
  | { kind: "redirect" } // already pushing
  | { kind: "error"; render: () => ReactElement }
  | { kind: "ok"; session: Session; selectedTestId: string }

interface UseExamPageGuardOptions {
  /** "teacher" or "patient" - 想定するログイン種別 */
  expectedLoginType: "teacher" | "patient"
  /** sessionStorage のキー名(teacher_selected_test or patient_selected_test) */
  selectedTestStorageKey: string
  /** /exam-info の遷移先 */
  examInfoPath: string
  /** 役割名(エラー UI 表示用、例: "教員" / "患者役") */
  roleLabel: string
  /** 部屋必須かどうか(true=teacher general、false=patient or ELEVATED teacher) */
  requireRoom?: boolean
  /** ELEVATED ロール判定で部屋必須を緩和する関数(teacher 専用) */
  isElevatedRole?: (role: string) => boolean
}

/**
 * 上記の段階的ガードをまとめて返す。
 * page.tsx 側は outcome.kind に応じて render するだけになる。
 *
 * teacher 側で ELEVATED ロール (university_admin / subject_admin) の場合:
 *   - 部屋未割当でも ok を返す(ExamTabs 側で部屋ピッカーを出す)
 */
export function useExamPageGuard(opts: UseExamPageGuardOptions): ExamPageGuardOutcome {
  const router = useRouter()
  const { session, isLoading } = useSession()
  const [selectedTestId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem(opts.selectedTestStorageKey)
  })

  if (isLoading) return { kind: "loading" }

  if (!session) {
    if (typeof window !== "undefined") router.push("/login")
    return { kind: "redirect" }
  }

  // ロール不一致 → エラー UI
  // 2026-07-10 副田さん要望: admin-like teacher (univ_admin/subject_admin/master_admin)
  //   が /patient/exam に代理入力目的で入るケースは通す。
  const isAdminLikeTeacherAccessing =
    session.loginType === "teacher" &&
    ADMIN_LIKE_TEACHER_ROLES.has(session.role) &&
    (opts.expectedLoginType === "teacher" || opts.expectedLoginType === "patient")

  if (session.loginType !== opts.expectedLoginType && !isAdminLikeTeacherAccessing) {
    const isAdmin =
      ADMIN_ROLES.has(session.role) || ADMIN_ROLES.has(session.accountType) || session.loginType === "admin"
    return {
      kind: "error",
      render: () => (
        <ExamErrorScreen
          title={`この画面は${opts.roleLabel}専用です`}
          message={
            isAdmin
              ? `管理者アカウントでは試験の実施・採点はできません。\n試験を実施するには${opts.roleLabel}アカウントでログインしてください。`
              : `${opts.roleLabel}アカウントでログインしてからアクセスしてください。`
          }
          primaryLabel={isAdmin ? "管理画面に戻る" : "ログイン画面へ"}
          primaryAction={() => router.push(isAdmin ? "/admin/dashboard" : "/login")}
          secondaryLabel={isAdmin ? "ログイン画面へ" : undefined}
          secondaryAction={isAdmin ? () => router.push("/login") : undefined}
        />
      ),
    }
  }

  if (!selectedTestId) {
    if (typeof window !== "undefined") router.push(opts.examInfoPath)
    return { kind: "redirect" }
  }

  if (!session.email) {
    return {
      kind: "error",
      render: () => (
        <ExamErrorScreen
          title="セッション情報が不完全です"
          message={`${opts.roleLabel}のメールアドレスが取得できませんでした。\n一度ログアウトして再度ログインしてください。`}
          primaryLabel="ログイン画面へ"
          primaryAction={() => router.push("/login")}
        />
      ),
    }
  }

  // 部屋必須チェック(teacher general 用)。ELEVATED は緩和。
  if (opts.requireRoom) {
    const role = session.role || ""
    const isElevated = opts.isElevatedRole?.(role) ?? false
    const hasRoom = !!session.assignedRoomNumber
    if (!hasRoom && !isElevated) {
      return {
        kind: "error",
        render: () => (
          <ExamErrorScreen
            title="担当部屋が未割当です"
            message={`あなたのアカウントには担当部屋が割り当てられていません。\n管理者に連絡して担当部屋を設定してもらってください。`}
            primaryLabel="ログイン画面へ"
            primaryAction={() => router.push("/login")}
          />
        ),
      }
    }
  } else {
    // patient: 部屋がないとそもそも採点対象が不明なのでエラー
    if (!session.assignedRoomNumber) {
      return {
        kind: "error",
        render: () => (
          <ExamErrorScreen
            title="セッション情報が不完全です"
            message={`${opts.roleLabel}のメールアドレスまたは担当部屋番号が取得できませんでした。\n一度ログアウトして再度ログインしてください。`}
            primaryLabel="ログイン画面へ"
            primaryAction={() => router.push("/login")}
          />
        ),
      }
    }
  }

  return { kind: "ok", session, selectedTestId }
}
