# Database

## Current setup: SQLite (development)

`prisma/schema.prisma` targets SQLite via a Prisma 7 **driver adapter**
(`@prisma/adapter-libsql`, wired in `src/lib/prisma.ts` and `prisma/seed.ts`).
Prisma 7 requires an explicit adapter — there's no implicit "just point a URL at
it" mode anymore. The libsql adapter was chosen over `better-sqlite3` because it
ships prebuilt native bindings; `better-sqlite3` requires a C++ compiler
(node-gyp/Python) that this environment didn't have.

The schema deliberately avoids SQLite-only quirks:

- **No Prisma `enum`** — SQLite doesn't support them. Anything that looks like an
  enum (incident status, CAPA status) is a plain `String` with app-level
  constants (`src/server/incidents.ts`, `src/server/capa.ts`), which also matches
  the product requirement that these stay configurable rather than hardcoded.
- **`Json` fields** (e.g. `Organization.settings`) — Prisma serializes these to
  TEXT on SQLite and maps to native `jsonb`/`json` on PostgreSQL transparently.
- **`String @id @default(cuid())`** everywhere — no auto-increment integer IDs,
  which behave identically on both providers.

## Migrating to PostgreSQL

1. Provision a PostgreSQL database.
2. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```
3. Swap the driver adapter: install `@prisma/adapter-pg` + `pg`, and replace
   `PrismaLibSql` with `PrismaPg` in `src/lib/prisma.ts` and `prisma/seed.ts`.
4. Set `DATABASE_URL` to a `postgresql://...` connection string.
5. Run `npx prisma migrate dev` to generate a fresh initial migration against
   Postgres (SQLite and Postgres migration histories aren't interchangeable —
   start a new migration history), then `npx prisma db seed` if you want the
   demo data again.
6. Optional hardening once on Postgres: add Row-Level Security policies keyed on
   `organization_id` as defense-in-depth underneath the application-level tenant
   checks described in MULTI_TENANT.md. Not required — the app-level checks are
   the actual enforcement — but RLS is a reasonable extra layer for a production
   deployment with many tenants.

## Schema overview

**Platform / tenancy**: `Organization`, `OrgUnitType`, `OrgUnit` (self-referencing
hierarchy), `User`, `UserOrganization`, `Role`, `Permission`, `RolePermission`,
`UserOrganizationRole`, `Employee`, `AuditLog`, `Document`, `DocumentType`,
`Picklist` / `PicklistItem` (generic config lists reserved for future modules),
`IdSequenceConfig` (configurable ID formats per module per org).

**Incident module**: `IncidentCategory`, `IncidentSeverity` (both org-scoped,
fully configurable — see the seed data for two organizations using completely
different category/severity sets), `Incident`, `CapaItem`.

**`CapaItem` is polymorphic**: `sourceModule` + `sourceRecordId` instead of a
foreign key to `Incident`. This is what lets Inspection, Audit, Risk, and
Violation modules create CAPA items later without a schema change — they just
write a new `sourceModule` value.

**`Document` is also polymorphic**: `module` + `recordId`, reused by every
module's attachments instead of one `*_attachments` table per module. See
STORAGE.md.

**Employee snapshot fields on `Incident`**: `employeeNameSnapshot`,
`employeeCodeSnapshot`, `departmentSnapshot`, `positionSnapshot`,
`shiftSnapshot` are captured at creation time and never updated afterward — if
an employee later transfers departments, past incidents keep showing the
department they were in *at the time*, per the product requirement.

Run `npx prisma studio` to browse the live schema and data.
