/**
 * Phase 9b-α: 現セッションの claim を返す API。
 *
 * Cookie が無い / 壊れている場合は middleware が 401 を返すため、
 * このハンドラまで到達した時点で session は有効。
 *
 * UI 側は useSession() フック(lib/auth/use-session.ts)経由で叩く。
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/session"

export async function GET() {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ session }, { status: 200 })
}
