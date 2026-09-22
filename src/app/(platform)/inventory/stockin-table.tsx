import { ImageIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { T } from "@/components/i18n/t";
import { t, type Locale } from "@/lib/i18n/translate";
import { EditStockInDialog } from "./edit-stockin-dialog";
import { DeleteStockInButton } from "./delete-stockin-button";

export type StockInRow = {
  id: string;
  transactionDate: Date;
  quantity: number;
  note: string | null;
  item: { id: string; name: string; unit: string };
  recordedBy: { name: string } | null;
  photos: { id: string; fileName: string }[];
};

function fmtDateTime(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function StockInTable({
  rows,
  locale,
  canEdit,
  canDelete,
  hiddenColumns,
}: {
  rows: StockInRow[];
  locale: Locale;
  canEdit: boolean;
  canDelete: boolean;
  hiddenColumns: string[];
}) {
  const showActions = canEdit || canDelete;
  const hidden = new Set(hiddenColumns);
  const columnCount = 3 + [!hidden.has("note"), !hidden.has("recordedBy"), !hidden.has("photos"), showActions].filter(Boolean).length;
  return (
    <Table>
      <TableHeader>
        <TableRow className="h-11">
          <TableHead>{t(locale, "inventory.issuance.table.date")}</TableHead>
          <TableHead>{t(locale, "inventory.issuance.table.item")}</TableHead>
          <TableHead>{t(locale, "inventory.issuance.table.quantity")}</TableHead>
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
                  {canEdit && <EditStockInDialog row={row} />}
                  {canDelete && <DeleteStockInButton id={row.id} />}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={columnCount}>
              <EmptyState message={<T k="inventory.stockIn.empty" />} />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
