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
 
}

export default nextConfig
