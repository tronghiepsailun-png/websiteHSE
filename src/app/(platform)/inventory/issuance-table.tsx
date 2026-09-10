import { ImageIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { T } from "@/components/i18n/t";
import { t, type Locale } from "@/lib/i18n/translate";
import { EditIssuanceDialog } from "./edit-issuance-dialog";
import { DeleteIssuanceButton } from "./delete-issuance-button";
import type { WorkshopOption } from "./item-card";
import { ISSUANCE_TOGGLEABLE_COLUMNS } from "./column-visibility";

export type IssuanceRow = {
  id: string;
  transactionDate: Date;
  quantity: number;
  department: string | null;
  note: string | null;
  item: { id: string; name: string; unit: string };
  recordedBy: { name: string } | null;
  recipientEmployee: { id: string; employeeCode: string; fullName: string; fullNameZh: string | null } | null;
  photos: { id: string; fileName: string }[];
};

function fmtDateTime(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function IssuanceTable({
  rows,
  locale,
  canEdit,
  canDelete,
  workshops,
  hiddenColumns,
}: {
  rows: IssuanceRow[];
  locale: Locale;
  canEdit: boolean;
  canDelete: boolean;
  workshops: WorkshopOption[];
  hiddenColumns: string[];
}) {
  const showActions = canEdit || canDelete;
  const hidden = new Set(hiddenColumns);
  return (
    <Table>
      <TableHeader>
        <TableRow className="h-11">
          <TableHead>{t(locale, "inventory.issuance.table.date")}</TableHead>
          <TableHead>{t(locale, "inventory.issuance.table.item")}</TableHead>
          <TableHead>{t(locale, "inventory.issuance.table.quantity")}</TableHead>
          {!hidden.has("department") && <TableHead>{t(locale, "inventory.issuance.table.department")}</TableHead>}
          <TableHead>{t(locale, "inventory.issuance.table.recipient")}</TableHead>
          {!hidden.has("note") && <TableHead>{t(locale, "inventory.issuance.table.note")}</TableHead>}
          {!hidden.has("recordedBy") && <TableHead>{t(locale, "inventory.issuance.table.recordedBy")}</TableHead>}
          {!hidden.has("photos") && <TableHead>{t(locale, "inventory.issuance.table.photos")}</TableHead>}
          {showActions && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className="h-14">
            <TableCell className="py-3 whitespace-nowrap">{fmtDateTime(row.transactionDate)}</TableCell>
            <TableCell className="py-3 font-medium">{row.item.name}</TableCell>
            <TableCell className="py-3">
              {row.quantity} {row.item.unit}
            </TableCell>
            {!hidden.has("department") && <TableCell className="py-3">{row.department ?? "—"}</TableCell>}
            <TableCell className="py-3">{row.recipientEmployee ? `${row.recipientEmployee.employeeCode} — ${row.recipientEmployee.fullName}` : "—"}</TableCell>
            {!hidden.has("note") && <TableCell className="py-3 text-muted-foreground">{row.note ?? "—"}</TableCell>}
            {!hidden.has("recordedBy") && <TableCell className="py-3 text-muted-foreground">{row.recordedBy?.name ?? "—"}</TableCell>}
            {!hidden.has("photos") && (
              <TableCell className="py-3">
                {row.photos.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    {row.photos.map((photo) => (
                      <ImageLightbox
                        key={photo.id}
                        src={`/api/documents/${photo.id}`}
                        alt={photo.fileName}
                        title={photo.fileName}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ImageIcon className="size-4" />
                      </ImageLightbox>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            )}
            {showActions && (
              <TableCell className="py-3">
                <div className="flex items-center justify-end gap-1">
                  {canEdit && <EditIssuanceDialog row={row} workshops={workshops} />}
                  {canDelete && <DeleteIssuanceButton id={row.id} />}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4 + ISSUANCE_TOGGLEABLE_COLUMNS.length - hidden.size + (showActions ? 1 : 0)}>
              <EmptyState message={<T k="inventory.issuance.empty" />} />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
