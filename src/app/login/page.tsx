import { Leaf, AlertTriangle, FileCheck2, GraduationCap, BarChart3 } from "lucide-react";
import { LoginForm } from "./login-form";
import { T } from "@/components/i18n/t";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { InstallAppButton } from "@/components/layout/install-app-button";
import type { DictionaryKey } from "@/lib/i18n/translate";

const FEATURES: { icon: React.ComponentType<{ className?: string }>; labelKey: DictionaryKey }[] = [
  { icon: AlertTriangle, labelKey: "auth.feature.incident" },
  { icon: FileCheck2, labelKey: "auth.feature.records" },
  { icon: GraduationCap, labelKey: "auth.feature.training" },
  { icon: BarChart3, labelKey: "auth.feature.report" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/";
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-1">
      {/* Brand panel — same dark-green sidebar identity as the app shell, not a stock
          illustration, so it actually looks like it belongs to this product. */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="pointer-events-none absolute -top-28 -left-20 size-80 rounded-full bg-sidebar-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-sidebar-primary/15 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sidebar-primary/20">
            <Leaf className="size-6 text-sidebar-primary" />
          </span>
          <p className="text-base font-semibold">
            <T k="common.appName" />
          </p>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            <T k="common.appName" />
          </h1>
          <p className="mt-3 text-sm text-sidebar-foreground/70">
            <T k="auth.tagline" />
          </p>
          <ul className="mt-9 flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, labelKey }) => (
              <li key={labelKey} className="flex items-center gap-3 text-sm text-sidebar-foreground/85">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15">
                  <Icon className="size-4 text-sidebar-primary" />
                </span>
                <T k={labelKey} />
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/45">
          © {year} <T k="common.appName" />
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="relative flex flex-1 items-center justify-center bg-background p-6">
        <div className="absolute top-6 left-6">
          <InstallAppButton />
        </div>
        <div className="absolute top-6 right-6">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-sm">
          <span className="mb-6 flex size-11 items-center justify-center rounded-2xl bg-primary/10 md:hidden">
            <Leaf className="size-6 text-primary" />
          </span>

          <h2 className="text-2xl font-semibold tracking-tight">
            <T k="auth.welcomeBack" />
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <T k="auth.signInToContinue" />
          </p>

          <div className="mt-8">
            <LoginForm callbackUrl={callbackUrl} />
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            © {year} <T k="common.appName" />
          </p>
        </div>
      </div>
    </div>
  );
}
