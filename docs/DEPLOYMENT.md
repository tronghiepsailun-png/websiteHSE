# Deployment

## Local development (current state)

```bash
npm install
cp .env.example .env
npx prisma migrate dev   # creates dev.db + seeds demo data
npm run dev
```

Runs on Node.js directly — no Docker required. See README.md for demo accounts.

## Production build, self-hosted Node.js

```bash
npm run build
npm run start
```

Before doing this for anything beyond a demo:

1. **Migrate to PostgreSQL** (see DATABASE.md) — SQLite is fine for a single
   local instance but not for a production multi-tenant deployment with
   concurrent users (file-level locking, no built-in replication/backup
   tooling).
2. **Set real environment variables** (`.env`, never committed):
   - `DATABASE_URL` — your PostgreSQL connection string
   - `AUTH_SECRET` — generate with `npx auth secret` or `openssl rand -base64 32`;
     use a different value than the local dev default
   - `NEXTAUTH_URL` — your real domain, `https://...`
   - `STORAGE_ROOT` — a persistent disk path, not ephemeral container storage
     (or switch to a cloud `StorageService` implementation — see STORAGE.md)
3. Put the app behind a reverse proxy (nginx/Caddy) terminating TLS, forwarding
   to the Node.js process.
4. Run under a process manager (PM2, systemd, or your platform's equivalent) so
   it restarts on crash/reboot.
5. Point backups at the PostgreSQL database and at `STORAGE_ROOT` — see
   "Backup" below.

## Optional: Docker

Not required (this project was built without Docker available), but if you
prefer containers: a standard multi-stage Next.js Dockerfile (`node:20-slim`
builder + runner stages) works unmodified with this project, paired with a
`postgres:16` container and a bind-mounted volume for `STORAGE_ROOT`. Not
included in this repo yet — add a `docker-compose.yml` when you actually need
it rather than carrying one unused.

## Backup (future work — not yet implemented)

- **Database**: use your PostgreSQL provider's native backup/point-in-time
  recovery, or `pg_dump` on a schedule.
- **Files**: back up `STORAGE_ROOT` (or your cloud storage bucket) on the same
  schedule as the database, since `Document` rows reference paths there — a
  database restore without a matching file restore leaves broken references.
- **Data export/import**: not built yet; Import/Export (Excel/CSV) is called
  out in the product brief as a later phase.

## Environment variables reference

See `.env.example` for the full list with comments.
