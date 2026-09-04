import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 沙箱工具链需要 standalone 产物时设 NEXT_STANDALONE=1；Vercel 构建不需要（避免与 Vercel 产物追踪冲突）
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
