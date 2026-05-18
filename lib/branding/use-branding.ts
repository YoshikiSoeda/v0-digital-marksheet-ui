"use client"

/**
 * 2026-05-13 (改訂): ブランド設定を大学ごとに切り替える React フック。
 *
 * - ログイン中: session.universityCode で /api/branding?university_code=xxx を fetch
 * - 未ログイン or universityCode 不明: デフォルト「医療面接評価システム」/「🏥」
 *
 * 大学ごとにキャッシュし、universityCode が変わったら再 fetch。
 * 設定保存後は invalidateBrandingCache(universityCode?) で無効化。
 */

import { useEffect, useState } from "react"
import { useSession } from "@/lib/auth/use-session"

export interface Branding {
  title: string
  icon: string
}

const DEFAULT_BRANDING: Branding = {
  title: "医療面接評価システム",
  icon: "🏥",
}

// universityCode -> Branding (大学未指定は "" key で default)
const _cache = new Map<string, Branding>()
const _inflight = new Map<string, Promise<Branding>>()

async function fetchBranding(universityCode: string): Promise<Branding> {
  const cached = _cache.get(universityCode)
  if (cached) return cached
  const inflight = _inflight.get(universityCode)
  if (inflight) return inflight

  const p = (async () => {
    try {
      const url = universityCode
        ? `/api/branding?university_code=${encodeURIComponent(universityCode)}`
        : "/api/branding"
      const res = await fetch(url, { credentials: "omit" })
      if (!res.ok) {
        _cache.set(universityCode, DEFAULT_BRANDING)
        return DEFAULT_BRANDING
      }
      const json = await res.json()
      const b = json?.branding as Branding | undefined
      const value: Branding = {
        title: b?.title || DEFAULT_BRANDING.title,
        icon: b?.icon || DEFAULT_BRANDING.icon,
      }
      _cache.set(universityCode, value)
      return value
    } catch {
      _cache.set(universityCode, DEFAULT_BRANDING)
      return DEFAULT_BRANDING
    } finally {
      _inflight.delete(universityCode)
    }
  })()
  _inflight.set(universityCode, p)
  return p
}

/**
 * 現在のユーザーの所属大学のブランド設定を返す。
 * session loading 中 / 未ログイン / 大学未設定 はデフォルトを返す。
 */
export function useBranding(): Branding {
  const { session, isLoading } = useSession()
  const universityCode = !isLoading && session?.universityCode ? session.universityCode : ""
  const [branding, setBranding] = useState<Branding>(_cache.get(universityCode) ?? DEFAULT_BRANDING)

  useEffect(() => {
    let alive = true
    fetchBranding(universityCode).then((b) => {
      if (alive) setBranding(b)
    })
    return () => {
      alive = false
    }
  }, [universityCode])

  return branding
}

/**
 * 任意の大学のブランド設定を返す。設定画面で「対象大学を切替えてプレビュー」
 * 等に使用 (special_master 用)。session に依存しない直接 fetch。
 */
export function useBrandingFor(universityCode: string): Branding {
  const [branding, setBranding] = useState<Branding>(_cache.get(universityCode) ?? DEFAULT_BRANDING)
  useEffect(() => {
    let alive = true
    fetchBranding(universityCode).then((b) => {
      if (alive) setBranding(b)
    })
    return () => {
      alive = false
    }
  }, [universityCode])
  return branding
}

export function invalidateBrandingCache(universityCode?: string): void {
  if (universityCode === undefined) {
    _cache.clear()
    _inflight.clear()
  } else {
    _cache.delete(universityCode)
    _inflight.delete(universityCode)
  }
}
