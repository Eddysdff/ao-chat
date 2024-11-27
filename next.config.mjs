import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  assetPrefix: './',
  webpack: (config) => {
    config.externals.push({
      'warp-arbundles': 'warp-arbundles',
    });
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig; 