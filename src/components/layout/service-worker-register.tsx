"use client";

import { useEffect } from "react";

/** Registers the no-op service worker (public/sw.js) — its only job is to make Chrome/Android
 *  consider this page "installable" so InstallAppButton's native prompt actually fires. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
