import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Baseline security headers. A 2026-08-11 review found none of the BAF apps
   * sent any, so every one of them was framable and would accept a downgraded
   * first request.
   *
   * HSTS deliberately omits includeSubDomains: some birdsatfive.dk subdomains
   * are served off one.com rather than our own proxy, and a blanket directive
   * from this app would apply to them too.
   *
   * No CSP here — it needs per-app tuning against real pages, and a wrong one
   * breaks the app silently. Tracked separately.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
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
