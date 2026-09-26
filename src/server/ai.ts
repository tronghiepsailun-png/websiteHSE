import { MAX_INPUT_CHARS } from "@/lib/ai-constants";

// Thin wrapper around Google's Gemini REST API (free tier, no SDK). Kept in one place so swapping
// the provider or the model list later is a one-file change. Nothing here touches the database —
// conversations are never stored.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// The "-latest" aliases follow Google's current Flash / Flash-Lite, so a retired model name
// doesn't silently break the assistant.
const DEFAULT_MODELS = "gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash";

const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 12000;

export type AiChatMessage = { role: "user" | "assistant"; text: string };
export type AiResult = { text: string } | { error: "not_configured" | "rate_limited" | "quota" | "invalid_key" | "blocked" | "failed"; code?: string };

// Free-tier keys have small, shifting quotas — a per-person hourly cap keeps one user from
// draining the whole factory's allowance. In-memory on purpose (resets on restart, no storage).
const HOURLY_LIMIT = Number(process.env.AI_HOURLY_LIMIT ?? 30);
const usage = new Map<string, number[]>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (usage.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= HOURLY_LIMIT) {
    usage.set(userId, recent);
    return false;
  }
  recent.push(now);
  usage.set(userId, recent);
  return true;
}

const CHAT_SYSTEM = [
  "You are a helpful assistant inside the HSE (health, safety, environment) management website of a factory (CCGrass).",
  "Answer in the same language the user writes in (Vietnamese or Chinese; otherwise Vietnamese). Be concise and practical.",
  "You have NO access to the website's data (incidents, employees, records...). If asked about it, say you cannot see it and suggest where to look on the site.",
  "For safety, legal or medical questions give general guidance and say when they should confirm with a qualified person or the applicable regulation. Never invent facts, figures or legal citations; say when you are unsure.",
].join(" ");

export type TranslateDirection = "auto" | "vi-zh" | "zh-vi";

function translateSystem(direction: TranslateDirection) {
  const target =
    direction === "vi-zh"
      ? "Translate the user's text from Vietnamese into Simplified Chinese."
      : direction === "zh-vi"
        ? "Translate the user's text from Chinese into Vietnamese."
        : "Detect the language of the user's text: if it is mainly Vietnamese, translate it into Simplified Chinese; if it is mainly Chinese, translate it into Vietnamese; if it is another language, translate it into Vietnamese.";
  return [
    target,
    "This is workplace health-and-safety / factory terminology (machines, PPE, incidents, fire safety, production departments) — use the standard terms used in Vietnamese and Chinese factories.",
    "Keep numbers, dates, employee/department codes, names and units exactly as written. Keep the original line breaks and list structure.",
    "Output ONLY the translation — no explanations, no notes, no quotes around it.",
  ].join(" ");
}

type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };

type Failure = Extract<AiResult, { error: string }>;

/** Tries each model in turn. Returns `done` as soon as there is a final answer / blocked /
 *  invalid-key result; otherwise how it failed (quota vs anything else, plus the last status code)
 *  and whether any model was reported as unknown — which is what triggers model auto-discovery. */
type TryResult = { done: AiResult } | { done?: undefined; failure: Failure; unknownModel: boolean };

async function tryModels(models: string[], apiKey: string, system: string, contents: GeminiContent[], temperature: number): Promise<TryResult> {
  let failure: Failure = { error: "failed" };
  let unknownModel = false;
  for (const model of models) {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (res.status === 429) {
        failure = { error: "quota", code: "429" };
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("Gemini error:", model, res.status, body.slice(0, 300));
        // A rejected key is the same for every model — no point trying the next one.
        if ([400, 401, 403].includes(res.status) && /API key|API_KEY|permission denied/i.test(body)) {
          return { done: { error: "invalid_key", code: String(res.status) } as AiResult };
        }
        if (res.status === 404) unknownModel = true;
        failure = { error: "failed", code: String(res.status) };
        continue; // 404 (retired model) / other 4xx for this model / 5xx — try the next one
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text) return { done: { text } as AiResult };
      if (data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason === "SAFETY") return { done: { error: "blocked" } as AiResult };
      console.error("Gemini returned no text:", model, data.candidates?.[0]?.finishReason);
      failure = { error: "failed", code: data.candidates?.[0]?.finishReason ?? "empty" };
    } catch (err) {
      console.error("Gemini request failed:", model, err instanceof Error ? err.message : err);
      failure = { error: "failed", code: "network" };
    }
  }
  return { failure, unknownModel };
}

// Google retires model names over time. When the configured ones are reported as unknown, ask the
// API which Flash models this key can actually use and try those (newest stable first).
let discovered: { models: string[]; at: number } | null = null;

async function discoverModels(apiKey: string): Promise<string[]> {
  if (discovered && Date.now() - discovered.at < 6 * 3_600_000) return discovered.models;
  try {
    const res = await fetch(`${API_BASE}?pageSize=200`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const models = (data.models ?? [])
      .filter((m) => m.name && m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => (m.name as string).replace(/^models\//, ""))
      .filter((name) => /flash/.test(name) && !/(image|tts|live|audio|embedding|robotics|computer|exp|preview|thinking|vision)/.test(name))
      .sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
    discovered = { models, at: Date.now() };
    return models;
  } catch {
    return [];
  }
}

async function callGemini(system: string, contents: GeminiContent[], temperature: number): Promise<AiResult> {
  // Tolerate stray spaces/quotes around the value in .env.
  const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return { error: "not_configured" };
  // HTTP headers only carry plain ASCII — a value with accents/spaces (e.g. a placeholder that was
  // never replaced with the real key) would make fetch throw a confusing ByteString error.
  if (!/^[\x21-\x7e]+$/.test(apiKey)) {
    console.error("GEMINI_API_KEY contains characters that cannot be part of an API key — check the .env value.");
    return { error: "invalid_key" };
  }
  const models = (process.env.GEMINI_MODELS ?? DEFAULT_MODELS).split(",").map((m) => m.trim()).filter(Boolean);

  const first = await tryModels(models, apiKey, system, contents, temperature);
  if (first.done) return first.done;
  if (!first.unknownModel) return first.failure;

  const extra = (await discoverModels(apiKey)).filter((m) => !models.includes(m)).slice(0, 4);
  if (extra.length === 0) return first.failure;
  const second = await tryModels(extra, apiKey, system, contents, temperature);
  return second.done ?? second.failure;
}

export async function aiChat(history: AiChatMessage[]): Promise<AiResult> {
  const recent: AiChatMessage[] = [];
  let chars = 0;
  for (const m of history.slice(-MAX_HISTORY_MESSAGES).reverse()) {
    chars += m.text.length;
    if (chars > MAX_HISTORY_CHARS) break;
    recent.unshift(m);
  }
  const contents: GeminiContent[] = recent.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text.slice(0, MAX_INPUT_CHARS) }] }));
  if (contents.length === 0 || contents[contents.length - 1].role !== "user") return { error: "failed" };
  return callGemini(CHAT_SYSTEM, contents, 0.5);
}

export async function aiTranslate(text: string, direction: TranslateDirection): Promise<AiResult> {
  return callGemini(translateSystem(direction), [{ role: "user", parts: [{ text: text.slice(0, MAX_INPUT_CHARS) }] }], 0.1);
}
