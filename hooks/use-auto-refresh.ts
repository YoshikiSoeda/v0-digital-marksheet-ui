/**
 * 2026-07-10 副田さん要望 (案 C ハイブリッド):
 *   管理画面の情報を頻繁に更新するための共通フック。
 *
 * 動作:
 *   1. 画面がタブフォーカスされた瞬間 (`visibilitychange` → visible) に refresh
 *   2. 表示中は intervalMs (デフォルト 30 秒) ごとに refresh
 *   3. 非表示 (別タブ) の間は polling を skip する (無駄なネットワーク回避)
 *
 * 利用例:
 *   const refresh = useCallback(async () => { ... }, [deps])
 *   useAutoRefresh(refresh)     // 30 秒間隔
 *   useAutoRefresh(refresh, 15000)  // 15 秒間隔
 *
 * refresh は関数参照が変わるたびに reset される。無限ループを避けるため
 * caller は useCallback で安定化させること。
 */
import { useEffect } from "react"

export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  intervalMs: number = 30000,
): void {
  useEffect(() => {
    if (typeof document === "undefined") return

    const trigger = () => {
      if (document.visibilityState === "visible") {
        void refresh()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    const interval = setInterval(trigger, intervalMs)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(interval)
    }
  }, [refresh, intervalMs])
}
