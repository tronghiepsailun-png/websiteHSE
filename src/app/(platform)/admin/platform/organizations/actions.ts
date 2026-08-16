"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/org-context";
import { ForbiddenError } from "@/server/errors";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(30).regex(CODE_PATTERN),
  industry: z.string().max(60).optional().or(z.literal("")),
});

export type CreateOrgState = { error?: string } | undefined;

export async function createOrganizationAction(_prev: CreateOrgState, formData: FormData): Promise<CreateOrgState> {
  const user = await getSessionUser();
  if (!user.isPlatformAdmin) throw new ForbiddenError();

  const parsed = createOrgSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    industry: formData.get("industry"),
  });
  const locale = await getLocale();

  if (!parsed.success) {
    const codeIssue = parsed.error.issues.find((issue) => issue.path[0] === "code" && issue.code === "invalid_format");
    return { error: codeIssue ? t(locale, "admin.platformOrgs.codeFormatError") : t(locale, "common.invalidInput") };
  }

  const existing = await prisma.organization.findUnique({ where: { code: parsed.data.code } });
  if (existing) return { error: t(locale, "admin.platformOrgs.codeExists") };

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      industry: parsed.data.industry || null,
    },
  });

  // Every organization needs an Incident ID sequence to be able to report incidents at all.
  await prisma.idSequenceConfig.create({
    data: {
      organizationId: org.id,
      module: "incident",
      prefix: org.code,
      separator: "/",
      includeYear: true,
      includeOrgCode: false,
      padLength: 4,
      resetPeriod: "yearly",
      currentPeriodKey: String(new Date().getFullYear()),
      currentSequence: 0,
    },
  });

  revalidatePath("/admin/platform/organizations");
  return undefined;
}

export async function toggleOrganizationActiveAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user.isPlatformAdmin) throw new ForbiddenError();

  const organizationId = String(formData.get("organizationId"));
  const nextIsActive = formData.get("isActive") === "true";

  await prisma.organization.update({ where: { id: organizationId }, data: { isActive: nextIsActive } });
  revalidatePath("/admin/platform/organizations");
}
