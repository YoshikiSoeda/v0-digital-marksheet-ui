"use client"

/**
 * 2026-05-13: ブランドアイコン表示用コンポーネント。
 *
 * iconUrl があれば <img> で表示、無ければ絵文字 (icon) で表示。
 * 画像読み込み失敗時は絵文字にフォールバック。
 */

import { useState } from "react"
import type { Branding } from "@/lib/branding/use-branding"

interface Props {
  branding: Pick<Branding, "icon" | "iconUrl">
  /** font-size / sizing 用の className(例: "text-2xl w-8 h-8") */
  className?: string
  /** alt 用 (画像のときのみ使用) */
  alt?: string
}

export function BrandingIcon({ branding, className = "", alt = "" }: Props) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = !!branding.iconUrl && !imageFailed

  if (showImage) {
    return (
      <img
        src={branding.iconUrl as string}
        alt={alt}
        className={`object-contain inline-block ${className}`}
        onError={() => setImageFailed(true)}
      />
    )
  }
  return (
    // box を fixed (w-* h-*) で渡された場合でも絵文字が中央に来るよう inline-flex 配置
    <span
      className={`inline-flex items-center justify-center leading-none ${className}`}
      aria-hidden="true"
    >
      {branding.icon}
    </span>
  )
}
