import type { NextConfig } from "next";

const gatewayOrigin =
  process.env.API_GATEWAY_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${gatewayOrigin}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${gatewayOrigin}/health`,
      },
    ];
  },
};

export default nextConfig;
