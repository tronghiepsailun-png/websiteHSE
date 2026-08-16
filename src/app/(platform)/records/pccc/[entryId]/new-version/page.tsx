import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getRecordEntryDetail, getSameRecordTypeDates } from "@/server/records";
import { NotFoundError } from "@/server/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { T } from "@/components/i18n/t";
import { VersionForm } from "./version-form";

export default async function NewRecordVersionPage({ params }: PageProps<"/records/pccc/[entryId]/new-version">) {
  const ctx = await requireApiAccess(PERMISSIONS.RECORDS_MANAGE);
  const { entryId } = await params;

  const entry = await getRecordEntryDetail(ctx.organizationId, entryId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const sameTypeDates = await getSameRecordTypeDates(entry.recordTypeId, entryId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/records/pccc/${entryId}`} className="text-sm text-muted-foreground hover:text-foreground">
          {entry.recordType.code} — {entry.recordType.name}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">
          <T k="records.form.title" />
        </h1>
        <p className="text-sm text-muted-foreground">{entry.orgUnit.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {entry.recordType.code} — {entry.recordType.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VersionForm
            entryId={entry.id}
            cycleMonths={entry.recordType.cycleMonths}
            sameTypeDates={sameTypeDates.map((d) => ({ orgUnitName: d.orgUnitName, effectiveDate: d.effectiveDate.toISOString() }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
