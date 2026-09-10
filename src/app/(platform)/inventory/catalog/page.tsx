import Image from "next/image";
import { Warehouse } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { listAllInventoryItems } from "@/server/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { T } from "@/components/i18n/t";
import { ItemForm } from "./item-form";
import { EditItemDialog } from "./edit-item-dialog";
import { toggleInventoryItemActiveAction } from "./actions";
import { InventoryTabs } from "../inventory-tabs";

export default async function InventoryCatalogPage() {
  const ctx = await requireApiAccess(PERMISSIONS.INVENTORY_EDIT);
  const items = await listAllInventoryItems(ctx.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <Warehouse className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">
                <T k="inventory.catalog.title" />
              </h1>
              <p className="text-sm text-muted-foreground">
                <T k="inventory.catalog.subtitle" />
              </p>
            </div>
          </div>
          <InventoryTabs active="catalog" canManageCatalog />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="inventory.catalog.addItem" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ItemForm />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead />
                <TableHead>{<T k="inventory.catalog.fields.name" />}</TableHead>
                <TableHead>{<T k="inventory.catalog.fields.unit" />}</TableHead>
                <TableHead>{<T k="inventory.catalog.fields.minStockLevel" />}</TableHead>
                <TableHead>
                  <T k="common.status" />
                </TableHead>
                <TableHead />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="h-16">
                  <TableCell className="py-2">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border bg-white">
                      {item.imageUrl && <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="h-full w-full object-contain p-1" />}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 font-medium">
                    {item.name}
                    {item.nameZh && <span className="ml-2 text-xs text-muted-foreground">{item.nameZh}</span>}
                  </TableCell>
                  <TableCell className="py-2">{item.unit}</TableCell>
                  <TableCell className="py-2">{item.minStockLevel}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? <T k="common.active" /> : <T k="common.inactive" />}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <EditItemDialog item={item} />
                  </TableCell>
                  <TableCell className="py-2">
                    <form action={toggleInventoryItemActiveAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="isActive" value={(!item.isActive).toString()} />
                      <Button type="submit" size="sm" variant="ghost">
                        {item.isActive ? <T k="common.disable" /> : <T k="common.reactivate" />}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
