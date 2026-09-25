"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileSearch,
  Flame,
  FolderOpen,
  GraduationCap,
  Leaf,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldX,
  ShoppingCart,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { extensionOf, type FormDto, type FormFileDto } from "@/lib/form-files";
import { deleteFormAction, deleteFormFileAction, replaceFormFileAction, toggleFormActiveAction } from "./actions";
import { FormEditorDialog } from "./form-editor-dialog";

type Category = { id: string; nameVi: string; nameZh: string | null; isActive: boolean };

const CATEGORY_STYLES: { match: string; icon: LucideIcon; tone: string }[] = [
  { match: "đào tạo", icon: GraduationCap, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { match: "pccc", icon: Flame, tone: "bg-red-500/10 text-red-600 dark:text-red-400" },
  { match: "sự cố", icon: AlertTriangle, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { match: "vi phạm", icon: ShieldX, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  { match: "mua hàng", icon: ShoppingCart, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { match: "môi trường", icon: Leaf, tone: "bg-green-500/10 text-green-600 dark:text-green-400" },
  { match: "nghiệm thu", icon: ClipboardCheck, tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
];
const DEFAULT_STYLE = { icon: FolderOpen, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-400" };

function categoryStyle(nameVi: string) {
  const name = nameVi.toLowerCase();
  return CATEGORY_STYLES.find((s) => name.includes(s.match)) ?? DEFAULT_STYLE;
}

const FILE_TYPES: { exts: string[]; label: string; tone: string }[] = [
  { exts: ["pdf"], label: "PDF", tone: "bg-red-500/10 text-red-600 dark:text-red-400" },
  { exts: ["doc", "docx"], label: "WORD", tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { exts: ["xls", "xlsx"], label: "EXCEL", tone: "bg-green-500/10 text-green-600 dark:text-green-400" },
  { exts: ["ppt", "pptx"], label: "PPT", tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif"];

function fileKind(fileName: string) {
  const ext = extensionOf(fileName);
  const type = FILE_TYPES.find((f) => f.exts.includes(ext));
  if (type) return { label: type.label, tone: type.tone, previewable: ext === "pdf" };
  if (IMAGE_EXTS.includes(ext)) return { label: "IMG", tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400", previewable: true };
  return { label: ext.toUpperCase().slice(0, 5) || "FILE", tone: "bg-slate-500/10 text-slate-600", previewable: false };
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Diacritic- and case-insensitive, so "dao tao" finds "Đào tạo". */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

export function FormLibraryView({ categories, forms, canEdit }: { categories: Category[]; forms: FormDto[]; canEdit: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormDto | null>(null);
  const [deletingForm, setDeletingForm] = useState<FormDto | null>(null);
  const [deletingFile, setDeletingFile] = useState<FormFileDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localized = (vi: string, zh: string | null) => (locale === "zh" ? zh?.trim() || vi : vi);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const countByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of forms) map.set(f.categoryId, (map.get(f.categoryId) ?? 0) + 1);
    return map;
  }, [forms]);

  const searching = query.trim() !== "";
  const visibleForms = useMemo(() => {
    if (searching) {
      const q = fold(query.trim());
      return forms.filter((f) =>
        fold([f.code, f.nameVi, f.nameZh, f.descriptionVi, f.descriptionZh, ...f.files.map((x) => x.fileName)].filter(Boolean).join(" ")).includes(q)
      );
    }
    return activeId === "all" ? forms : forms.filter((f) => f.categoryId === activeId);
  }, [forms, activeId, query, searching]);

  const activeCategory = activeId === "all" ? null : categoryById.get(activeId);
  const showCategoryChip = searching || activeId === "all";

  function run(fn: () => Promise<{ error: string } | { success: true }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  function openEditor(form: FormDto | null) {
    setEditingForm(form);
    setEditorOpen(true);
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <FolderOpen className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">{t("forms.title")}</h1>
              <p className="hidden text-sm text-muted-foreground md:block">{t("forms.subtitle")}</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Link href="/form-library/categories" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <ListTree className="size-4" />
                {t("forms.categories")}
              </Link>
              <Button type="button" size="sm" onClick={() => openEditor(null)} disabled={categories.length === 0}>
                <Plus className="size-4" />
                {t("forms.add")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("forms.search.placeholder")}
          aria-label={t("forms.search.placeholder")}
          className="h-11 rounded-xl pl-10 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((c) => {
          const style = categoryStyle(c.nameVi);
          const selected = activeId === c.id && !searching;
          return (
            <CategoryTile
              key={c.id}
              icon={style.icon}
              tone={style.tone}
              name={localized(c.nameVi, c.nameZh)}
              count={countByCategory.get(c.id) ?? 0}
              muted={!c.isActive}
              active={selected}
              onClick={() => {
                // Clicking the open category again goes back to the full list.
                setActiveId(selected ? "all" : c.id);
                setQuery("");
              }}
            />
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">
          {searching ? t("forms.empty.search", { q: query.trim() }).replace(/^.*$/, () => `“${query.trim()}”`) : activeCategory ? localized(activeCategory.nameVi, activeCategory.nameZh) : t("forms.all")}
        </h2>
        <span className="flex items-center gap-3 text-sm text-muted-foreground">
          {(activeId !== "all" || searching) && (
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setActiveId("all");
                setQuery("");
              }}
            >
              {t("forms.showAll")}
            </button>
          )}
          {t("forms.count", { n: visibleForms.length })}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {visibleForms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {searching ? <FileSearch className="size-6" /> : <FolderOpen className="size-6" />}
            </span>
            <p className="text-sm font-medium">
              {searching ? t("forms.empty.search", { q: query.trim() }) : forms.length === 0 ? t("forms.empty.library") : t("forms.empty.category")}
            </p>
            {canEdit && !searching && <p className="text-xs text-muted-foreground">{t("forms.empty.hintAdmin")}</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleForms.map((form) => {
            const category = categoryById.get(form.categoryId);
            const style = category ? categoryStyle(category.nameVi) : DEFAULT_STYLE;
            const description = localized(form.descriptionVi ?? "", form.descriptionZh);
            return (
              <Card key={form.id} className={cn(!form.isActive && "opacity-70")}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", style.tone)}>
                      <style.icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="leading-snug font-semibold break-words">{localized(form.nameVi, form.nameZh)}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {form.code && <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-foreground">{form.code}</span>}
                        {showCategoryChip && category && <span className={cn("rounded px-1.5 py-0.5 font-medium", style.tone)}>{localized(category.nameVi, category.nameZh)}</span>}
                        {!form.isActive && <span className="rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning">{t("forms.hiddenBadge")}</span>}
                        <span>{t("forms.updatedOn", { date: dateFormat.format(new Date(form.updatedAt)) })}</span>
                      </div>
                    </div>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t("forms.menu")} />}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openEditor(form)}>
                            <Pencil className="size-4" />
                            {t("forms.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => run(() => toggleFormActiveAction(form.id, !form.isActive))}>
                            {form.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            {form.isActive ? t("forms.hide") : t("forms.show")}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingForm(form)}>
                            <Trash2 className="size-4" />
                            {t("forms.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}

                  <ul className="flex flex-col gap-1.5">
                    {form.files.map((file) => (
                      <FileRow key={file.id} file={file} canEdit={canEdit} busy={pending} onReplace={(data) => run(() => replaceFormFileAction(data))} onDelete={() => setDeletingFile(file)} />
                    ))}
                    {form.files.length === 0 && <li className="text-sm text-muted-foreground">{t("forms.noFile")}</li>}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canEdit && editorOpen && (
        <FormEditorDialog
          key={editingForm?.id ?? "new"}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          form={editingForm}
          categories={categories.filter((c) => c.isActive || c.id === editingForm?.categoryId).map((c) => ({ id: c.id, label: localized(c.nameVi, c.nameZh) }))}
          defaultCategoryId={activeCategory?.id ?? null}
        />
      )}

      <ConfirmDialog
        open={deletingForm !== null}
        onOpenChange={(open) => !open && setDeletingForm(null)}
        description={t("forms.deleteConfirm")}
        confirmLabel={t("common.delete")}
        pending={pending}
        onConfirm={() => deletingForm && run(() => deleteFormAction(deletingForm.id))}
      />
      <ConfirmDialog
        open={deletingFile !== null}
        onOpenChange={(open) => !open && setDeletingFile(null)}
        description={t("forms.file.removeConfirm")}
        confirmLabel={t("common.delete")}
        pending={pending}
        onConfirm={() => deletingFile && run(() => deleteFormFileAction(deletingFile.id))}
      />
    </div>
  );
}

function CategoryTile({
  icon: Icon,
  tone,
  name,
  count,
  active,
  muted,
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  name: string;
  count: number;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        active && "border-primary bg-primary/5 ring-2 ring-primary/40",
        muted && "opacity-60"
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block text-xs text-muted-foreground">{t("forms.count", { n: count })}</span>
      </span>
    </button>
  );
}

function FileRow({
  file,
  canEdit,
  busy,
  onReplace,
  onDelete,
}: {
  file: FormFileDto;
  canEdit: boolean;
  busy: boolean;
  onReplace: (data: FormData) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const pickerRef = useRef<HTMLInputElement>(null);
  const kind = fileKind(file.fileName);
  const href = `/api/forms/files/${file.id}`;

  return (
    <li className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-2.5 py-2">
      <span className={cn("flex h-7 w-12 shrink-0 items-center justify-center rounded text-[10px] font-bold tracking-wide", kind.tone)}>{kind.label}</span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm font-medium break-words" title={file.fileName}>
          {file.fileName}
        </span>
        <span className="block text-xs text-muted-foreground">{formatSize(file.sizeBytes)}</span>
      </span>
      {kind.previewable && (
        <a href={href} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={t("forms.preview")}>
          <Eye className="size-4" />
          <span className="hidden sm:inline">{t("forms.preview")}</span>
        </a>
      )}
      <a href={`${href}?download=1`} className={buttonVariants({ variant: "default", size: "sm" })}>
        <Download className="size-4" />
        <span className="hidden sm:inline">{t("forms.download")}</span>
        <span className="sr-only sm:hidden">{t("forms.download")}</span>
      </a>
      {canEdit && (
        <>
          <input
            ref={pickerRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (!picked) return;
              const data = new FormData();
              data.set("docId", file.id);
              data.set("file", picked);
              onReplace(data);
            }}
          />
          <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy} title={t("forms.file.replace")} aria-label={t("forms.file.replace")} onClick={() => pickerRef.current?.click()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" disabled={busy} title={t("forms.file.remove")} aria-label={t("forms.file.remove")} onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </li>
  );
}
