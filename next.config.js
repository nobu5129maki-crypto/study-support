/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Next 14: App Router のサーバー側で @google/genai をバンドルせず node_modules から読む（ビルド失敗防止）
  experimental: {
    serverComponentsExternalPackages: ["@google/genai"],
  },
};

module.exports = nextConfig;