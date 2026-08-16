"use client";

import { updateCapaStatusAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

export function CapaStatusForm({ capaId, status }: { capaId: string; status: string }) {
  const t = useT();

  return (
    <form key={status} action={updateCapaStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="capaId" value={capaId} />
      <Select name="status" defaultValue={status}>
        <SelectTrigger className="h-7 w-32 text-xs">
          <SelectValue>{(value: string) => t(`status.capa.${value}` as DictionaryKey)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">{t("status.capa.open")}</SelectItem>
          <SelectItem value="in_progress">{t("status.capa.in_progress")}</SelectItem>
          <SelectItem value="completed">{t("status.capa.completed")}</SelectItem>
          <SelectItem value="closed">{t("status.capa.closed")}</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="ghost">{t("capa.update")}</Button>
    </form>
  );
}
