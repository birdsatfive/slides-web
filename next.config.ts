import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
    ...({
      proxyClientMaxBodySize: "200mb",
    } as Record<string, unknown>),
  },
};

export default nextConfig;
