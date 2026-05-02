/** @type {import('next').NextConfig} */
const nextConfig = {
  // typescript.ignoreBuildErrors を解除した(2026-04-25, type-fix Phase 6)
  // ビルド時に型エラーがあれば即失敗させ、CI で品質保証する
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // ADR-001 Phase 9a / 9d-2: 旧スタブルート + 旧ロール別ログインの統合 redirect
  async redirects() {
    return [
      // V0 由来のスタブルート(Phase 9a)
      {
        source: "/admin/students",
        destination: "/admin/students-list",
        permanent: true,
      },
      {
        source: "/admin/questions",
        destination: "/admin/question-management",
        permanent: true,
      },
      // ADR-001 §7-1: ログイン入口は /login に統一(Phase 9d-2)
      {
        source: "/admin/login",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/teacher/login",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/patient/login",
        destination: "/login",
        permanent: true,
      },
    ];
  },
};

export default nextConfig
