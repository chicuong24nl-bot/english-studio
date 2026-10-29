import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.LIBARIA_BUILD_DIR ?? ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1", "26.195.39.149"],
  images: { unoptimized: true },
  devIndicators: false,
  headers: async () => [
    {
      source: "/api/(.*)",
      headers: [
        {
          key: "Access-Control-Allow-Origin",
          value: "*",
        },
        {
          key: "Access-Control-Allow-Methods",
          value: "GET, POST, PUT, DELETE, OPTIONS",
        },
        {
          key: "Access-Control-Allow-Headers",
          value: "Content-Type, Authorization",
        },
        {
          key: "Content-Range",
          value: "bytes : 0-9/*",
        },
      ],
    },
  ],
};

export default nextConfig;
