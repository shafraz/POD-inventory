# MPL Asset Inventory & Equipment Management System

A web application that replaces the Excel workbook **Inventory TEst.xlsx** for managing operational equipment (8" tablets, 10" tablets, PCs and VHF radios). It keeps the workbook's structure but adds a live dashboard, permanent movement history, repair and damage tracking, verification cycles, reports and exports, role-based access, and an audit trail that can't be altered.

The core workflow: **Register → Assign → Move/Transfer → Track current location → Repairs/Damage → Verify → Complete history → Report**.

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui-style components (Radix UI primitives, in `src/components/ui`), Lucide icons, Recharts |
| Backend | Next.js server components, **server actions** (all mutations), and REST route handlers (export, import upload, search, QR, attachments, notifications, health) |
| Database | PostgreSQL 14+ with Prisma ORM 6 (node-postgres driver adapter, so no native query-engine binary is needed at runtime) |
| Auth | Email/username and password (bcrypt, cost 12). Sessions are stored in the database behind an httpOnly cookie, with idle and absolute expiry. 4 roles. |
| Exports | ExcelJS (.xlsx), CSV (UTF-8 with BOM, protected against formula injection), jsPDF + autotable (.pdf) |

## 2. Quick start (local)

Prerequisites: Node 20.9+ (22 recommended) and PostgreSQL 14+.

