import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Local disk implementation of the platform's storage abstraction (see STORAGE.md).
// The DB only ever stores metadata + this relative storagePath — swap this module
// for an S3Storage / GoogleDriveStorage / AzureStorage provider later without
// touching any caller.

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? "./storage";

export interface StorageService {
  save(params: { organizationId: string; module: string; recordId: string; fileName: string; buffer: Buffer }): Promise<{ storagePath: string }>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "file";
}

// HTTP headers can only hold ISO-8859-1 bytes, so a Vietnamese fileName (e.g. any diacritic)
// throws "Cannot convert argument to a ByteString" if put straight into Content-Disposition.
// The RFC 5987 `filename*` extension carries the real UTF-8 name; `filename` stays as an
// ASCII-safe fallback for the handful of very old clients that don't read filename*.
export function contentDisposition(fileName: string, type: "inline" | "attachment" = "inline") {
  const asciiFallback = (fileName.replace(/[^\x20-\x7e]/g, "_").replace(/[\r\n"]/g, "_") || "file").slice(0, 200);
  const encoded = encodeURIComponent(fileName);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

// Browsers have no built-in Word/Excel viewer, so "inline" on an Office file just leaves the
// browser to guess — usually a silent download, sometimes a tab full of raw XML. Force
// "attachment" for these so the browser always downloads to a real file the OS's Excel/Word/
// WPS association can then open, the way it already does for a plain download link.
const OFFICE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function dispositionFor(fileName: string, mimeType: string | null | undefined) {
  return contentDisposition(fileName, mimeType && OFFICE_MIME_TYPES.has(mimeType) ? "attachment" : "inline");
}

class LocalStorageProvider implements StorageService {
  async save({
    organizationId,
    module,
    recordId,
    fileName,
    buffer,
  }: {
    organizationId: string;
    module: string;
    recordId: string;
    fileName: string;
    buffer: Buffer;
  }) {
    // Random prefix so an attacker can't guess/enumerate other tenants' file paths,
    // and so two uploads with the same original name never collide.
    const storedName = `${randomUUID()}-${sanitizeFileName(fileName)}`;
    const relativeDir = path.posix.join(organizationId, module, recordId);
    // turbopackIgnore: STORAGE_ROOT is runtime user data, not part of the deployable bundle.
    const absoluteDir = path.join(/* turbopackIgnore: true */ STORAGE_ROOT, relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });

    const relativePath = path.posix.join(relativeDir, storedName);
    await fs.writeFile(path.join(/* turbopackIgnore: true */ STORAGE_ROOT, relativePath), buffer);

    return { storagePath: relativePath };
  }

  async read(storagePath: string) {
    return fs.readFile(path.join(/* turbopackIgnore: true */ STORAGE_ROOT, storagePath));
  }

  async delete(storagePath: string) {
    await fs.unlink(path.join(/* turbopackIgnore: true */ STORAGE_ROOT, storagePath)).catch(() => {});
  }
}

export const storageService: StorageService = new LocalStorageProvider();

export const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const MAX_UPLOAD_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 25) * 1024 * 1024;
