import type * as React from "react"
import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 2026-07-12 デザイン Phase 3-2/3-3 (副田さん提案書):
 * 一覧が空のときの共通「空状態」。素の「◯◯が登録されていません」テキストを
 * アイコン + 見出し + 次の一手 に置き換え、迷いを減らす。
 *
 * 使い方:
 *   <EmptyState title="大学が登録されていません" description="「大学を追加」から登録してください" />
 *   <EmptyState icon={DoorOpen} title="部屋がありません" action={<Button>部屋を追加</Button>} />
 */
interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-12 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/70">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-foreground/80">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
