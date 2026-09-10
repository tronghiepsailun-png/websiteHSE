"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { T } from "@/components/i18n/t";
import { cn } from "@/lib/utils";
import { reorderSafetyOfficersAction, updateSafetyOfficerSubsidyAction, toggleSafetyOfficerActiveAction } from "./actions";

export type OfficerRow = {
  id: string;
  monthlySubsidyVnd: number;
  isActive: boolean;
  employee: {
    fullName: string;
    fullNameZh: string | null;
    employeeCode: string;
    orgUnitLevel1: string | null;
    orgUnitLevel2: string | null;
  };
};

/** Drag-and-drop reordering for the officer list — native HTML5 DnD (no extra dependency
 *  needed for a desktop-only admin table like this). Reordering updates local state
 *  immediately so the drop feels instant, then persists via reorderSafetyOfficersAction;
 *  the `officers` prop re-syncs local state once the server recomputes sortOrder. */
export function OfficerCatalogTable({ officers }: { officers: OfficerRow[] }) {
  const router = useRouter();
  const [list, setList] = useState(officers);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    setList(officers);
  }, [officers]);

  function handleDrop(targetId: string) {
    setOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const fromIndex = list.findIndex((o) => o.id === draggedId);
    const toIndex = list.findIndex((o) => o.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setList(next);
    setDraggedId(null);
    reorderSafetyOfficersAction(next.map((o) => o.id)).then(() => router.refresh());
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-11">
          <TableHead className="w-8" />
          <TableHead className="w-12"><T k="violations.table.stt" /></TableHead>
          <TableHead><T k="incidents.table.employee" /></TableHead>
          <TableHead><T k="violations.table.department" /></TableHead>
          <TableHead className="text-right"><T k="violations.catalog.baseSubsidy" /></TableHead>
          <TableHead><T k="common.status" /></TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((o, i) => (
          <TableRow
            key={o.id}
            className={cn("h-14", draggedId === o.id && "opacity-40", overId === o.id && draggedId && draggedId !== o.id && "bg-accent")}
            draggable
            onDragStart={() => setDraggedId(o.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(o.id);
            }}
            onDragLeave={() => setOverId((cur) => (cur === o.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(o.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setOverId(null);
            }}
          >
            <TableCell className="cursor-grab py-3 text-muted-foreground active:cursor-grabbing">
              <GripVertical className="size-4" />
            </TableCell>
            <TableCell className="py-3 text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="py-3">
              <div className="font-medium">{o.employee.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {o.employee.employeeCode} {o.employee.fullNameZh ? `· ${o.employee.fullNameZh}` : ""}
              </div>
            </TableCell>
            <TableCell className="py-3 text-muted-foreground">
              {[o.employee.orgUnitLevel1, o.employee.orgUnitLevel2].filter(Boolean).join(" / ") || "—"}
            </TableCell>
            <TableCell className="py-3 text-right">
              <form action={updateSafetyOfficerSubsidyAction} className="flex items-center justify-end gap-2">
                <input type="hidden" name="id" value={o.id} />
                <Input name="monthlySubsidyVnd" type="number" step="1000" min="0" defaultValue={o.monthlySubsidyVnd} className="h-8 w-28 text-right" />
                <Button type="submit" size="sm" variant="outline">
                  <T k="common.save" />
                </Button>
              </form>
            </TableCell>
            <TableCell className="py-3">
              <Badge variant={o.isActive ? "default" : "secondary"}>{o.isActive ? <T k="common.active" /> : <T k="common.inactive" />}</Badge>
            </TableCell>
            <TableCell className="py-3">
              <form action={toggleSafetyOfficerActiveAction}>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="isActive" value={(!o.isActive).toString()} />
                <Button type="submit" size="sm" variant="ghost">
                  {o.isActive ? <T k="common.deactivate" /> : <T k="common.activate" />}
                </Button>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
