# Security

## What's in place

- **Authentication**: Auth.js (NextAuth v5), Credentials provider, JWT session
  strategy. Session cookies are `httpOnly`, `sameSite: lax`, and `secure` in
  production (see `src/auth.ts`).
- **Password hashing**: bcrypt (`bcryptjs`, pure JS — no native compiler
  dependency), 10 salt rounds, in `src/auth.ts` and every place a password is
  set (`prisma/seed.ts`, `admin/users/actions.ts`).
- **Authorization**: every Server Action and Route Handler that touches tenant
  data calls `requireOrgContext()` + `requirePermission()` before running any
  query — see RBAC.md and MULTI_TENANT.md. Never trust the UI's hidden buttons
  as the actual gate.
- **Tenant isolation**: enforced at three layers (DB FK, data-access layer,
  session-resolved `organizationId`) — see MULTI_TENANT.md. Verified manually
  by attempting cross-tenant access during Phase 2 development.
- **Input validation**: Zod schemas on every Server Action that accepts user
  input (`src/app/(platform)/**/actions.ts`).
- **SQL injection**: Prisma uses parameterized queries throughout; no raw SQL
  string concatenation anywhere in the codebase.
- **XSS**: React escapes all rendered content by default; nothing in this
  codebase uses `dangerouslySetInnerHTML`.
- **CSRF**: Auth.js has built-in CSRF protection for its own endpoints; Server
  Actions get the framework's built-in origin-check protection in Next.js 16.
- **File upload safety**: MIME allowlist, size cap, randomized storage
  filenames, storage root outside any web-served path — see STORAGE.md.
- **Secrets**: only ever read from `process.env`, sourced from `.env` (gitignored).
  `.env.example` is the committed template with no real secrets. Never commit
  `.env`.
- **Route protection**: `proxy.ts` (Next.js 16's replacement for `middleware.ts`)
  redirects any unauthenticated request to `/login` before it reaches a page.

## Known Phase 1/2 limitations (intentional, revisit before real production use)

- **No self-service password reset / change-password UI.** New users created
  via "Add user to this organization" get a temporary password shown once on
  screen — there is no email delivery in this phase, and no way for that user
  to change their own password yet. Fine for demo/internal use; needs a proper
  invite-by-email + password-reset flow before onboarding real, non-technical
  users.
- **No rate limiting** on the login endpoint. Add one (e.g. a small in-memory or
  Redis-backed limiter) before exposing this beyond a trusted network.
- **No CAPTCHA / bot protection** on login.
- **No account lockout** after repeated failed logins.
- **SQLite in dev** has no row-level security; tenant isolation relies entirely
  on the application layer described in MULTI_TENANT.md. Consider Postgres RLS
  as defense-in-depth after migrating (see DATABASE.md).
- **Audit log is append-only application logic**, not a database-enforced
  immutable log (no triggers preventing `UPDATE`/`DELETE` on `audit_logs`).
  Sufficient for now; a real compliance deployment may want DB-level
  enforcement.

## Reporting a concern

This is an internal-development-phase project; there's no public bug bounty
process yet. Flag anything security-relevant to whoever owns this repository
before it goes anywhere near real employee or incident data.
