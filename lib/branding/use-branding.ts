"use client"

/**
 * 2026-05-13: ブランド設定 (タイトル + アイコン) を読み込む React フック。
 *
 * /api/branding を 1 回 fetch してキャッシュ。app-shell.tsx ヘッダー、
 * トップページ、ブラウザタブ <title> 等で使用。更新時は invalidateBrandingCache()。
 */

import { useEffect, useState } from "react"

export interface Branding {
  title: string
  icon: string
}

const DEFAULT_BRANDING: Branding = {
  title: "医療面接評価システム",
  icon: "🏥",
}

let _cache: Branding | null = null
let _inflight: Promise<Branding> | null = null

async function fetchBranding(): Promise<Branding> {
  if (_cache) return _cache
  if (_inflight) return _inflight
  _inflight = (async () => {
    try {
      const res = await fetch("/api/branding", { credentials: "omit" })
      if (!res.ok) {
        _cache = DEFAULT_BRANDING
        return DEFAULT_BRANDING
      }
      const json = await res.json()
      const b = json?.branding as Branding | undefined
      _cache = {
        title: b?.title || DEFAULT_BRANDING.title,
        icon: b?.icon || DEFAULT_BRANDING.icon,
      }
      return _cache
    } catch {
      _cache = DEFAULT_BRANDING
      return DEFAULT_BRANDING
    } finally {
      _inflight = null
    }
  })()
  return _inflight
}

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(_cache ?? DEFAULT_BRANDING)
  useEffect(() => {
    let alive = true
    fetchBranding().then((b) => {
      if (alive) setBranding(b)
    })
    return () => {
      alive = false
    }
  }, [])
  return branding
}

export function invalidateBrandingCache(): void {
  _cache = null
  _inflight = null
}
