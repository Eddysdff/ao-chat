import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用 React 严格模式
  reactStrictMode: true,
  
  // 支持图片域名
  images: {
    domains: ['arweave.net'],
  },
  
  // 环境变量
  env: {
    NEXT_PUBLIC_ARWEAVE_GATEWAY: process.env.NEXT_PUBLIC_ARWEAVE_GATEWAY,
    NEXT_PUBLIC_AO_PROCESS_ID: process.env.NEXT_PUBLIC_AO_PROCESS_ID,
  },
  
  // WebRTC 相关配置
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
    };
    return config;
  },
};

export default nextConfig;
