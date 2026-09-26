import { MAX_INPUT_CHARS } from "@/lib/ai-constants";

// Thin wrapper around Google's Gemini REST API (free tier, no SDK). Kept in one place so swapping
// the provider or the model list later is a one-file change. Nothing here touches the database —
// conversations are never stored.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = "gemini-2.5-flash,gemini-2.5-flash-lite";

const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 12000;

export type AiChatMessage = { role: "user" | "assistant"; text: string };
export type AiResult = { text: string } | { error: "not_configured" | "rate_limited" | "quota" | "invalid_key" | "blocked" | "failed" };

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

async function callGemini(system: string, contents: GeminiContent[], temperature: number): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "not_configured" };
  const models = (process.env.GEMINI_MODELS ?? DEFAULT_MODELS).split(",").map((m) => m.trim()).filter(Boolean);

  let lastError: Extract<AiResult, { error: string }>["error"] = "failed";
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

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        // A rejected key is the same for every model — no point trying the next one.
        const body = await res.text().catch(() => "");
        console.error("Gemini rejected the request:", res.status, body.slice(0, 300));
        return { error: /API key|API_KEY|permission/i.test(body) ? "invalid_key" : "failed" };
      }
      if (res.status === 429) {
        lastError = "quota";
        continue;
      }
      if (!res.ok) {
        console.error("Gemini error:", model, res.status);
        lastError = "failed";
        continue; // 404 (model retired) / 5xx — try the next model in the list
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text) return { text };
      if (data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason === "SAFETY") return { error: "blocked" };
      lastError = "failed";
    } catch (err) {
      console.error("Gemini request failed:", model, err instanceof Error ? err.message : err);
      lastError = "failed";
    }
  }
  return { error: lastError };
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
