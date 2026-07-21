/**
 * 2026-07-16 副田さん要望: 全画面の右下にアプリのバージョンを小さく表示する。
 *
 * 目的: 先生から不具合の連絡が来たとき、スクリーンショット 1 枚で
 *       「どの版を見ているか」が分かるようにする(問い合わせ対応の起点)。
 *
 * 設計上の注意:
 *  - pointer-events-none: 採点画面の最下部にある「入力完了」ボタン等の上に
 *    重なっても、クリックが必ず下のボタンに届くようにする(操作を絶対に妨げない)。
 *  - z-40: ダイアログ (z-50) より下。モーダル表示中は隠れる。
 *  - バージョンは package.json → next.config.mjs 経由で注入 (単一情報源)。
 */
export function AppVersion() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION
  if (!version) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-1.5 right-2 z-40 select-none rounded bg-background/60 px-1.5 py-0.5 text-[10px] leading-none font-medium tabular-nums text-muted-foreground/60 backdrop-blur-[2px]"
    >
      v{version}
    </div>
  )
}
