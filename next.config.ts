import type { NextConfig } from "next";

// Browser-enforced hardening that application code can't guarantee on its own. No CSP on purpose:
// Next's inline bootstrap scripts need a per-request nonce setup to coexist with one, and a wrong
// CSP silently blanks the whole app — these headers carry no such risk.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Loaded from node_modules at runtime instead of being bundled — pptxgenjs pulls in Node-only
  // modules (fs, https, jszip) that bundlers handle inconsistently.
  serverExternalPackages: ["pptxgenjs"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // "Quản lý bảo an" moved out of the employees module into its own /security section; keep old
  // bookmarks and links working.
  async redirects() {
    return [{ source: "/employees/security/:path*", destination: "/security/:path*", permanent: true }];
  },
  experimental: {
    // Both the incidents and employees Excel-import actions already enforce their own 25MB
    // file-size ceiling (MAX_IMPORT_SIZE_BYTES), and confirming an employee import sends every
    // changed/new row back as a Server Action argument (thousands of rows for a full-roster
    // update) — either path is comfortably past the framework's 1MB default, which failed with
    // "Body exceeded 1 MB limit" (413) on a real 3000+ row update. Matches the app's own
    // already-stated 25MB ceiling instead of an arbitrary smaller number.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
