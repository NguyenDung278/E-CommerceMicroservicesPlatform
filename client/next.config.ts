import type { NextConfig } from "next";

import { nextImageRemotePatterns } from "./src/lib/images/host-policy";

const gatewayOrigin =
  process.env.API_GATEWAY_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: nextImageRemotePatterns,
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
