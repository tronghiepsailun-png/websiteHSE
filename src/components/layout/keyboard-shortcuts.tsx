"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

/** "g" then a second key jumps to a module, GitHub/Linear style. Keys are the English mnemonic
 *  of the destination so they stay stable across the VI/ZH interface languages. */
const GO_TO_ROUTES: { key: string; href: string; labelKey: DictionaryKey }[] = [
  { key: "h", href: "/", labelKey: "nav.dashboard" },
  { key: "p", href: "/planning", labelKey: "nav.workPlan" },
  { key: "i", href: "/incidents", labelKey: "nav.incidents" },
  { key: "c", href: "/capa", labelKey: "nav.capa" },
  { key: "e", href: "/employees", labelKey: "nav.employees" },
  { key: "v", href: "/violations", labelKey: "nav.violations" },
  { key: "k", href: "/inventory", labelKey: "nav.inventory" },
  { key: "r", href: "/records/pccc", labelKey: "nav.recordsPccc" },
];

/** True while the user is typing somewhere a bare letter must stay a letter. */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useT();
  // Set by "g" and cleared on the next key (or after a moment) so "g" + "i" reads as one chord
  // instead of two unrelated presses.
  const goPending = useRef(false);
  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;

      if (goPending.current) {
        const match = GO_TO_ROUTES.find((r) => r.key === e.key.toLowerCase());
        goPending.current = false;
        if (goTimer.current) clearTimeout(goTimer.current);
        if (match) {
          e.preventDefault();
          setOpen(false);
          router.push(match.href);
        }
        return;
      }

      // Some layouts/browsers report the shifted "/" as "/" with shiftKey rather than "?".
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      if (e.key.toLowerCase() === "g") {
        goPending.current = true;
        if (goTimer.current) clearTimeout(goTimer.current);
        goTimer.current = setTimeout(() => {
          goPending.current = false;
        }, 1500);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (goTimer.current) clearTimeout(goTimer.current);
    };
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
          <DialogDescription>{t("shortcuts.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("shortcuts.group.general")}</h3>
            <ShortcutRow keys={["Ctrl", "K"]} label={t("shortcuts.commandPalette")} />
            <ShortcutRow keys={["?"]} label={t("shortcuts.showShortcuts")} />
            <ShortcutRow keys={["Esc"]} label={t("shortcuts.closeDialog")} />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("shortcuts.group.goTo")}</h3>
            {GO_TO_ROUTES.map((route) => (
              <ShortcutRow key={route.href} keys={["G", route.key.toUpperCase()]} label={t(route.labelKey)} />
            ))}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((key) => (
          <kbd key={key} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {key}
          </kbd>
        ))}
      </span>
    </div>
  );
}
