/**
 * CSV 取込用の文字コード自動判定ヘルパー。
 *
 * 経緯 (2026-05-20 副田さん報告):
 *   reader.readAsText(file) は encoding 指定なしだとブラウザ既定の UTF-8 で読む。
 *   日本語ユーザが Excel で保存した CSV はデフォルト Shift-JIS (CP932) のため文字化けする。
 *
 * 方針:
 *   1) UTF-8 を fatal:true で decode 試行(BOM があれば除去)
 *   2) decode 失敗 (=Shift-JIS の高 bit 列が UTF-8 として invalid) なら Shift-JIS で再 decode
 *   3) どちらでも読めないファイル (極稀) は例外
 *
 * テンプレ DL 側 (csvDownloadBlob):
 *   BOM 付き UTF-8 で出力すると Excel で開いても文字化けしない。
 */

/**
 * File を文字列として読み込む。UTF-8 / Shift-JIS を自動判定。
 */
export async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  try {
    let text = new TextDecoder("utf-8", { fatal: true }).decode(buf)
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // BOM 除去
    return text
  } catch {
    try {
      return new TextDecoder("shift_jis", { fatal: false }).decode(buf)
    } catch {
      throw new Error(
        "CSV ファイルの文字コードを判定できませんでした。UTF-8 または Shift_JIS で保存してください。",
      )
    }
  }
}

/**
 * CSV テンプレート用 Blob を作る。BOM 付き UTF-8 で出力するため、Excel でそのまま開いても化けない。
 */
export function csvDownloadBlob(csvText: string): Blob {
  const BOM = "﻿"
  return new Blob([BOM + csvText], { type: "text/csv;charset=utf-8;" })
}

/**
 * 2026-07-03 副田さん指摘: CSV に全角の英数字 (例: "showaD4sp４") が含まれると、
 * DB の半角メール "showaD4sp4" にマッチせずスキップされる問題があった。
 * 全角英数字 [Ａ-Ｚａ-ｚ０-９] を半角に正規化する。
 * (部屋番号の丸数字 ①②③④⑤ は別 Unicode 領域なので影響なし)
 */
export function normalizeHalfwidth(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )
}
