import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
