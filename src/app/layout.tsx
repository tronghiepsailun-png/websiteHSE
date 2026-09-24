import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nền tảng Quản lý HSE",
  description: "Nền tảng quản lý An toàn - Sức khỏe - Môi trường (HSE) đa công ty",
  applicationName: "24HSE",
  // iOS reads this for the name shown under the home-screen icon — the page <title> (long,
  // and Vietnamese-diacritic-heavy) is what it fell back to without this, which is where the
  // garbled "NentangQuanly..." label came from.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "24HSE",
  },
};

// Tints the phone browser's address bar/status area to match the app's light or dark surface.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full flex flex-col overflow-hidden bg-muted/30">
        {/* strategy="beforeInteractive" is Next's own hook for exactly this: it injects the
            script into the initial HTML and runs it before hydration, instead of as a plain DOM
            script tag React won't execute on its own. Needed because beforeinstallprompt is a
            one-shot event with no "did it already fire" API — a useEffect-attached listener
            (InstallAppButton) can genuinely lose the race and never see it; stashing it on
            window here means the button still finds it whenever it mounts. */}
        <Script id="capture-install-prompt" strategy="beforeInteractive">
          {"window.__bipEvent=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bipEvent=e;});"}
        </Script>
        <ThemeProvider>
          <LocaleProvider initialLocale={locale}>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors position="top-right" />
            <ServiceWorkerRegister />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
