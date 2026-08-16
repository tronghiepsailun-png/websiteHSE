# Changelog

## Post-Phase-2 — Dashboard: donut density, compact filter bar, KPI hierarchy

Targeted fix for 3 issues from user screenshots (charts, filters, hierarchy) — no data/logic/API changes.

- **Donut charts** (`src/components/charts/donut-chart.tsx`, used by Severity and Injured Body Part): the breakdown list next to the donut used to be `flex-1`, stretching to fill the card and leaving a large dead gap between the short labels and the right-aligned count/%. Each row now has an inline proportion mini-bar (width relative to the row's own max value) filling that space with an actual visualization instead of empty gap — also makes the ranked items easier to compare at a glance.
- **Filter bars** (`dashboard-filters.tsx`, `incident-filters.tsx`): replaced the padded `CardContent pt-6` + grid layout (felt like a tall, loose form) with a single-row `flex` toolbar, `p-3` padding, `gap-2` between fields, `size="sm"` filter button — same fields, same filter logic, much less whitespace.
- **KPI/section hierarchy** (`incidents/page.tsx` KPI cards + all 3 chart components' `CardTitle`): KPI labels are now a small uppercase/tracked caption (`text-[11px] font-semibold uppercase`) instead of reading at a similar weight to the number; KPI numbers bumped to `text-[26px] font-bold` (cost card slightly smaller to fit two currencies on one line); chart section titles bumped to `font-semibold` so they read as headers rather than body text.

Verified: build clean, drill-down click still filters the incident list and shows the clearable chip, bilingual labels (now uppercase in VI too) still translate correctly, no KPI numbers changed.

## Post-Phase-2 — Cap content width so the dashboard stops stretching on wide screens

Root cause: `<main>` in `src/components/layout/app-shell.tsx` was `flex-1` with no width ceiling, so every page's grid (KPI cards, charts, tables) grew exactly as wide as the browser window — fine at 1366px, absurd at 2560px/3440px (giant KPI cards, chart aspect ratios stretched sideways). Sidebar (`w-64`→`w-60`, now within the requested 220–250px range) and header height were already fixed-width/height and not the cause.

Fix, one change point: wrapped `{children}` inside `<main>` in `mx-auto w-full max-w-[1600px]` — every page centers and caps at 1600px on very wide viewports, with the extra space landing as margin on both sides instead of stretching components. No `transform: scale`, no per-page changes needed since every route already renders through this shared shell.

Verified at 1280/1366/1440/1920/2560px (desktop is the priority; mobile/tablet unaffected — untouched drawer-sidebar breakpoint still collapses correctly, no changes were made there) and confirmed no data/logic/routing changed: same KPI numbers, same filters, same CRUD.

## Post-Phase-2 — Enterprise HSE UI/UX redesign (system-wide, presentation only)

Full audit-then-redesign pass across the whole app, per an explicit "keep every function, redesign only the UI" brief. No schema, API, routing, or business-logic changes.

- **Unified badge system**: `src/components/ui/badge.tsx` (already existed, previously only used by admin active/inactive pills) is now the single primitive behind `SeverityBadge`/`IncidentStatusBadge`/`CapaStatusBadge` (`src/components/incidents/severity-badge.tsx`) — internal rewrite only, zero call-site changes.
- **New `EmptyState` component** (`src/components/ui/empty-state.tsx`) replacing 6 different ad-hoc "no data" implementations (incident list, CAPA list, incident detail's CAPA/attachments/history sections).
- **Design tokens**: `--radius` 0.625rem → 0.5rem; fixed a self-referential `--font-sans` CSS var that silently fell back to the browser default instead of the already-loaded Geist font.
- **Sidebar**: added a lucide icon per nav item (previously text-only) and grouped items into Tổng quan / HSE / Quản trị / Nền tảng — same routes and permissions, `src/lib/nav.ts` + `src/components/layout/sidebar-nav.tsx`.
- **Header**: minor icon-size consistency + subtle separators between the notification/theme, language, and user-menu clusters (`src/components/layout/app-shell.tsx`).
- **Dashboard charts** (`src/components/charts/*`): shrank chart heights (280px→220px bar/trend, 190px→150px donut), switched the trend line from a soft `monotone` curve to a firmer `linear` one, and rebuilt the donut layout as a compact chart + "Name — Count — %" breakdown list (matching the requested "Donut + breakdown bên cạnh" example) instead of a wrapped pill legend below the chart. Removed the now-dead `simple-bar-list.tsx` (superseded by the chart rebuild earlier this session).
- **Incident list**: consolidated the "Xem chi tiết" / "Xóa" row buttons into one compact `DropdownMenu` ("⋯") — new `src/app/(platform)/incidents/[id]/incident-row-actions.tsx`.
- **Row-height/spacing consistency**: applied the same `h-11` header / `h-14`+`py-3` body row convention already used on the incident and CAPA tables to all 5 admin tables (org-units ×2, categories, severities, users), and added the one missing page-level `<h1>` header (platform organizations page).
- **Loading & error states**: new `loading.tsx` for `/incidents` and `/capa` (skeleton placeholders matching each page's real layout) and one `error.tsx` at the `(platform)` route group level — none of these existed before.

## Post-Phase-2 — Create-incident form matches the original Excel column set

- Renamed "Báo cáo Sự cố" / "报告事故" to "Thêm sự cố" / "新增事故" (page title and the
  button that links to it), since this form is for entering any incident by hand, not
  only formally "reporting" one.
- Added every field from the user's real tracking file that the create form was missing,
  so a manually-entered incident exports with the same columns filled in as an imported
  one: incident number (optional manual override — falls back to the configured
  auto-sequence when left blank, with a friendly duplicate-number error instead of a raw
  DB constraint failure), factory code (saved into the existing `sourceRowData` JSON under
  the same `"工厂代码"` key the export route already reads — no schema change), area
  responsible person (reuses the existing `responsiblePersonId` field/employee list),
  cost in VND and cost in RMB as two fields (replacing the old single generic "cost"
  input), points deducted, and injured body part. Pre-existing investigation fields
  (immediate/root cause, preventive action) were left in place — the request was to add
  what's missing, not remove what's there.

## Post-Phase-2 — HSE Enterprise dark-mode color system

- Redesigned dark mode (light mode untouched, by request) around an HSE identity: dark
  navy surfaces (`#0B1320`/`#121A2B`/`#1A2337`) instead of neutral gray/black, green
  (`#22C55E`) as the primary/safety accent, blue (`#3B82F6`) for data/cost, and a semantic
  warning→critical ramp (amber `#FBBF24` → orange `#F97316` → red `#EF4444`) — all in
  `src/app/globals.css`, applied system-wide (every page) since it's theme tokens, not
  page-specific markup.
- Sidebar nav active state now uses a dedicated subtle green tint (`--sidebar-accent`)
  instead of a solid `--primary` fill, matching the "background tinted, text bright green"
  look enterprise nav systems use.
- Incident dashboard charts got matching per-metric color identity: Department bars use a
  green shade ramp, Category bars a blue shade ramp, the two trend charts are green
  (incident count) / blue (cost) filled area charts with a centered total on both donuts,
  and the Severity donut renders each severity's own real `colorHex` from the database
  (still fully tenant-configurable, not hardcoded) rather than a generic cycling palette.
- Updated severity colors to the new green→amber→orange→red semantic scale: direct A/B/C/D
  mapping for CCG (exact letter codes), rank-based interpolation for Organization A/B's
  differently-shaped severity scales — both the live database (one-off script) and
  `prisma/seed.ts` (for future reseeds) were updated.
- Added restrained accent icons to the 4 KPI cards (green/blue/amber/purple border + icon,
  no full-color fill) so each card reads at a glance without turning the dashboard into a
  wall of color.

## Post-Phase-2 — Incident dashboard: filters, KPIs, and an Enterprise BI chart redesign

- Rebuilt the "Quản lý Sự cố" page around a new Year/Month/Week/Department filter bar
  (Mon–Sun ISO week convention, shared with the export's week column via `src/lib/date.ts`)
  that drives 4 KPI cards (total incidents, total cost, days since the most recent incident
  *within the filtered scope*, total points deducted) — all computed by a new
  `getIncidentDashboardData()` in `src/server/incidents.ts`. The incident list below keeps
  its own pre-existing search/status/category/severity filter, independent of the new bar.
- Replaced the old unbounded bar-list charts (one row per category, up to 37 rows for
  Department) with a compact Enterprise HSE/BI layout: `recharts` via the official shadcn
  `chart` component, Top-N + "Khác/其他" bucketing, fixed chart heights, a "Xem tất cả" dialog
  for the full breakdown, and two 12-month trend lines (incident count, cost) alongside a
  Severity donut and Department/Category/Injured-Body-Part Top-N charts. New reusable
  components live in `src/components/charts/`.
- Added click-to-drill-down: clicking a Department, Category, or Injured-Body-Part
  bar/segment filters the incident list below and scrolls to it, with a clearable chip
  showing the active drill-down filter. Required extending `listIncidents()` with two new
  optional filters (`orgUnitId`, `injuredBodyPart`) — no schema change.
- Fixed a bilingual-reactivity gap this surfaced: text computed once in a Server Component
  (e.g. the "ngày/天" suffix, chart "unspecified" labels) doesn't react to the instant
  client-side VI/中文 switch. All new chart/KPI text now resolves via `useT()` inside client
  leaves instead of being passed down as pre-translated strings from the server.

## Post-Phase-2 — Delete incident, Select label fix, list row spacing, dark mode

- **Delete Incident**: new `incident.delete`-gated action (already-seeded permission,
  granted to `org_admin`/`hse_manager`) removes an incident together with its CAPA
  items and attachment documents/files, writes an audit log entry, and is exposed
  as a confirm-before-delete button on both the incident list (per row) and the
  detail page header.
- Fixed a recurring Base UI issue where every `Select` that had no `children`
  render-function on its `SelectValue` displayed the raw selected option's
  internal id instead of its label once a user picked something (most visibly on
  the "Báo cáo Sự cố" create form's Category/Severity/Org Unit/Employee selects).
  Applied the same children-function label lookup already used elsewhere to the
  remaining 7 affected selects (incident create form, add-CAPA responsible person,
  user invite role, org-unit type).
- Incident list rows now have a fixed, consistent height (`h-14` rows, uniform
  cell padding) instead of auto-sizing per row based on whatever badge/button/text
  combination happened to be in that row; the cost column is right-aligned.
- Added a light/dark mode toggle (sun/moon button in the topbar, next to the
  language switcher) backed by `next-themes` (already a dependency via the toast
  component). The color tokens for both themes already existed in `globals.css`;
  this only wires up the provider (`class` attribute on `<html>`, system-theme
  aware) and the toggle UI — no new CSS was needed.

## Post-Phase-2 — Incident list filter fix & export column order

- Fixed the incident/CAPA list filters: the status/category/severity Selects
  submit the literal string `"all"` for "no filter chosen", but the list pages
  were passing that straight into the Prisma query as `status: "all"` etc. —
  which matches nothing, so clicking "Lọc"/"筛选" with any default filter
  silently zeroed out the results. Both `/incidents` and `/capa` now treat
  `"all"`/blank as "no filter", same as the dropdown's own placeholder.
- Reordered the Excel export to match the original spreadsheet's column
  structure (Year/Month/Week/Factory Code first, Severity before the
  description, Category near the end, Notes last — see DATABASE.md) instead of
  the platform's own grouping, per user request, since organizations importing
  from an existing tracker expect the export to read like a continuation of it.
  Factory Code/Week/Year/Month are derived at export time (from `occurredAt`
  and the losslessly-stored `sourceRowData`), not new persisted columns.
  Platform-only fields (status, root cause, ...) are still included, appended
  after the original structure so no data is dropped.

## Post-Phase-2 — Excel import/export for Incident Management

- Extended `Incident` with fields needed for real historical HSE data:
  `responsiblePersonNameSnapshot` (a name-only responsible person, when there's
  no formal Employee record), `costRmb`, `costVnd`, `pointsDeducted`,
  `injuredBodyPart`, and `sourceRowData` (the full original spreadsheet row,
  verbatim JSON, so nothing from an imported file is ever lost even if a column
  isn't modeled explicitly).
- **Upload** ("Tải file sự cố lên"): `src/server/incident-import.ts` reads an
  `.xlsx` file, matches columns by a header-alias table (supports the original
  Chinese header convention and Vietnamese equivalents), validates required
  fields per row, and reports header-level errors by column name if the file
  structure doesn't match. Incident Number is the de-dup key — existing
  incidents are never overwritten, duplicates are reported by row. Missing
  categories/severities/departments referenced in the file are auto-created for
  the target organization (matching the platform's no-hardcoded-lists design);
  every created incident is audit-logged.
- **Download** ("Tải danh sách sự cố xuống"): `GET /api/incidents/export`
  streams every field to `.xlsx` with column headers in the current UI locale,
  wrapped long-text columns, and number/date formatting — verified to preserve
  Vietnamese/Chinese text and full description length losslessly.
- Incident list columns redesigned to the compact set requested (number, date,
  department, location, category, severity, injured person, cost, status, a
  "Xem chi tiết" button) — full description intentionally stays detail-page-only.
- Fixed a pre-existing gap: Platform Admins had no way to switch into an
  organization they aren't a `UserOrganization` member of (which is normal for
  them) — the switcher now lists every active organization for platform admins.
- Verified end-to-end against a real historical incident export (4 rows, one
  per severity A/B/C/D) into a newly created real tenant: upload → created,
  re-upload → all 4 correctly reported as duplicates (0 overwritten), detail
  page renders every field, export round-trips the same data with UTF-8 intact.

## Phase 1 + Phase 2 — Platform Foundation & Incident Management

**Phase 1 — Platform foundation**
- Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui project scaffold.
- Prisma 7 schema (SQLite dev, PostgreSQL-ready) covering organizations,
  configurable org-unit hierarchy, users, roles/permissions, employees, audit
  log, document metadata, and configuration tables.
- Auth.js (NextAuth v5) credentials login, JWT sessions, bcrypt hashing.
- Multi-tenant isolation enforced at DB, data-access, and session layers (see
  MULTI_TENANT.md).
- RBAC with 6 seeded org-scoped roles + a Platform Admin flag (see RBAC.md).
- Organization management (Platform Admin: create/activate/deactivate tenants).
- Configurable org structure (unit types + hierarchy) per organization.
- Organization Switcher for users belonging to multiple organizations.
- App shell: responsive sidebar/topbar, permission-filtered navigation.
- Local file storage abstraction (`StorageService`) with a `LocalStorageProvider`.
- Audit log wiring on incident, CAPA, and configuration mutations.
- Demo data: **Organization A** and **Organization B**, clearly marked TEST DATA,
  with deliberately different org structures, categories, and severities to
  prove the platform doesn't assume one shape fits every tenant.

**Phase 2 — Incident Management + CAPA**
- Incident list: KPI/summary cards, modest severity/status bar charts, filters,
  search.
- Incident creation with configurable, auto-generated Incident IDs
  (`IdSequenceConfig` per organization per module).
- Incident detail page covering all required sections: overview, people
  involved (with historical snapshot fields), location, classification,
  severity, description, investigation, root cause, CAPA, attachments/photos,
  timeline, audit history.
- CAPA implemented as a polymorphic module (`sourceModule` + `sourceRecordId`)
  reusable by future modules without a schema change; standalone `/capa` list
  plus creation from an incident.
- Configurable incident categories and severities per organization (no
  hardcoded lists).
- File upload/download for incident attachments, tenant-checked on every
  download.

## Post-Phase-2 — Bilingual UI (Vietnamese / Chinese)

- Full Vietnamese/Chinese interface with a VI / 中文 switcher in the top-right
  corner of every screen (login, organization picker, and the whole app shell).
  Vietnamese is the default locale for new sessions.
- Switching is instant and client-side — no page reload, no network request.
  Locale is held in a React context (`src/lib/i18n/locale-context.tsx`) and
  persisted to a cookie (`hse_locale`) so it's remembered across visits and
  read correctly on the server for the first paint and for translated Server
  Action responses (e.g. login/validation error messages).
- Every menu, button, page title, table header, form label, status badge, and
  system-generated message is translated. User-entered/configured data — org
  names, employee names, incident descriptions, category and severity names a
  tenant defines themselves — is deliberately left untouched.
- Seeded RBAC role names (Organization Admin, HSE Manager, Viewer, ...) are
  translated via a fixed lookup (`src/lib/i18n/role-label.ts`) since they're
  system-defined roles, not tenant-entered data.
- Translation dictionaries live in `src/lib/i18n/vi.ts` / `zh.ts`; TypeScript
  enforces both files declare the same set of keys.
- No changes to business logic, the database schema, or existing functionality
  — this was a presentation-layer addition only.

## Explicitly not built yet (by design — see the product brief)

- Platform-wide dashboard (`/` is a placeholder until several modules have real
  data to summarize).
- Every module beyond Incident Management + CAPA (Inspection, Audit, PCCC,
  Equipment, Legal Compliance, Training, Risk, Environmental, Chemical,
  Contractor, Document Management as its own module, Reports).
- Google Drive integration (local storage only for now — see STORAGE.md).
- AI features (OCR, root-cause suggestions, semantic search, etc.).
- Global search across modules.
- Self-service password reset, email delivery for invites.
- Import/Export (Excel/CSV).
- Database/file backup automation.

## Next steps

Stopped here per plan for review before Phase 3 (Inspection) or any further
module work begins.
