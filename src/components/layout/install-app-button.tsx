"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, SquarePlus, PlusSquare, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/locale-context";

// Chrome fires this on any page that meets its installability bar and lets the page trigger the
// native install prompt itself. It's a one-shot event with no "did it already fire" API, and
// Chrome can fire it before React ever hydrates — so the *only* reliable way to not miss it is
// an inline <script> in <body> (see layout.tsx) that attaches a listener the instant the HTML
// starts parsing, stashing the event on window for this component to pick up whenever it mounts.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __bipEvent?: BeforeInstallPromptEvent | null;
  }
}

const SEEN_KEY = "hse_install_prompt_seen";

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Modern iPadOS reports as "MacIntel" with touch support — the iPhone/iPod substring check
  // alone misses iPads entirely.
  const isIPadOS = ua.includes("Macintosh") && typeof document !== "undefined" && "ontouchend" in document;
  return /iPhone|iPad|iPod/.test(ua) || isIPadOS;
}

function isAndroidDevice() {
  return typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as { standalone?: boolean }).standalone === true;
}

function hasSeenPrompt() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {}
}

/** "Tải ứng dụng" — installs this PWA to the home screen/app list. A manual button stays
 *  available always (until installed), but the whole point of this component is that most
 *  people who open a shared link never go looking for a button or read steps — so on a phone
 *  (iOS or Android) it also opens itself automatically on first visit, once per browser (tracked
 *  in localStorage, not re-shown after it's been seen once whether or not they installed). Three
 *  tiers: a captured native Chrome prompt gets a one-tap confirm that fires the real install
 *  dialog from a genuine click (Chrome won't honor `.prompt()` outside a user gesture, so even
 *  the auto-opened version waits for this tap rather than calling it straight from an effect);
 *  iOS gets the manual Share-sheet steps (no programmatic install exists there at all); anything
 *  else (desktop, or a phone browser Chrome hasn't blessed yet) gets a generic pointer, shown
 *  only on request, never auto-opened, since unprompted popups on a desktop login are just noise. */
export function InstallAppButton({ className }: { className?: string }) {
  const t = useT();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [guide, setGuide] = useState<"ios" | "install" | "generic" | null>(null);
  const [installed, setInstalled] = useState(false);
  // A ref (not state) so the beforeinstallprompt listener — attached once, on mount — always
  // reads the current value instead of whatever "armed" was at the moment the listener closure
  // was created.
  const autoShowArmedRef = useRef(false);

  useEffect(() => {
    const ios = isIOSDevice();
    const android = isAndroidDevice();
    const standalone = isStandalone();
    setIsIOS(ios);
    setIsAndroid(android);
    setInstalled(standalone);

    const shouldArm = !standalone && !hasSeenPrompt() && (ios || android);
    autoShowArmedRef.current = shouldArm;

    if (shouldArm && ios) {
      const timer = setTimeout(() => setGuide("ios"), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    function applyPrompt(e: BeforeInstallPromptEvent) {
      window.__bipEvent = e;
      setDeferredPrompt(e);
      if (autoShowArmedRef.current && isAndroidDevice() && !hasSeenPrompt()) setGuide("install");
    }

    if (window.__bipEvent) applyPrompt(window.__bipEvent);

    function onPrompt(e: Event) {
      e.preventDefault();
      applyPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
      window.__bipEvent = null;
      markSeen();
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  function closeGuide(open: boolean) {
    if (!open) markSeen();
    setGuide(open ? guide : null);
  }

  function handleButtonClick() {
    if (deferredPrompt) setGuide("install");
    else if (isIOS) setGuide("ios");
    else setGuide("generic");
  }

  async function handleInstallConfirm() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
    window.__bipEvent = null;
    markSeen();
    setGuide(null);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleButtonClick} className={className}>
        <Download className="size-4" />
        {t("auth.installApp")}
      </Button>

      <Dialog open={guide === "install"} onOpenChange={closeGuide}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("auth.installApp")}</DialogTitle>
            <DialogDescription>{t("auth.installAppConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={handleInstallConfirm} className="w-full">
              {t("auth.installAppConfirmCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={guide === "ios"} onOpenChange={closeGuide}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("auth.installApp")}</DialogTitle>
            <DialogDescription>{t("auth.installAppIosIntro")}</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
              <span className="flex items-center gap-1.5">
                {t("auth.installAppIosStep1")}
                <Share className="size-4 shrink-0 text-primary" />
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
              <span className="flex items-center gap-1.5">
                {t("auth.installAppIosStep2")}
                <SquarePlus className="size-4 shrink-0 text-primary" />
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
              <span className="flex items-center gap-1.5">
                {t("auth.installAppIosStep3")}
                <PlusSquare className="size-4 shrink-0 text-primary" />
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>

      <Dialog open={guide === "generic"} onOpenChange={closeGuide}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("auth.installApp")}</DialogTitle>
            <DialogDescription>{t("auth.installAppGenericIntro")}</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
              <span className="flex items-center gap-1.5">
                {t("auth.installAppGenericStep1")}
                <MoreVertical className="size-4 shrink-0 text-primary" />
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
              <span>{t("auth.installAppGenericStep2")}</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
