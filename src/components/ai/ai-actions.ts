"use server";

import { z } from "zod";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { aiChat, aiTranslate, checkRateLimit, type AiChatMessage, type TranslateDirection } from "@/server/ai";
import { MAX_INPUT_CHARS } from "@/lib/ai-constants";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type AiActionResult = { text: string } | { error: string };

async function guard() {
  const ctx = await requireOrgPermission(PERMISSIONS.AI_USE);
  const locale = await getLocale();
  if (!checkRateLimit(ctx.userId)) return { ok: false, error: t(locale, "ai.error.rateLimited") } as const;
  return { ok: true, locale } as const;
}

function errorMessage(error: string, locale: Awaited<ReturnType<typeof getLocale>>, code?: string) {
  switch (error) {
    case "not_configured":
      return t(locale, "ai.error.notConfigured");
    case "quota":
      return t(locale, "ai.error.quota");
    case "invalid_key":
      return t(locale, "ai.error.invalidKey");
    case "blocked":
      return t(locale, "ai.error.blocked");
    default:
      // The status/reason code helps the administrator diagnose it (see `pm2 logs` for details).
      return code ? `${t(locale, "ai.error.failed")} (${code})` : t(locale, "ai.error.failed");
  }
}

const chatSchema = z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(MAX_INPUT_CHARS * 2) })).min(1).max(40);

export async function askAssistantAction(history: AiChatMessage[]): Promise<AiActionResult> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const parsed = chatSchema.safeParse(history);
  if (!parsed.success) return { error: t(g.locale, "ai.error.failed") };
  if (parsed.data[parsed.data.length - 1].text.length > MAX_INPUT_CHARS) return { error: t(g.locale, "ai.error.tooLong", { n: MAX_INPUT_CHARS }) };

  const result = await aiChat(parsed.data);
  return "text" in result ? result : { error: errorMessage(result.error, g.locale, result.code) };
}

const translateSchema = z.object({ text: z.string().trim().min(1), direction: z.enum(["auto", "vi-zh", "zh-vi"]) });

export async function translateAction(text: string, direction: TranslateDirection): Promise<AiActionResult> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const parsed = translateSchema.safeParse({ text, direction });
  if (!parsed.success) return { error: t(g.locale, "ai.error.failed") };
  if (parsed.data.text.length > MAX_INPUT_CHARS) return { error: t(g.locale, "ai.error.tooLong", { n: MAX_INPUT_CHARS }) };

  const result = await aiTranslate(parsed.data.text, parsed.data.direction);
  return "text" in result ? result : { error: errorMessage(result.error, g.locale, result.code) };
}
