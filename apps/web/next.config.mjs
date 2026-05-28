import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
  webpack(config) {
    if (AUTH_BYPASS) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@clerk/nextjs/server": path.resolve(
          __dirname,
          "src/lib/dev-auth/clerk-mock-server.ts",
        ),
        "@clerk/nextjs": path.resolve(
          __dirname,
          "src/lib/dev-auth/clerk-mock.tsx",
        ),
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
