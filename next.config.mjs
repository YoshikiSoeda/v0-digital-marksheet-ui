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
  // ADR-001 Phase 9a: V0 由来のスタブルートを削除し、機能ページに redirect
  async redirects() {
    return [
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
    ];
  },
};

export default nextConfig
