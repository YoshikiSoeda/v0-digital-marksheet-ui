/**
 * A-2 (2026-05-20 副田さん仕様): 試験セッション内で同 roleType のテストが複数ある場合、
 * 「教員側①」「教員側②」のように自動採番表示する。
 *
 * 1 セッション内で同 roleType が 1 個しかなければ番号なし (「教員側」)。
 * 採番順は createdAt の昇順 (古い方から ①、②、...)。
 */
import type { Test } from "@/lib/types"

const CIRCLE_NUMERALS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]

function roleLabel(roleType: string | undefined): string {
  return (roleType || "teacher") === "patient" ? "患者役側" : "教員側"
}

/**
 * 渡された tests 全体を見て、各 test.id → 表示ラベルのマップを作る。
 * グループ化キー: (testSessionId, roleType)。
 *
 * @param tests テスト一覧 (異なるセッション/roleType が混在していて OK)
 * @returns testId → "教員側" | "教員側①" のような表示文字列
 */
export function buildTestLabelMap(tests: Test[]): Record<string, string> {
  const groups: Record<string, Test[]> = {}
  for (const t of tests) {
    const sessionKey = (t as Test & { testSessionId?: string }).testSessionId || "unassigned"
    const roleKey = (t as Test & { roleType?: string }).roleType || "teacher"
    const key = `${sessionKey}::${roleKey}`
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  const map: Record<string, string> = {}
  for (const [, list] of Object.entries(groups)) {
    list.sort((a, b) => {
      const da = new Date(a.createdAt || 0).getTime()
      const db = new Date(b.createdAt || 0).getTime()
      return da - db
    })
    const role = roleLabel((list[0] as Test & { roleType?: string }).roleType)
    list.forEach((t, i) => {
      if (list.length === 1) {
        map[t.id] = role
      } else {
        const suffix = CIRCLE_NUMERALS[i] || `(${i + 1})`
        map[t.id] = `${role}${suffix}`
      }
    })
  }
  return map
}

/**
 * 単一のテストについて、同セッション内の他テストを考慮した表示ラベルを返す。
 * (1 個だけのときは番号なし)
 */
export function testDisplayLabel(test: Test, allTests: Test[]): string {
  const map = buildTestLabelMap(allTests)
  return map[test.id] || roleLabel((test as Test & { roleType?: string }).roleType)
}