```bash
cp .env.example .env              # then edit DATABASE_URL and the seed passwords
npm install                       # also runs `prisma generate`
npm run db:setup                  # applies migrations and seeds (imports the workbook)
npm run dev                       # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (the defaults are `admin@mpl.mv` / `ChangeMe@2026` from `.env.example`). If `SEED_DEMO_USERS=true`, the seed also creates `officer@mpl.mv`, `ops@mpl.mv` and `viewer@mpl.mv` with `SEED_DEMO_PASSWORD`.

**Restricted networks:** if Prisma can't download its schema-engine binary (for example behind a strict proxy), run migrations through the WebAssembly engine with `PRISMA_JS_ENGINE=1 npx prisma migrate deploy`, or apply `prisma/migrations/*/migration.sql` with `psql`.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build or run in production |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed reference data and users, and import the workbook (idempotent: the import is skipped if assets already exist) |
| `npm run typecheck` / `lint` | Static checks |
| `npm run test:e2e` | Browser acceptance test of the full workflow. Needs a running server, `npx playwright install chromium`, and `ADMIN_PASSWORD` / `DEMO_PASSWORD` set to the seeded passwords |

## 3. Data migration from Excel

The seed script and the **Import from Excel** screen run the same pipeline (`src/lib/import`):

1. **Asset Register** is the primary source. It is already the consolidated list, and it keeps the existing Asset IDs (`TAB8-001`, `TAB10-001`, `PC-001`, `VHF-001`, `VHFU-063`, and so on).
2. **Tab 8", Tab 10", PC and VHF** (including the "Unknown" block in columns K–P) are legacy sheets. Each row is matched to a register row by source reference, then by serial/IMEI, then by device name. A match fills only fields that are empty in the register; it never overwrites them. A legacy row with no match is **flagged and left out by default**, so no duplicate is created silently.
3. **Movement Log** rows that have a date and an Asset ID become movements. **Lists** adds any new locations, statuses and SIM operators.
4. **Dashboard** is ignored, because every figure is calculated live.
5. Values are normalised only where the change is safe: brand spellings (`MOTROLA` becomes `Motorola`), SIM text split into operator and number (`Dhiraagu 10GB / 1675 4957`), location aliases (`C-Yard` becomes Container Yard), spaces inside codes, and dates written as text (`31.1.2022`).
6. **Nothing is discarded.** Remarks are kept word for word. Every original cell value is stored on the asset (`legacy_data`) and shown under **Original Excel data** on the asset page. "Repair History" text becomes completed repair records, and "Issued Date" becomes an Issue movement.
7. Rows with warnings (possible duplicate serial, duplicate device name, unmatched legacy row, unknown location or status) are imported with a **"needs review" flag**. Use the *Needs review* filter on the Assets page, and *Mark review resolved* on an asset once it has been checked.

**Result of migrating the supplied workbook:** 280 assets (46 Tablet 8", 20 Tablet 10", 49 PC, 165 VHF). This matches the workbook's dashboard: 179 In Use, 8 In Stock, 2 Under Repair, 7 Damaged, 83 Unverified and 1 Not in Use.

| Finding | Count |
|---|---|
| Flagged for review | 6: 4 rows sharing a serial (`752TXFU909` on VHF-091 and VHFU-040; `WPLN4137BR` on VHFU-025 and VHFU-026), and 2 PCs named `PC-COD-43` |
| Missing location / serial / inventory no. / asset no. | 118 / 55 / 114 / 235 (imported unchanged, reported as data gaps) |
| Values normalised | 26 |
| Non-data rows skipped | 12 (legend rows in Tab 8", count rows in Tab 10", the blank Movement Log template row) |
| Repair records created | 12 (10 from repair-history text, plus open cases for the 2 assets marked Under Repair) |

The import screen shows record counts by type and each warning category (click one to filter the rows), lets you tick rows in or out, and offers **Import valid records** or **Import selected**. Uploading the same workbook again finds all 280 as "already in the system" and selects nothing.

## 4. Business rules

- **The register is the current state; history is permanent.** Every operation runs in a single database transaction that writes the event record (movement, repair, verification, damage report or OS update), updates the asset through one function (`applyAssetChange`), and writes a field-level audit row for each changed value.
- **Asset IDs** are generated as `PREFIX-NNN`, where the next number is the highest existing one plus one. The Asset ID is unique at database level. The prefix is locked once assets of that type exist.
- **Uniqueness:** serial, IMEI, inventory number and asset number must be unique (case-insensitive) whenever they are entered or changed. Duplicates that came from the workbook don't block unrelated edits.
- **Status rules** (`src/lib/operation-rules.ts`, shared by the server and the forms):
  - Issue only from In Stock, Not in Use or Unverified.
  - Repair In only from Under Repair.
  - Transfer, Return and Repair Out are blocked for Lost, Disposed or Under Repair assets.
  - Dispose asks for confirmation; Lost requires a reason.
  - Repair In restores the status the asset had before repair (In Use, otherwise In Stock), or sets Damaged if it wasn't repairable.
  - Return sets In Stock, or Damaged if the condition is Damaged or Critical.
  - Verifying an Unverified asset sets In Use if it is assigned, otherwise In Stock. A "Not found" result sets Lost.
- **Verification:** next verification = verification date + interval (90 days by default; change it in Settings, which can recalculate existing dates). An asset is **Due Soon** within 14 days (configurable) and **Overdue** once the date has passed or if it has never been verified. Disposed assets are excluded.
- **Dashboard** figures are live `COUNT`/`GROUP BY` queries; nothing is stored. Total Devices excludes disposed and archived assets.
- **Delete** (administrators only) archives the asset: the movement history and audit trail stay, and the asset can be restored.
- **Audit trail** is append-only. A database trigger rejects any `UPDATE` or `DELETE` on `audit_logs`.

## 5. Roles

| Capability | Admin | Inventory Officer | Operations User | Viewer |
|---|:-:|:-:|:-:|:-:|
| View assets, dashboard and reports; export | ✓ | ✓ | ✓ | ✓ |
| Add and edit assets | ✓ | ✓ | | |
| Delete (archive) assets | ✓ | | | |
| Issue, transfer, return, dispose, mark lost | ✓ | ✓ | request | |
| Repairs | ✓ | ✓ | request | |
| Report damage | ✓ | ✓ | ✓ | |
| Verify, record OS updates | ✓ | ✓ | | |
| Review requests, view audit trail | ✓ | ✓ | | |
| Users, locations, types, statuses, settings, import | ✓ | | | |

Operations Users raise **requests** (issue, transfer, return or repair). Officers see them under *Movement & Transfers → Requests*. **Action** opens the matching form pre-filled, and saving it records the movement and closes the request. **Reject** closes it with a note. Permissions are enforced on the server in every action and route; the interface only hides controls the user can't use.

## 6. Project structure

```
prisma/
  schema.prisma              normalised schema (assets, movements, repairs, verifications, damage_reports,
                             os_updates, attachments, asset_requests, audit_logs, notifications, lookups…)
  migrations/                SQL migrations (includes the audit_logs immutability trigger)
  seed.ts                    reference data, users, workbook migration
  data/Inventory TEst.xlsx   initial workbook
src/
  app/(app)/…                pages: dashboard, assets, assets/[id], movements, repairs, verification,
                             reports, locations, asset-types, users, settings, import, audit, scan/[code]
  app/actions/…              server actions (validated with zod, permission-checked)
  app/api/…                  export, import, search, qr, attachments, notifications, health
  lib/services/…             business logic: assets, operations, dashboard, history, reports, audit, notifications
  lib/import/…               workbook parser, normaliser and commit
  lib/export/exporters.ts    xlsx / csv / pdf writers
  lib/asset-filters.ts       one filter definition shared by tables, reports and exports
  lib/operation-rules.ts     status transition rules
  components/…               ui primitives, shell, forms, tables, dialogs
tests/e2e-workflow.mjs       browser acceptance test
```

UI components never query the database: pages call services, and mutations go through server actions, which call services.

## 7. Extensibility

- **Asset types** are data. Each type has a prefix, labels for standard fields (for example VHF uses *Local Code* and *MPL Code*), an identifier (IMEI or serial), flags for SIM and OS tracking, and **extra fields** (text, number, date, dropdown, yes/no) stored in `assets.attributes`. A new tablet model is added in *Asset Types* with no code change.
- **Locations, statuses, conditions, departments, shifts, SIM operators and brands** are database lookups managed in the interface. Workflows depend on each status's fixed `code`, not its display name, so statuses can be renamed safely.
- **QR codes** encode only the Asset ID. `/scan/<Asset ID>` opens the asset profile, ready for a mobile scanner.
- The event tables and `Attachment` / `AssetRequest` models give natural places to add purchase and warranty records, vendors, maintenance schedules, disposal approvals, email or WhatsApp notifications (hook into `notify()`), and API integration (for example the Bandharu Portal) through the service layer.

## 8. Deployment

### Railway (cloud)

The repo includes `railway.json`: Railway builds with `npm run build`, runs `prisma migrate deploy` and the seed before each deploy (the seed is idempotent), and checks `/api/health`.

1. Push this folder to a GitHub repository.
2. In Railway, create a new project, choose **Deploy from GitHub repo**, and select the repository.
3. In the project, add a **PostgreSQL** database (**+ New → Database → PostgreSQL**).
4. On the app service, open **Variables** and set:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (a strong password)
   - `SEED_DEMO_USERS` = `false`
   - `APP_TIMEZONE` = `Indian/Maldives`
5. Under **Settings → Networking → Generate Domain**, create a URL; custom domains are supported too. The first deploy imports the workbook automatically.

### Docker

```bash
DB_PASSWORD=strong-secret SEED_ADMIN_PASSWORD='Str0ng!Pass' docker compose up -d --build
docker compose exec app npm run db:seed        # first run only: reference data, admin user, workbook import
```

The app listens on port 3000 and applies pending migrations on start. `GET /api/health` checks the database.

### Linux VM (no Docker)

```bash
npm ci && npm run build
npm run db:migrate && npm run db:seed           # first deployment
PORT=3000 npm start                             # run under systemd or pm2
```

Put **nginx** (or IIS/ARR) in front with HTTPS, then set `client_max_body_size 12m;` for Excel uploads. Cookies are `Secure` in production; set `COOKIE_SECURE=false` only on a trusted plain-HTTP intranet. Back up PostgreSQL daily with `pg_dump`; attachments are stored in the database, so one backup covers everything.

### Production checklist

Set strong `SEED_ADMIN_PASSWORD` and `SEED_DEMO_USERS=false` before the first seed, then change the admin password after first sign-in. Restrict database access to the app host, keep `APP_TIMEZONE=Indian/Maldives`, and review `SESSION_IDLE_MINUTES`.

## 9. Security

- Passwords are hashed with bcrypt and never sent to the browser.
- Session tokens are random 256-bit values, stored only as SHA-256 hashes, in httpOnly SameSite=Lax cookies. Sessions expire after inactivity (server-enforced, with a warning in the browser) and after an absolute lifetime. Deactivating a user ends their sessions.
- Login attempts are throttled.
- Every action and API route checks authentication and permission server-side. All input is validated with zod. Prisma parameterises every query (no SQL injection).
- Uploads are limited by type and size. CSV exports are protected against formula injection. Security headers are set (X-Frame-Options, nosniff, Referrer-Policy).
- The audit trail cannot be modified, even from the database directly (trigger).

## 10. Testing

`tests/e2e-workflow.mjs` runs the acceptance workflow in a real browser. On the supplied data, **39 of 39 checks pass**:

1. Add a new Tablet 10" (ID generated as `TAB10-021`).
2. It starts at Container Yard, In Stock. A duplicate IMEI is rejected.
3. Issue it to C Yard. The form shows the current location, status and assignee automatically.
4. Transfer it to HMT; the confirmation reads *"Are you sure you want to transfer TAB10-021 from Container Yard to HMT?"*.
5. Send it for repair (status becomes Under Repair).
6. Return it from repair (status goes back to In Use; repair cost and parts recorded).
7. Verify it (next verification set 90 days ahead).
8. The movement history shows Registered, Issue, Transfer, Repair Out, Repair In and Verified, and the repair history is complete.
9. The dashboard updates: Total 280 → 281, In Use 179 → 180, and the new movements appear under recent movements.
10. The asset record exports to Excel (one sheet per section), PDF and CSV. A filtered register export contains only the filtered rows.

It also checks: global search by IMEI (`350675291331135` finds TAB8-008); that every page renders; the 6 migration flags; mobile layout; the viewer being read-only and blocked from admin pages; an Operations User able to request but not record movements; and re-importing the workbook creating no duplicates.
