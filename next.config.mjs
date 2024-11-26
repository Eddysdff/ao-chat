import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['arweave.net'],
  },
  env: {
    NEXT_PUBLIC_ARWEAVE_GATEWAY: process.env.NEXT_PUBLIC_ARWEAVE_GATEWAY,
    NEXT_PUBLIC_AO_PROCESS_ID: process.env.NEXT_PUBLIC_AO_PROCESS_ID,
  },
  webpack: (config) => {
    config.externals.push({
      'warp-arbundles': 'warp-arbundles',
    });
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
    };
    return config;
  },
};

export default nextConfig; 