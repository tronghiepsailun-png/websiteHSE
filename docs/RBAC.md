# RBAC (Role-Based Access Control)

## Model

- **`User.isPlatformAdmin`** — a boolean flag, not a role row. Platform Admins
  bypass all org-scoped permission checks (`requirePermission` returns
  immediately). This is intentionally separate from the `Role` table because a
  platform admin isn't "in" any one organization.
- **`Role`** — org-scoped roles, seeded in `prisma/seed.ts`:
  `org_admin`, `hse_manager`, `department_manager`, `hse_staff`,
  `department_user`, `viewer`. More can be added without a schema change.
- **`Permission`** — fine-grained keys like `incident.create`, `capa.approve`,
  `organization.manage`. Defined in `src/server/permissions.ts` and seeded
  alongside roles.
- **`RolePermission`** — join table: which permissions each role grants.
- **`UserOrganization`** — membership: is this user active/invited/disabled in
  this organization, independent of which role(s) they hold.
- **`UserOrganizationRole`** — join table: `(user, organization, role)`. A user
  can hold **different roles in different organizations** — this is what powers
  the Organization Switcher (see the seeded `multiorg@example.com` account).

## Enforcement — always server-side

`src/server/rbac.ts`:

```ts
requirePermission(userId, organizationId, isPlatformAdmin, "incident.edit")
```

looks up every role the user holds *in that organization*, unions their
permissions, and throws `ForbiddenError` (403) if the key isn't present.

Every Server Action and Route Handler calls this — via
`requireApiAccess(permissionKey)` (Route Handlers) or
`requireOrgPermission(permissionKey)` (Server Actions), both in
`src/server/api-guard.ts` — **before** touching the database. Hiding a button or
a form in the UI (which every page also does, using the permission list fetched
once per page load) is cosmetic only; it is not the actual gate. A user who
crafts a request directly against a Server Action or API route without the
required permission gets rejected server-side regardless of what the UI shows.

## Seeded permission → role matrix

| Permission | viewer | department_user | hse_staff | department_manager | hse_manager | org_admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `*.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `incident.create` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `incident.edit` | | | ✓ | ✓ | ✓ | ✓ |
| `incident.delete` | | | | | ✓ | ✓ |
| `capa.create` / `capa.edit` | | | ✓ | ✓ | ✓ | ✓ |
| `capa.approve` | | | | ✓ | ✓ | ✓ |
| `capa.close` | | | | | ✓ | ✓ |
| `config.manage` | | | | | ✓ | ✓ |
| `employee.manage` | | | | | ✓ | ✓ |
| `organization.manage` / `user.manage` | | | | | | ✓ |

See `ROLE_PERMISSIONS` in `prisma/seed.ts` for the exact source of truth.

## Adding a new role or permission

1. Add the permission key to `PERMISSIONS` in `src/server/permissions.ts`.
2. Add it to `PERMISSION_DEFS` and the relevant entries in `ROLE_PERMISSIONS` in
   `prisma/seed.ts`, then re-run the seed (`npx prisma db seed`) — it's
   idempotent (`upsert`), safe to re-run.
3. Use `PERMISSIONS.YOUR_KEY` in the relevant `requireApiAccess` /
   `requireOrgPermission` call and in `src/lib/nav.ts` if it should gate a nav
   item.

New org-scoped roles are just a new row in `Role` — no schema change.
