/**
 * Phase 9b-α: 統合セッション読込ヘルパー(Client-side)。
 *
 * /api/auth/me を 1 回叩いて Session を取得する React フック。
 * 取得済みの場合は同 hook 呼び出し間で再フェッチしない簡易キャッシュ付き。
 */
"use client"

import { useEffect, useState } from "react"
import type { Session } from "./session"

let _cache: Session | null | undefined = undefined // undefined = 未取得、null = 未ログイン
let _inflight: Promise<Session | null> | null = null

async function fetchSession(): Promise<Session | null> {
  if (_cache !== undefined) return _cache
  if (_inflight) return _inflight
  _inflight = (async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" })
      if (res.status === 401) {
        _cache = null
        return null
      }
      if (!res.ok) {
        _cache = null
        return null
      }
      const json = await res.json()
      _cache = (json?.session ?? null) as Session | null
      return _cache
    } catch {
      _cache = null
      return null
    } finally {
      _inflight = null
    }
  })()
  return _inflight
}

export function useSession(): { session: Session | null; isLoading: boolean } {
  const [session, setSession] = useState<Session | null>(_cache ?? null)
  const [isLoading, setIsLoading] = useState(_cache === undefined)

  useEffect(() => {
    let alive = true
    fetchSession().then((s) => {
      if (alive) {
        setSession(s)
        setIsLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  return { session, isLoading }
}

/**
 * ログアウト後やセッション差し替え時にキャッシュをリセット。
 */
export function invalidateSessionCache(): void {
  _cache = undefined
  _inflight = null
}
