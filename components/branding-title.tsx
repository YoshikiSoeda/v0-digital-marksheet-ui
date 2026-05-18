"use client"

/**
 * 2026-05-13: トップページなど Server Component から呼ばれる中で、
 * ブランド設定 (タイトル + アイコン) を動的に表示する Client Component。
 *
 * document.title も同期更新するため、ブラウザタブにも反映される。
 */

import { useEffect } from "react"
import { useBranding } from "@/lib/branding/use-branding"
import { BrandingIcon } from "@/components/branding-icon"

interface Props {
  /** 文字スタイルの className(h1 等)。省略時 inline-flex で並べるだけ */
  className?: string
  /** アイコンのサイズ class (絵文字なら font-size、画像なら w-* h-*) */
  iconClassName?: string
  /** document.title もこの内容に同期するか */
  syncDocumentTitle?: boolean
}

export function BrandingTitle({
  className = "",
  iconClassName = "",
  syncDocumentTitle = false,
}: Props) {
  const branding = useBranding()

  useEffect(() => {
    if (syncDocumentTitle && typeof document !== "undefined") {
      document.title = branding.title
    }
  }, [branding.title, syncDocumentTitle])

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandingIcon branding={branding} className={iconClassName} alt="" />
      <span>{branding.title}</span>
    </span>
  )
}
