# File Storage

## Principle: the database never stores file bytes

`Document` rows (`prisma/schema.prisma`) store only metadata: file name, MIME
type, size, which provider holds it, and a `storagePath` — never the file
content itself.

## `StorageService` abstraction

`src/server/storage.ts` defines:

```ts
interface StorageService {
  save(params: { organizationId, module, recordId, fileName, buffer }): Promise<{ storagePath }>;
  read(storagePath): Promise<Buffer>;
  delete(storagePath): Promise<void>;
}
```

Phase 1 ships one implementation, `LocalStorageProvider`, writing to
`STORAGE_ROOT` (default `./storage`, gitignored — never committed) on local
disk, organized as `<organizationId>/<module>/<recordId>/<random>-<filename>`.

Every caller (currently `src/app/(platform)/incidents/[id]/actions.ts`) only
ever talks to `storageService`, never to the filesystem directly. Adding
`S3Storage`, `GoogleDriveStorage`, or `AzureStorage` later means writing a new
class that implements `StorageService` and swapping the export in
`storage.ts` — no call sites change.

## Where files actually go

`STORAGE_ROOT` is **not** under `/public` and is not served directly by
Next.js. The only way to fetch a file is `GET /api/documents/[id]`
(`src/app/api/documents/[id]/route.ts`), which:

1. Requires an authenticated session with a valid active-organization context.
2. Loads the `Document` row and calls `assertBelongsToOrg()` — a request for a
   document belonging to another tenant gets a 404, not the file.
3. Only then reads the file via `storageService.read()` and streams it back.

## Upload constraints (enforced server-side, in the Server Action, not just the
`<input accept>` hint in the UI)

- Allowlisted MIME types only (`ALLOWED_UPLOAD_TYPES` in `storage.ts`): common
  image, PDF, Word, Excel types.
- Size limit via `MAX_UPLOAD_SIZE_MB` env var (default 25 MB).
- Stored filenames are randomized (`randomUUID()` prefix) so a filename can't be
  guessed/enumerated, and the original name is sanitized before being appended.

## Google Drive (future — not implemented)

Section 19 of the product brief describes a future flow where uploads go
straight to Google Drive from the browser and the DB stores the Drive file ID.
That's a new `GoogleDriveStorage implements StorageService`, plus an OAuth
connection step — deliberately out of scope for Phase 1/2 per the brief.
