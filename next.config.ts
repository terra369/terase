import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@core': path.resolve(__dirname, 'core'),
    };
    return config;
  },
};

export default nextConfig;
