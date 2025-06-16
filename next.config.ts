import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // 🔧 빌드 시 ESLint 오류 무시
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
