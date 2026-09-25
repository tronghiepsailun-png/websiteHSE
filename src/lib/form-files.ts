// Client-safe pieces of the form library (no database imports), shared by the server code and
// the library's client components.

// Office files are the whole point of the form library, and the shared upload allow-list has no
// PowerPoint — so the library validates by extension against its own list instead.
const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** The MIME type to store for an uploaded form file, or null when its extension isn't allowed. */
export function formFileMime(fileName: string): string | null {
  return EXTENSION_MIME[extensionOf(fileName)] ?? null;
}

export type FormFileDto = { id: string; fileName: string; fileType: string; sizeBytes: number; uploadedAt: Date };
export type FormDto = {
  id: string;
  categoryId: string;
  code: string | null;
  nameVi: string;
  nameZh: string | null;
  descriptionVi: string | null;
  descriptionZh: string | null;
  isActive: boolean;
  updatedAt: Date;
  files: FormFileDto[];
};
