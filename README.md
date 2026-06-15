# Utility Manager

Next.js starter for utility management apps — Google OAuth, Supabase Postgres, and Vercel deployment. Based on the same stack and patterns as [estimate-builder](https://github.com/sandris-mitthus/estimate-builder).

**Current version:** `1.0.2` (see [Changelog](#changelog))

---

## Features

### Authentication

- **Google OAuth** via Supabase — when not signed in, only a centered “Pierakstīties ar Google” button is shown
- Protected app routes under `app/(protected)/`; OAuth callback at `/auth/callback`
- Session refresh via `proxy.ts` on every request (prunes foreign Supabase cookies when multiple apps share `localhost`)
- **Top nav (right):** signed-in user avatar, name, and sign-out button

### Starter UI

- **Sākums** (`/`) — klienta numura/adreses meklēšana, rādījumu ievade, FAQ (demo dati atmiņā)
- **Administrācija** (`/admin`) — klienti, skaitītāji, iesniegtie rādījumi, kontaktu iestatījumi (demo UI, backend vēlāk)
- **App nav** — app name from `app_settings.app_name` (fallback: “Utility Manager”)
- **SectionPage** layout helper for new screens

### Data

- **Supabase** (Postgres) when env is configured
- **`app_settings`** singleton (`id = 1`) — `app_name` for branding in nav and home subtitle
- App tables use **service-role server access** with RLS deny policies for browser clients
- `npm run db:migrate` applies only **pending** migrations (tracked in `public.schema_migrations`)

### Security

- **CSP** response headers in `next.config.ts` (Supabase `connect-src`, Google fonts)
- Safe OAuth redirect paths (`app/lib/security/safe-redirect-path.ts`)

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

Open [http://localhost:3001](http://localhost:3001) — login gate if Supabase auth is configured.

**Local dev tip:** Multiple Supabase apps on `localhost` share cookies and can trigger HTTP **431** (headers too large). Use `127.0.0.1` for one app, or clear `sb-*` cookies; `dev`/`start` scripts raise the header limit and the session proxy prunes foreign Supabase cookies.

### Other scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Production build |
| `npm run start` | Production server (port 3001) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply pending SQL migrations to Supabase Postgres |
| `npm run db:test` | Test Supabase connection, auth, and `app_settings` |

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

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy API keys and database password into **`.env.local`**
3. Run migrations:

```bash
npm run db:migrate
npm run db:test
```

4. Enable **Google** provider: Authentication → Providers → Google
5. Set redirect URLs: Authentication → URL Configuration  
   - Site URL: `http://localhost:3001`  
   - Redirect: `http://localhost:3001/auth/callback`
6. Start the app — sign in, then `/` shows system status

**Schema:** `supabase/migrations/` — `001_app_settings.sql` (`app_settings` singleton + `set_updated_at()`), `schema_migrations` (auto-managed by migrate script)

---

## Vercel deployment

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
│   ├── layout.tsx      # Login gate or AppNav + children
│   ├── page.tsx        # Client lookup, readings, FAQ
│   └── admin/page.tsx  # Admin panel (demo data)
├── auth/
│   ├── callback/
│   └── auth-code-error/
├── components/
│   ├── admin/          # clients, meters, submissions, settings tabs + modals
│   ├── demo-data-provider.tsx
│   ├── contract-lookup-panel.tsx, meter-reading-form.tsx, faq-accordion.tsx
│   └── ui/             # confirm-close-dialog, tooltip-button, use-modal-keyboard
└── lib/
    ├── auth/
    ├── demo/           # seed data, FAQ items, helpers
    ├── format-date.ts
    ├── security/
    ├── settings/
    └── supabase/
proxy.ts
scripts/                # db:migrate, db:test
supabase/migrations/
.cursor/rules/          # admin-demo-ui, README bump, GitHub commits, db:migrate, Supabase security
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

- `.cursor/rules/admin-demo-ui.mdc` — admin modāļi, pogas, tabulas, apstiprinājumi
- `.cursor/rules/readme-version-update.mdc` — README update + version bump
- `.cursor/rules/github-version-commit.mdc` — commit message format; run `typecheck` + `build` before commit/push
- `.cursor/rules/db-migrate-after-sql.mdc` — run `npm run db:migrate` after new SQL
- `.cursor/rules/supabase-migration-security.mdc` — RLS deny policies, `search_path`, storage rules
- `.cursor/rules/button-cursor-pointer.mdc` — all buttons use `cursor: pointer` (base styles in `globals.css`)

---

## Changelog

### Unreleased

- (none)

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
