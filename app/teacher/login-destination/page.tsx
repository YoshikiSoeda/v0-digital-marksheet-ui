/**
 * A-? (2026-05-20 副田さん仕様): admin-like 教員のログイン直後の遷移先選択画面。
 *   - 管理画面 (/admin/dashboard) に行きたい
 *   - 試験セッション (採点) に行きたい
 *
 * lib/auth/verify.ts の getRedirectTo() がこのページを redirectTo として返す。
 */
import { TeacherLoginDestination } from "@/components/teacher-login-destination"

export default function Page() {
  return <TeacherLoginDestination />
}
