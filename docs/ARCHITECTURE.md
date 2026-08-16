# Architecture

## Vision

This is **one platform, many organizations** — not one company's website. An
`Organization` is a tenant. The platform ships with a foundation (auth, RBAC,
multi-tenancy, configurable org structure, audit log, file storage) plus one
complete HSE module (Incident Management + CAPA). 20+ other HSE modules
(Inspection, Audit, PCCC/Fire Safety, Legal Compliance, Training, Risk, ...) are
designed for but not built — they will reuse the same foundation.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | Next.js 16 (App Router), TypeScript, React 19 | One codebase, one dev server, one deploy artifact. Server Components for data-heavy pages, Server Actions for mutations — no separate REST API layer to keep in sync. |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI primitives) | Consistent, accessible, professional look without a heavy design system. |
| ORM / DB | Prisma 7 + SQLite (dev), driver adapter `@prisma/adapter-libsql` | Type-safe, parameterized queries. Schema avoids SQLite-only quirks so migrating to PostgreSQL is a datasource + adapter swap (see DATABASE.md). |
| Auth | Auth.js (NextAuth v5), Credentials provider, JWT sessions, bcrypt hashing | Self-hosted, no vendor lock-in. |
| Validation | Zod on every mutating input | Defense-in-depth against malformed input. |
| File storage | `StorageService` interface, `LocalStorageProvider` implementation | DB stores metadata only (see STORAGE.md); swapping providers later doesn't touch call sites. |
| Deployment | Self-hosted Node.js (`next build && next start`) | No Docker requirement; see DEPLOYMENT.md for options. |

Mutations are implemented as **Next.js Server Actions** colocated with each route
(`actions.ts` next to `page.tsx`) rather than a separate `/api` REST layer. Every
Server Action and Route Handler still goes through the same two guards —
`requireOrgContext()` (who, which tenant) and `requirePermission()` (what they're
allowed to do) — so the enforcement is identical either way. A few Route Handlers
exist under `/api` where a plain HTTP endpoint is actually needed (Auth.js's own
endpoint, document downloads).

## Project structure

```
prisma/
  schema.prisma        # all Phase 1+2 models
  seed.ts               # Organization A / B demo data (TEST DATA only)
src/
  app/
    login/               # public
    (platform)/          # everything behind auth, wrapped by AppShell
      layout.tsx          # resolves session + active org, renders shell
      page.tsx            # dashboard placeholder (intentionally minimal)
      incidents/           # list, [id] detail, new
      capa/                 # standalone CAPA list
      admin/
        org-units/           # org structure config
        categories/           # incident categories config
        severities/            # incident severities config
        users/                   # org users & roles
        platform/organizations/ # Platform Admin only — manage tenants
    api/
      auth/[...nextauth]/    # Auth.js
      documents/[id]/         # tenant-checked file download
  components/
    ui/                # shadcn/ui primitives
    layout/             # AppShell, sidebar, org switcher, user menu
    incidents/           # severity/status badges, simple bar chart
  lib/
    prisma.ts            # Prisma client singleton (driver adapter wired here)
    nav.ts                 # sidebar nav config + permission gating
  server/
    org-context.ts        # session + active-org resolution (tenant guard)
    rbac.ts                 # permission lookups
    api-guard.ts              # combines the two for routes/actions
    permissions.ts             # permission key constants
    incidents.ts, capa.ts        # per-module query/service functions
    storage.ts                    # StorageService abstraction
    audit.ts                       # audit log writer
    errors.ts                       # typed HTTP-ish errors (401/403/404)
  types/next-auth.d.ts   # session/user type augmentation
proxy.ts                # redirects unauthenticated requests to /login
```

## Why no full dashboard yet

Per the product brief, the overall platform dashboard is deliberately deferred
until several modules exist with real data — building it now would mean guessing
at KPIs. `/` currently renders a minimal placeholder. The Incident module has its
own small, module-scoped KPI/chart section (`/incidents`), which is the pattern
future modules should follow until the platform dashboard is designed.

## Extending with a new module

1. Add tables to `prisma/schema.prisma`, scoped by `organizationId` like every
   other tenant table.
2. Add permission keys to `src/server/permissions.ts` and seed them + role
   mappings in `prisma/seed.ts`.
3. Add a route under `src/app/(platform)/<module>/` following the Incident
   module's pattern: `page.tsx` (list) using `requireApiAccess(PERMISSIONS.X_VIEW)`,
   `actions.ts` for mutations using `requireOrgPermission(...)`.
4. If the module needs CAPA, create `CapaItem` rows with
   `sourceModule: "<module>"` — no schema change needed (see DATABASE.md).
5. Add the nav entry to `src/lib/nav.ts`.
6. Wire `writeAuditLog(...)` (from `src/server/audit.ts`) into create/update/delete.
