"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Languages, MessageSquare, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { MAX_INPUT_CHARS } from "@/lib/ai-constants";
import { askAssistantAction, translateAction } from "./ai-actions";

type Message = { role: "user" | "assistant"; text: string; isError?: boolean };
type Direction = "auto" | "vi-zh" | "zh-vi";

const EXAMPLES: DictionaryKey[] = ["ai.example.1", "ai.example.2", "ai.example.3"];
const DIRECTIONS: { value: Direction; labelKey: DictionaryKey }[] = [
  { value: "auto", labelKey: "ai.translate.auto" },
  { value: "vi-zh", labelKey: "ai.translate.viZh" },
  { value: "zh-vi", labelKey: "ai.translate.zhVi" },
];

/** The model answers in light markdown — render headings/bullets/**bold** readably without
 *  pulling in a markdown library. */
function RichText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {text.split("\n").map((rawLine, i) => {
        const line = rawLine.replace(/^#{1,6}\s+/, "").replace(/^\s*[*-]\s+/, "• ");
        if (line.trim() === "") return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <p key={i} className="break-words whitespace-pre-wrap">
            {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
          </p>
        );
      })}
    </div>
  );
}

/** Top-bar "AI" button + slide-over panel with two modes (Q&A, Vietnamese⇄Chinese translation).
 *  All state lives here (not inside the sheet) so closing the panel doesn't lose the conversation;
 *  nothing is ever saved on the server. */
export function AssistantButton({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "translate">("chat");
  const [pending, startTransition] = useTransition();

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const [direction, setDirection] = useState<Direction>("auto");
  const [source, setSource] = useState("");
  const [translation, setTranslation] = useState<{ text: string; isError: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, open, mode]);

  function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || pending) return;
    const next: Message[] = [...messages.filter((m) => !m.isError), { role: "user", text }];
    setMessages(next);
    setDraft("");
    startTransition(async () => {
      const result = await askAssistantAction(next.map(({ role, text: body }) => ({ role, text: body })));
      setMessages((prev) => [...prev, "text" in result ? { role: "assistant", text: result.text } : { role: "assistant", text: result.error, isError: true }]);
    });
  }

  function translate() {
    const text = source.trim();
    if (!text || pending) return;
    setTranslation(null);
    startTransition(async () => {
      const result = await translateAction(text, direction);
      setTranslation("text" in result ? { text: result.text, isError: false } : { text: result.error, isError: true });
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (non-secure context / permissions) — the text stays selectable on screen
    }
  }

  const tab = (value: "chat" | "translate", icon: React.ReactNode, labelKey: DictionaryKey) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {t(labelKey)}
    </button>
  );

  return (
    <>
      <Button type="button" variant="ghost" size="icon" className={cn("relative", className)} title={t("nav.aiAssistant")} aria-label={t("nav.aiAssistant")} onClick={() => setOpen(true)}>
        <Sparkles className="size-4.5 text-primary" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <div className="flex flex-col gap-3 border-b p-4 pr-12">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4.5 text-primary" />
              {t("nav.aiAssistant")}
            </SheetTitle>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {tab("chat", <MessageSquare className="size-4" />, "ai.tab.chat")}
              {tab("translate", <Languages className="size-4" />, "ai.tab.translate")}
            </div>
          </div>

          {mode === "chat" ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col gap-3 text-sm">
                    <p className="text-muted-foreground">{t("ai.chat.empty")}</p>
                    <div className="flex flex-col gap-2">
                      {EXAMPLES.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => send(t(key))}
                          className="rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          {t(key)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[88%] rounded-2xl px-3.5 py-2 text-sm",
                          m.role === "user" ? "bg-primary text-primary-foreground" : m.isError ? "bg-destructive/10 text-destructive" : "bg-muted"
                        )}
                      >
                        {m.role === "user" ? <p className="break-words whitespace-pre-wrap">{m.text}</p> : <RichText text={m.text} />}
                      </div>
                    </div>
                  ))
                )}
                {pending && <p className="text-sm text-muted-foreground">{t("ai.chat.thinking")}</p>}
                <div ref={endRef} />
              </div>

              <div className="flex flex-col gap-2 border-t p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={t("ai.chat.placeholder")}
                    aria-label={t("ai.chat.placeholder")}
                    rows={2}
                    maxLength={MAX_INPUT_CHARS}
                    className="max-h-40 min-h-12 resize-none"
                  />
                  <Button type="button" size="icon" onClick={() => send()} disabled={pending || draft.trim() === ""} aria-label={t("ai.chat.send")}>
                    <Send className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] leading-snug text-muted-foreground">{t("ai.privacy")}</p>
                  {messages.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setMessages([])} disabled={pending}>
                      <Trash2 className="size-3.5" />
                      {t("ai.chat.clear")}
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <div className="flex gap-1 rounded-lg border p-1" role="group" aria-label={t("ai.tab.translate")}>
                {DIRECTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDirection(d.value)}
                    aria-pressed={direction === d.value}
                    className={cn("flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors", direction === d.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                  >
                    {t(d.labelKey)}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <Textarea
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setTranslation(null);
                  }}
                  placeholder={t("ai.translate.placeholder")}
                  aria-label={t("ai.translate.placeholder")}
                  rows={6}
                  maxLength={MAX_INPUT_CHARS}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {source.length}/{MAX_INPUT_CHARS}
                  </span>
                  {source && (
                    <button type="button" className="hover:text-foreground hover:underline" onClick={() => (setSource(""), setTranslation(null))}>
                      {t("ai.translate.clear")}
                    </button>
                  )}
                </div>
              </div>

              <Button type="button" onClick={translate} disabled={pending || source.trim() === ""}>
                <Languages className="size-4" />
                {pending ? t("ai.translate.working") : t("ai.translate.button")}
              </Button>

              {translation && (
                <div className={cn("flex flex-col gap-2 rounded-xl border p-3 text-sm", translation.isError ? "border-destructive/30 bg-destructive/5 text-destructive" : "bg-muted/40")}>
                  {!translation.isError && <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("ai.translate.result")}</p>}
                  <p className="break-words whitespace-pre-wrap">{translation.text}</p>
                  {!translation.isError && (
                    <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => copy(translation.text)}>
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copied ? t("ai.translate.copied") : t("ai.translate.copy")}
                    </Button>
                  )}
                </div>
              )}

              <p className="mt-auto text-[11px] leading-snug text-muted-foreground">{t("ai.privacy")}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
