# Multi-Tenant Architecture

Every `Organization` is a tenant. Tenants share one database and one schema —
there is no database-per-tenant or schema-per-tenant — isolation is enforced in
code at three layers so it cannot be silently skipped in one route:

## 1. Database layer

Every tenant-scoped table has an `organizationId` foreign key to `organizations.id`
with `onDelete: Cascade`, plus a composite index like `@@index([organizationId, ...])`
on the fields it's commonly filtered/sorted by. See `prisma/schema.prisma`.

## 2. Data access layer

Repository-style functions in `src/server/*.ts` (e.g. `listIncidents`,
`getIncidentById`) always take `organizationId` as an explicit parameter and
always include it in the Prisma `where` clause. For single-record lookups,
`assertBelongsToOrg()` (`src/server/org-context.ts`) is called immediately after
the fetch as a second check — even if a `where` clause were ever written
incorrectly, this catches a record belonging to the wrong tenant before it's
returned, and throws a `NotFoundError` (404) rather than leaking that the record
exists in another tenant.

## 3. Session layer — the critical one

`organizationId` is **never** taken from client-supplied input (URL params, form
fields, request bodies). It is resolved server-side from:

- the authenticated session (`auth()` via Auth.js), plus
- an `hse_active_org` **httpOnly** cookie holding the currently selected
  organization, set only by `switchOrganizationAction` after that Server Action
  re-verifies the user actually belongs to that organization (or is a Platform
  Admin).

`requireOrgContext()` (`src/server/org-context.ts`) is the single function that
resolves `{ userId, isPlatformAdmin, organizationId }` for a request, and it
re-checks membership every time — it does not trust a stale cookie value. Every
page, Server Action, and Route Handler that touches tenant data calls this (via
`requireApiAccess()` / `requireOrgPermission()` in `src/server/api-guard.ts`)
before running any query.

Platform Admins (a boolean flag on `User`, not a per-org role) bypass the
membership check but still operate within one selected organization at a time —
there is no "show me everything across all tenants at once" view for business
data, only the platform-wide `Organization` list itself
(`/admin/platform/organizations`).

## Configurable org structure

Instead of hardcoding Site/Building/Workshop/Department/Team, each organization
defines its own `OrgUnitType` list (ordered, named levels) and `OrgUnit` tree
(self-referencing `parentId`). Two organizations can have completely different
hierarchies — see the seeded Organization A (Site → Department) vs. Organization B
(Facility → Zone) for an example.

## Verifying isolation yourself

1. Sign in as `orgadmin.a@example.com` (Organization A), open an incident, copy
   its URL.
2. Sign out, sign in as `hsestaff.b@example.com` (Organization B), paste that
   same URL.
3. Expect a "Not found" page — not the incident, not an error revealing it
   exists.
4. Confirm `/incidents` for each account only ever lists that account's own
   organization's data.

This exact scenario was verified manually during Phase 2 development.
