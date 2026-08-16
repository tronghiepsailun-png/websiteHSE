"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale-context";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-semibold">{t("common.errorTitle")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("common.errorDescription")}</p>
      <Button onClick={() => reset()}>{t("common.retry")}</Button>
    </div>
  );
}
