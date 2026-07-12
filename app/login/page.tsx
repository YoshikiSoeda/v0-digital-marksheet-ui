import { UnifiedLoginForm } from "@/components/unified-login-form"

export default function LoginPage() {
  return (
    // 2026-07-12 デザイン Phase 3-1: 背景にブランドの柔らかいグラデーションを敷く
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(1000px 500px at 50% -10%, var(--color-secondary), transparent 60%), var(--color-background)",
      }}
    >
      <UnifiedLoginForm />
    </div>
  )
}
