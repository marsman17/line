import type { NextConfig } from "next";
const isDevelopment = process.env.NODE_ENV === "development";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["web-push", "sharp"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${isDevelopment ? " ws: wss:" : ""}; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; worker-src 'self'`,
          },
        ],
      },
    ];
  },
};
export default config;
