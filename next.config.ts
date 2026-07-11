import type { NextConfig } from "next";

// Server Actions (every form/button in this app uses them) are protected
// against CSRF by comparing the request Origin to the Host. Behind a proxy
// — GitHub Codespaces, Gitpod, a tunnel, or your production reverse proxy —
// those differ, and Next.js rejects the action with "Invalid Server Actions
// request". List the trusted proxy hosts here.
//
// Codespaces forwards ports at <name>-<port>.app.github.dev. Add your own
// production/preview hosts via ALLOWED_ORIGINS (comma-separated), e.g.
//   ALLOWED_ORIGINS=comn.one,www.comn.one
const extraOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.app.github.dev", // GitHub Codespaces
        "*.gitpod.io",
        ...extraOrigins,
      ],
    },
  },
};

export default nextConfig;
