# Utility Manager

Next.js app for utility readings — public client lookup, admin panel, Supabase Postgres. Based on patterns from [estimate-builder](https://github.com/sandris-mitthus/estimate-builder).

**Current version:** `1.0.15` (see [Changelog](#changelog))

---

## Features

### Authentication

- **Sākums** (`/`) — publisks, bez pieslēgšanās
- **Administrācija** (`/admin`) — e-pasts + parole; tikai lietotāji tabulā `admin_users`
- Supabase Auth (e-pasts/parole) + `admin_users` whitelist (`app/lib/auth/`)
- Session refresh via `proxy.ts` (prunes foreign Supabase cookies when multiple apps share `localhost`)
- Admin seed: `npm run db:seed-admin` (ENV `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`)

### Starter UI

- **Sākums** (`/`) — klienta meklēšana (`GET /api/public/lookup`) un rādījumu iesniegšana ar signed token; ja šī mēneša rādījumi jau ir (web vai e-pasts), rāda „Rādījumi jau iesniegti”; FAQ kontakti (tālrunis, SMS, WhatsApp, e-pasts) treknrakstā
- **Administrācija** (`/admin`) — klienti, skaitītāji, iesniegtie rādījumi, **e-pasta rādījumi** (IMAP, parsēšana, automātisks imports), kontaktu iestatījumi; CSRF + rate limit admin API
- **App nav** — app name from `app_settings.app_name` (fallback: “Utility Manager”)
- **SectionPage** layout helper for new screens

### Rādījumu nodošana (2 veidi)

1. **Web** — klients meklē adresi/numuru, aizpilda formu (`POST /api/public/submissions`)
2. **E-pasts** — admin (vai ārējs scheduler) ievāc nelasītos e-pastus (IMAP), parsē tekstu (Limbažu formāti), piesaista skaitītājiem un **automātiski pievieno** sadaļai „Rādījumi” (`readings_submissions`). Abi veidi dalās vienu mēneša ierakstu — pēc importa web forma rāda „jau iesniegti” līdz nākamajam kalendārajam mēnesim.

### Data

- **Supabase** (Postgres) when env is configured
- **`app_settings`** singleton (`id = 1`) — `app_name` for branding in nav and home subtitle
- **`email_inbox_messages`**, **`email_fetch_state`** — IMAP ievākšana, parsēšana, importa statuss (`010`, `012`)
- **`contact_settings.email_password`**, **`imap_host`** — admin IMAP/SMTP (`011`); ENV rezerves variants
- **`meters.baseline_reading`** — skaitītāja rādījums uz skaitītāja; netiek pārrakstīts pēc iesniegšanas (`009`); patēriņš adminā
- **`contact_settings`**, **`clients`**, **`meters`** — admin CRUD (migrācijas `005`, `006` sākuma dati)
- **`admin_users`** — administratoru e-pasta whitelist (`002`–`004`)
- App tables use **service-role server access** with RLS deny policies for browser clients
- `npm run db:migrate` applies only **pending** migrations (tracked in `public.schema_migrations`); pēc migrācijas automātiski pārlādē PostgREST kešu

### Security

- **CSP** response headers in `next.config.ts` (Supabase `connect-src`, Google fonts)
- Safe OAuth redirect paths (`app/lib/security/safe-redirect-path.ts`)
- **Pilns audits:** [`security-check.md`](security-check.md) — pašreizējā atzīme **8.5/10**
- **CI (push):** `.github/workflows/ci.yml` — gitleaks, npm audit, typecheck, lint, build, security smoke; **production deploy tikai pēc `ci-passed`**

---

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Supabase** — Postgres + Auth via `@supabase/ssr` + service role on server
- **Tailwind CSS 4**
- **Vercel** — zero-config deploy (see below)

---

## Getting started

### Requirements

- Node.js 20+
- npm

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) — publisks sākums; `/admin` prasa administratora login.

**Local dev tip:** Multiple Supabase apps on `localhost` share cookies and can trigger HTTP **431** (headers too large). Use `127.0.0.1` for one app, or clear `sb-*` cookies; `dev`/`start` scripts raise the header limit and the session proxy prunes foreign Supabase cookies.

### Other scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Production build |
| `npm run start` | Production server (port 3001) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply pending SQL migrations to Supabase Postgres |
| `npm run db:reload-schema` | Reload PostgREST schema cache (`NOTIFY pgrst`) |
| `npm run db:seed-admin` | Sync Supabase Auth user + `admin_users` row from ENV |
| `npm run db:test` | Test Supabase connection and core tables |

### Environment

Copy `.env.example` → `.env.local` and fill in **real** values locally. Never commit `.env.local`. Keep `.env.example` as placeholders only.

| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | No | Default dev port `3001` (see `package.json` scripts) |
| `NEXT_PUBLIC_SUPABASE_URL` | DB + Auth | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | DB + Auth | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | DB | Server only |
| `NEXT_PUBLIC_SITE_URL` | Auth | `http://localhost:3001` locally; OAuth redirect base |
| `SUPABASE_DB_PASSWORD` or `DATABASE_URL` | Migrations | `npm run db:migrate` only |
| `SUPABASE_DB_REGION` | Migrations | Pooler region (default `eu-west-1`) if direct `db.*` host fails |
| `ADMIN_SEED_EMAIL` | Admin seed | `npm run db:seed-admin` |
| `ADMIN_SEED_PASSWORD` | Admin seed | `npm run db:seed-admin` |
| `CONTACT_SMTP_HOST` | SMTP | Server only; paziņojums pēc web iesniegšanas |
| `CONTACT_SMTP_PORT` | SMTP | Noklus. `587` |
| `CONTACT_SMTP_USER` | SMTP | Noklus. kontaktu e-pasts |
| `CONTACT_EMAIL_PASSWORD` | SMTP / IMAP | Server only; SMTP un IMAP parole |
| `CONTACT_IMAP_HOST` | IMAP | Server only; ja nav, mēģina `imap.` no `CONTACT_SMTP_HOST` |
| `CONTACT_IMAP_PORT` | IMAP | Noklus. `993` |
| `CONTACT_IMAP_USER` | IMAP | Noklus. kontaktu e-pasts no `contact_settings` |
| `CRON_SECRET` | IMAP scheduler (nav obligāts) | Aizsargā `GET /api/cron/fetch-emails` (`Authorization: Bearer …`); izmanto ārēju cron (ne Vercel) vai izlaid, ja ievāc tikai adminā |

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy API keys and database password into **`.env.local`**
3. Run migrations:

```bash
npm run db:migrate
npm run db:seed-admin
npm run db:test
```

4. Enable **Email** provider: Authentication → Providers → Email
5. Set redirect URLs: Authentication → URL Configuration  
   - Site URL: `http://localhost:3001`  
   - Redirect: `http://localhost:3001/auth/callback` (ja izmanto OAuth callback)
6. Atveriet `/` (publisks) vai `/admin` (admin login)

**Service role:** glabājiet `SUPABASE_SERVICE_ROLE_KEY` tikai servera ENV (Vercel). Pēc iespējamā noplūdes incidenta — rotējiet atslēgu Supabase Dashboard → API un atjauniniet deploy ENV.

**Schema:** `supabase/migrations/` — `001`–`012`; `schema_migrations` (auto-managed by migrate script). Pēc jaunas migrācijas obligāti `npm run db:migrate`.

---

## Vercel deployment

### CI pirms production (Vercel Deployment Protection)

Plūsma: **push uz `main`** → paralēli **GitHub Actions** (`gitleaks`, `npm-audit`, `smoke`, `ci-passed`) un **Vercel Git deploy** (build). Production publicēšana notiek tikai tad, kad Vercel **Deployment Protection** redz, ka obligātās GitHub pārbaudes ir zaļas.

**Vienreizēja iestatīšana Vercel:**

1. Projektā saglabā ENV (Supabase u.c.) — tāpat kā agrāk; Git integrācija uz `main` atstāta ieslēgta (nav `vercel.json`, kas to bloķē)
2. **Settings → Git → Deployment Protection** (vai **Deployments → Protection Rules**)
3. Ieslēdz aizsardzību production deployiem un pievieno **Required GitHub checks** (precīzi job nosaukumi no `ci.yml`):
   - `gitleaks`
   - `npm-audit`
   - `smoke`
   - (ieteicams) `ci-passed`
4. Saglabā — nākamais push uz `main` rādīs Vercel deployment, bet production tiks publicēts pēc CI zaļajām pārbaudēm

**Ja checks rāda „Queued” ilgi:** parasti GitHub runner rinda — pagaidi vai atcel run un mēģini vēlreiz. PR checks parasti startē ātrāk. Pārbaudi [githubstatus.com](https://www.githubstatus.com/) un **Settings → Actions → General** (Actions ieslēgti).

**Alternatīva:** GitHub Actions `deploy-vercel` job + `VERCEL_*` secrets (v1.0.11) — nav nepieciešams, ja lieto Vercel Deployment Protection.

### Pirmreizēja setup

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com) (Framework Preset: **Next.js**)
3. Add environment variables (same as `.env.example`, except DB password — migrations run locally):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` |

4. Deploy
5. In Supabase → Authentication → URL Configuration, add production redirect:
   - Site URL: `https://your-app.vercel.app`
   - Redirect: `https://your-app.vercel.app/auth/callback`

Run `npm run db:migrate` from your machine against the production Supabase DB when you add new migrations.

**E-pasta ievākšana:** nav `vercel.json` cron — Vercel Hobby/limits bieži met kļūdu. Ievāciet manuāli admin **E-pasts** cilnē vai iestatiet ārēju scheduler (piem. servera cron, Uptime Robot), kas periodiski izsauc:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://your-app.vercel.app/api/cron/fetch-emails"
```

---

## Extending the starter

1. **New tables** — add `00N_description.sql` under `supabase/migrations/` (RLS deny for `anon`/`authenticated`), then `npm run db:migrate`
2. **Server data** — `app/lib/*/repository.ts` with `createAdminClient()` (see `app/lib/settings/repository.ts`)
3. **New pages** — routes under `app/(protected)/`; add links in `app/components/app-nav.tsx` (`NAV_ITEMS`)
4. **Cursor rules** — `.cursor/rules/` for README bumps, commits, migrations, Supabase security

---

## Project structure

```
app/
├── (protected)/
│   ├── layout.tsx           # Route shell (no global demo provider)
│   ├── page.tsx             # Client lookup + readings from DB (PublicDataProvider)
│   └── admin/
│       ├── layout.tsx       # Admin auth gate + AdminDataProvider
│       └── page.tsx         # AdminPanel
├── api/
│   ├── admin/               # settings, clients, meters, email/inbox (auth + CSRF)
│   ├── cron/
│   │   └── fetch-emails/    # GET — IMAP + imports (CRON_SECRET; ārējs scheduler)
│   └── public/
│       ├── lookup/          # GET — klienta meklēšana serverī
│       └── submissions/     # POST — rādījumi (signed token, rate limit)
├── auth/
│   ├── callback/
│   └── auth-code-error/
├── components/
│   ├── admin/               # tabs, modals, admin-email-tab, admin-login-gate
│   ├── admin-data-provider.tsx
│   ├── public-data-provider.tsx
│   ├── contract-lookup-panel.tsx, meter-reading-form.tsx, faq-accordion.tsx
│   └── ui/                  # action-button, icon-input, table-empty-row, feedback-toast, …
└── lib/
    ├── auth/
    ├── security/            # rate-limit, admin-api CSRF, audit-log, lookup-token
    ├── utility/             # repository, parse-meter-email, match/import, fetch-contact-inbox, …
    ├── format-date.ts
    ├── settings/
    └── supabase/
proxy.ts
scripts/                     # db:migrate, db:seed-admin, db:test, test-parse-meter-email, …
security-check.md            # drošības audits, atzīme, ieteikumi, CI apraksts
supabase/migrations/
.cursor/rules/
```

Public repo: [github.com/sandris-mitthus/utility-manager](https://github.com/sandris-mitthus/utility-manager)

---

## Versioning & commits

Semantic versioning in `package.json`. Each **release** commit:

1. Bump `package.json` `"version"`
2. Add `### vX.Y.Z` under **Changelog** (newest first)
3. End the commit message with `. vX.Y.Z`

**Commit message format:**

```
Short description of what shipped. v1.0.1
```

Cursor rules:

- `.cursor/rules/admin-demo-ui.mdc` — admin modāļi, pogas, tabulas, `IconInput` / `PasswordInput`
- `.cursor/rules/feedback-toast.mdc` — atbildes ar `FeedbackToast`
- `.cursor/rules/readme-version-update.mdc` — README update + version bump
- `.cursor/rules/github-version-commit.mdc` — commit message format; run `typecheck` + `build` before commit/push
- `.cursor/rules/db-migrate-after-sql.mdc` — run `npm run db:migrate` after new SQL
- `.cursor/rules/supabase-migration-security.mdc` — RLS deny policies, `search_path`, storage rules
- `.cursor/rules/button-cursor-pointer.mdc` — all buttons use `cursor: pointer` (base styles in `globals.css`)
- `.cursor/rules/button-action-loading.mdc` — `ActionButton` ar loading spinner darbības pogām

---

## Changelog

### Unreleased

- (none)

### v1.0.15

- **Deploy** — noņemts `vercel.json` cron (Vercel kļūdas); e-pasta ievākšana adminā vai caur ārēju scheduler uz `/api/cron/fetch-emails`

### v1.0.14

- **FAQ** — tālruņa numuri, SMS, WhatsApp un e-pasta adrese atbildēs treknrakstā (`faq-items.ts`, `faq-accordion.tsx`)

### v1.0.13

- **E-pasta rādījumi** — IMAP tikai nelasītie; pēc ievākšanas atzīmē kā izlasītus; parsētājs Limbažu formātiem (t.sk. `1234=155-123`); piesaiste skaitītājiem pēc iepriekšējā rādījuma
- **Automātisks imports** — veiksmīgi parsēti e-pasti nonāk `readings_submissions` (apvienošana, ja mēnesis jau ir); admin birka „Pievienots nodotajiem rādījumiem”; migrācija `012`
- **Admin e-pasts** — IMAP parole un serveris Iestatījumos (`011`); cilne ar ievākšanu, pārparsēšanu un dzēšanu; stundas cron

### v1.0.12

- **CI/CD** — A variants: noņemts `vercel.json` auto-deploy bloķējums un GitHub `deploy-vercel`; production caur Vercel Git + **Deployment Protection** (obligātie checks: `gitleaks`, `npm-audit`, `smoke`)

### v1.0.11

- **CI/CD** — viens `ci.yml`: pārbaudes (`gitleaks`, `npm-audit`, `smoke`) → `ci-passed` → `deploy-vercel` tikai uz `main`; `vercel.json` atslēdz auto-deploy uz `main`

### v1.0.10

- **Sākums** — rādījumu formas atpakaļ pogas ar tekstu **„Atpakaļ”** (bez tooltip); t.sk. „nav skaitītāju” ekrāns

### v1.0.9

- **Patēriņš** — `baseline_reading` (`009`); iesniegumos saglabāts iepriekšējais rādījums; admin „Iesnieguši” rāda patēriņu pret skaitītāja rādījumu
- **Skaitītājs** — lauks „Skaitītāja rādījums uz skaitītāja” (admin modālis + publiskā forma); repozitorijs strādā arī pirms migrācijas `009`
- **UI** — FAQ kartītes bez ārējā fona; rādījumu apstiprinājuma/„jau iesniegti” pogas ar tekstu un **Nr.** boldā; admin „Iziet” bez border

### v1.0.8

- **Drošība** — viss `security-check.md` HIGH/MEDIUM/LOW (CSRF, zod, rate limit, headers, audit log, CI smoke); atzīme **8.5/10**
- **Publiskā meklēšana** — `GET /api/public/lookup`; signed `submissionToken`; SMTP paziņojums pēc web iesniegšanas
- **Demo noņemts** — publiskā `/` no DB; `readings_submissions`; `email_password` → ENV
- **Migrācija `008`** — submissions, audit log, noņemta `email_password` kolonna

### v1.0.7

- **Klienta numurs** — noņemts `K-` prefikss demo datos, placeholderos, FAQ un admin formās; migrācija `007`

### v1.0.6

- **FAQ** — tālrunis, SMS, WhatsApp un e-pasts no `contact_settings`; kopēšanas bloki SMS/WhatsApp/e-pastam (ne zvanīšanai)
- **Sākums** — `loadContactSettings()` serverī; noņemts demo padoms zem meklēšanas lauka; `ActionButton` uz „Turpināt”
- **Admin** — tukšām tabulām `TableEmptyRow`; iestatījumu „Saglabāt” labajā pusē

### v1.0.5

- **Modāļi** — kājas labajā; secība Atcelt → Noņemt → Saglabāt; noņemšanai sarkanīgs `dangerButtonClassName`
- **Tooltip** — tabulas pogas tooltip vairs nepaliek virs modāļa; klikšķī paslēpjas
- **Sākums** — „Turpināt” un „Iesniegt rādījumus” ar tekstu blakus ikonai (bez tooltip)

### v1.0.4

- **Formu lauki** — `IconInput`, `PasswordInput`, `IconSelect` visur; placeholderi un ikonas; parole ar rādīt/paslēpt
- **DB** — PostgREST keša pārlāde pēc `db:migrate`; `npm run db:reload-schema`
- **Admin UI** — iestatījumu „E-pasta parole”; „Noņemt adresi” ar X ikonu

### v1.0.3

- **Admin DB** — `contact_settings`, `clients`, `meters` tabulas + demo seed (`005`, `006`); API `/api/admin/*`
- **Admin frontend** — `AdminDataProvider`, settings/clients/meters saglabāšana uz Supabase; publiskais `/` paliek demo atmiņā
- **Cursor rule** — `db-migrate-after-sql.mdc` ar `alwaysApply: true`

### v1.0.2

- **Sākums** — klienta meklēšana, rādījumu forma, FAQ (demo dati); FAQ accordion ikonas izmēra labojums
- **Admin** (`/admin`) — klienti, skaitītāji, iesniegumi, iestatījumi; modāļi, dzēšanas/noņemšanas apstiprinājumi, kompakta skaitītāju tabula
- **Supabase** — `.env.local` setup, `db:migrate` / `db:test`; publisks GitHub repozitorijs
- **Cursor rules** — `admin-demo-ui`, README update un GitHub push workflow (LV)

### v1.0.1

**README sync**

- Documented `app_settings` (`app_name`), home status checks, CSP, session cookie pruning
- Added `PORT` env, `db:test` scope, **Extending the starter** section
- Project structure: `proxy.ts`, `next.config.ts`, settings types/repository

### v1.0.0

**Initial starter**

- Next.js 16 + React 19 + TypeScript + Tailwind 4
- Supabase Auth (Google OAuth), SSR clients, session proxy, cookie cleanup
- Migration runner (`schema_migrations`), initial `app_settings` table
- Protected layout, login gate, home status page
- Vercel-ready CSP headers and deployment docs
