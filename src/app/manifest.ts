import type { MetadataRoute } from "next";

// Drives the "Add to Home Screen" name/icon on both iOS and Android — without this, the
// browser falls back to auto-generating a plain-letter icon from the page title (exactly the
// ugly black "N" square this replaces) and truncates the full page title as the label instead
// of a short, deliberate app name.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "24HSE - Nền tảng Quản lý HSE",
    short_name: "24HSE",
    description: "Nền tảng quản lý An toàn - Sức khỏe - Môi trường (HSE) đa công ty",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#16a34a",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
