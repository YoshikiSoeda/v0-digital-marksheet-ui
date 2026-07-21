import { readFileSync } from "node:fs"

// 2026-07-16: バージョンの単一情報源は package.json。
// ここで読み取って NEXT_PUBLIC_APP_VERSION として全画面に配布する
// (別ファイルに定数を置くと更新漏れで食い違うため)。
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
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
      // 2026-05-13: /admin/users ルート単独は 404 だった (page.tsx 不在、
      // /admin/users/new だけ実装)。/admin/account-management に redirect。
      {
        source: "/admin/users",
        destination: "/admin/account-management",
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
