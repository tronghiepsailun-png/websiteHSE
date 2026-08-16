# HSE Management Platform

A multi-tenant Health, Safety & Environment (HSE) management platform. This is a
**platform**, not a single company's website — every organization ("tenant") that
uses it gets its own isolated data, its own configurable structure, and its own
categories/severities/roles. See [ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[MULTI_TENANT.md](docs/MULTI_TENANT.md) for the design.

Current status: **Phase 1 (platform foundation) + Phase 2 (Incident Management + CAPA)**.
No overall dashboard, Google Drive integration, or AI features yet — see
[CHANGELOG.md](docs/CHANGELOG.md) for what's built and what's next.

## Quick start

1. **Install Node.js LTS** from [nodejs.org](https://nodejs.org) if you haven't already.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template and adjust if needed (the defaults work for local dev):
   ```bash
   cp .env.example .env
   ```
4. Create the local database and load demo data:
   ```bash
   npx prisma migrate dev
   ```
   (This also runs `prisma/seed.ts` automatically the first time.)
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000 and sign in with one of the demo accounts below.

## Demo accounts (TEST DATA)

All seeded data is clearly synthetic — two demo tenants, **Organization A** and
**Organization B** — never a real company. Every account uses the same password:
`Password123!`

| Email | Organization | Role |
|---|---|---|
| `platform.admin@example.com` | — (all orgs) | Platform Admin |
| `orgadmin.a@example.com` | Organization A | Organization Admin |
| `viewer.a@example.com` | Organization A | Viewer (read-only) |
| `orgadmin.b@example.com` | Organization B | Organization Admin |
| `hsestaff.b@example.com` | Organization B | HSE Staff |
| `multiorg@example.com` | Org A (HSE Manager) + Org B (Viewer) | — |

Use `multiorg@example.com` to see the Organization Switcher in action.

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — platform design, tech stack, module layout
- [DATABASE.md](docs/DATABASE.md) — schema overview and PostgreSQL migration path
- [MULTI_TENANT.md](docs/MULTI_TENANT.md) — how tenant isolation is enforced
- [RBAC.md](docs/RBAC.md) — roles, permissions, how to add a new one
- [STORAGE.md](docs/STORAGE.md) — file storage abstraction
- [SECURITY.md](docs/SECURITY.md) — security baseline and what's still open
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — running this outside local dev
- [CHANGELOG.md](docs/CHANGELOG.md) — what's shipped, phase by phase

## Project scripts

```bash
npm run dev              # start dev server (Turbopack)
npm run build             # production build
npm run start             # run a production build
npx prisma studio         # browse the database
npx prisma migrate dev    # create/apply a migration (re-runs the seed on a fresh DB)
```
