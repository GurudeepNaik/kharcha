import type { NextConfig } from "next";

// Third-party code: only Google's sign-in script, loaded when Drive backup is used. Everything else loads from this site. Inline scripts are Next's own boot data and the theme script.
// Dev mode needs eval for hot reload, so the policy only applies to production builds.
const csp = [
  "default-src 'self'",
  // wasm-unsafe-eval: the receipt reader runs as WebAssembly (compiled here, from this site's own files).
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://accounts.google.com/gsi/ https://www.googleapis.com/drive/v3/ https://www.googleapis.com/upload/drive/v3/",
  "frame-src https://accounts.google.com/gsi/",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const prod = process.env.NODE_ENV === "production";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(prod ? [{ key: "Content-Security-Policy", value: csp }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
