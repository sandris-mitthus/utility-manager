# Utility Manager

Next.js app for utility readings — public client lookup, admin panel, Supabase Postgres. Based on patterns from [estimate-builder](https://github.com/sandris-mitthus/estimate-builder).

**Current version:** `1.0.33` (see [Changelog](#changelog))

---

## Features

### Authentication

- **Sākums** (`/`) — publisks, bez pieslēgšanās
- **Administrācija** (`/admin`) — e-pasts + parole; tikai lietotāji tabulā `admin_users`
- Supabase Auth (e-pasts/parole) + `admin_users` whitelist (`app/lib/auth/`)
- Session refresh via `proxy.ts` (prunes foreign Supabase cookies when multiple apps share `localhost`)
- Admin seed: `npm run db:seed-admin` (ENV `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`)

### Starter UI

- **Sākums** (`/`) — meklēšana pēc klienta koda (`GET /api/public/lookup`) un rādījumu iesniegšana ar signed token; **tiešā saite** `/r/{public_token}` atver to pašu formu bez meklēšanas; skaitītāji ir pa adresēm un veidiem, ar m³; jau nodotos rādījumus nevar labot, bet atlikušos var iesniegt vēlāk; ja visi šī mēneša rādījumi ir iesniegti, rāda „Rādījumi jau iesniegti” ar automātisku countdown atgriešanos uz sākumu; validācijas kļūdas rāda toast; FAQ kontakti un kopējamais rādījumu paraugs tiek ņemti no admin iestatījumiem
- **Administrācija** — katrai sadaļai ir savs URL: `/admin/submissions`, `/admin/clients`, `/admin/meters`; **Iestatījumi** apakšizvēlnē ir iestatījumi, e-pasts, WhatsApp, **Integrācijas** (Resend) un **API** (telefona aģents); `/admin` novirza uz rādījumiem; saraksti ielādē visus ierakstus; joslā e-pasts ir labajā pusē un saīsinās, ja neietilpst; CSRF + rate limit admin API
- **App nav** — app name from `app_settings.app_name` (fallback: “Utility Manager”)
- **SectionPage** layout helper for new screens

### Rādījumu nodošana

1. **Web** — klients ievada klienta kodu vai atver personīgo saiti `/r/{public_token}`, aizpilda formu (`POST /api/public/submissions`). Rādījums var būt ar 3 zīmēm aiz komata. Jau iesniegtu skaitītāju šajā mēnesī vairs nevar labot, bet pārējos var nodot vēlāk. Ja adminā norādītas pēdējās X mēneša dienas, ārpus šī perioda iesniegšana ir slēgta.
2. **E-pasts** — admin (vai ārējs scheduler) ievāc nelasītos e-pastus (IMAP), parsē tekstu (Limbažu formāti), piesaista skaitītājiem un **automātiski pievieno** sadaļai „Rādījumi” (`readings_submissions`). Konta adrese, parole un IMAP serveris ir sadaļā `/admin/email`. Abi veidi dalās vienu mēneša ierakstu — pēc importa web forma rāda „jau iesniegti” līdz nākamajam kalendārajam mēnesim.
3. **Telefona aģents** — AI Receptionist aģents zvanā pajautā klienta numuru, atrod klientu un pa vienam pieņem skaitītāju rādījumus (`GET`/`POST /api/agent`, Bearer atslēga). Rādījumi iziet tās pašas pārbaudes kā web formā, un pēc tiem aiziet tie paši paziņojumi. Adrese, atslēga, ieslēgšana un jaunas atslēgas ģenerēšana ir sadaļā `/admin/api`.
4. **Google Sheets** — ja serverī ir Google OAuth ENV (ieteicams) vai service account fallback, katram mēnesim automātiski tiek izveidots savs Spreadsheet fails; katram klientam ir viena rinda, un e-pasta apvienošana atjaunina esošo klienta rindu.

### WhatsApp Business (rezerves kanāls)

WhatsApp sadaļā (`/admin/whatsapp`) izvēlas kanāla režīmu:

- **Izslēgts** vai tukšs WhatsApp numurs — rādījumu formā WhatsApp pogas nav
- **WhatsApp saite uz numuru** — poga atver lietotāja WhatsApp (`wa.me`) ar sagatavotu ziņu uz `contact_settings.whatsapp_number`; API atslēgas nav vajadzīgas
- **WhatsApp Business API** — serveris nosūta ziņu caur Meta Cloud API uz paziņojumu numuru: gan pēc katra web iesnieguma (paralēli e-pasta paziņojumam), gan pēc lietotāja pieprasījuma (`POST /api/public/whatsapp`)

Ziņas teksts nāk no `contact_settings.whatsapp_message_template` ar vietturiem `{client_number}`, `{address}`, `{month}`, `{readings}`. Admin sadaļā ir poga **Sūtīt testa ziņu** (`POST /api/admin/settings/whatsapp-test`).

WhatsApp brīva teksta ziņas ir atļautas tikai 24 h laikā pēc saņēmēja pēdējās ziņas, tāpēc regulāriem paziņojumiem norādiet **apstiprinātu veidni** (`whatsapp_template_name`) ar vienu `{{1}}` mainīgo body daļā — tajā tiek ievietots ziņas teksts vienā rindā. Izejošais paziņojums pats **neveido** ierakstu `readings_submissions`. Ienākošās WhatsApp ziņas admin sadaļā var parsēt un importēt rādījumos, ja sūtītāja numurs sakrīt ar klienta tālruni.

### Data

- **Supabase** (Postgres) when env is configured
- **`app_settings`** singleton (`id = 1`) — `app_name` for branding in nav and home subtitle
- **`google_sheet_months`** — mēneša `YYYY-MM` kartējums uz automātiski izveidoto Google Spreadsheet (`013`)
- **`email_inbox_messages`**, **`email_fetch_state`** — IMAP ievākšana, parsēšana, importa statuss (`010`, `012`)
- **`contact_settings.email_password`**, **`imap_host`**, **`reading_submission_template`** — admin IMAP/SMTP un FAQ kopējamais rādījumu teksts (`011`, `015`); ENV rezerves variants
- **`contact_settings.whatsapp_mode`** (`off` / `link` / `api`), **`whatsapp_phone_number_id`**, **`whatsapp_access_token`**, **`whatsapp_notify_number`**, **`whatsapp_template_name`**, **`whatsapp_template_language`**, **`whatsapp_message_template`** — WhatsApp Business kanāls (`018`); tokens un numura ID ar ENV rezerves variantu, tokens klientam netiek atgriezts
- **`meters.baseline_reading`** — skaitītāja rādījums uz skaitītāja; netiek pārrakstīts pēc iesniegšanas (`009`); patēriņš adminā
- **`contact_settings`**, **`clients`** (`public_token` unikālai rādījumu saitei, `017`), **`meters`** — admin CRUD (migrācijas `005`, `006` sākuma dati)
- **Klientu reģistrs** (`019`, `020`) — klienta vārds, e-pasts, tālruņi, skaitītāja tipa kods, derīguma termiņš, objekta adrese un apkure; rādījumi glabājas ar 3 zīmēm aiz komata
- **`contact_settings.reading_window_days`** (`021`) — `0` nozīmē visu mēnesi, citādi rādījumus drīkst nodot tikai pēdējās tik dienas (Eiropas/Rīgas laiks)
- **`site_integrations`** (`022`, `023`) — Resend: sūtītāja e-pasts, API atslēga un Reply-To; atslēga paliek serverī. Ieslēgta integrācija sūta rādījumu paziņojuma e-pastu; citādi paliek SMTP. Telefona aģenta piekļuves atslēga (`voice_agent`) paliek serverī; `GET/POST /api/agent` atrod klientu un saglabā rādījumu
- **`admin_users`** — administratoru e-pasta whitelist (`002`–`004`)
- App tables use **service-role server access** with RLS deny policies for browser clients
- `npm run db:migrate` applies only **pending** migrations (tracked in `public.schema_migrations`); pēc migrācijas automātiski pārlādē PostgREST kešu

### Security

- **CSP** response headers in `next.config.ts` (hydration-compatible public scripts, Supabase `connect-src`, Google fonts)
- Safe OAuth redirect paths (`app/lib/security/safe-redirect-path.ts`)
- **Pilns audits:** [`security-check.md`](security-check.md) — pašreizējā atzīme **8.8/10**
- **CI (push):** `.github/workflows/ci.yml` — gitleaks, npm audit, typecheck, lint, build, security smoke; **production deploy tikai pēc `ci-passed`**
- **npm audit politika:** bloķē `npm audit --omit=dev --audit-level=high` (viss, kas nonāk izpildlaikā); pilnais audits ar dev rīkiem ir informatīvs (`continue-on-error`), jo `brace-expansion` 5.x pārrauj ESLint `minimatch` 3.x ķēdi

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
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business | Server only; rezerve, ja `contact_settings.whatsapp_phone_number_id` ir tukšs |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business | Server only; rezerve, ja DB tokens nav saglabāts |
| `WHATSAPP_API_VERSION` | WhatsApp Business | Graph API versija, noklus. `v21.0` |
| `CRON_SECRET` | IMAP scheduler (nav obligāts) | Aizsargā `GET /api/cron/fetch-emails` (`Authorization: Bearer …`); izmanto ārēju cron (ne Vercel) vai izlaid, ja ievāc tikai adminā |
| `GOOGLE_SHEETS_ENABLED` | Google Sheets | `false` izslēdz sinhronizāciju arī tad, ja credentials ir iestatīti |
| `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` + `GOOGLE_OAUTH_REFRESH_TOKEN` | Google Sheets | Ieteicamais variants, lai mēneša failus veidotu lietotāja Google Drive kvotā |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` | Google Sheets | Service account credentials; privātajā atslēgā `\n` paliek kā escaped rindas |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Sheets | Alternatīva atsevišķiem email/private key ENV |
| `GOOGLE_SHEETS_FOLDER_ID` | Google Sheets | Neobligāta Drive mape mēneša Spreadsheet failiem; OAuth lietotājam vai service accountam vajag Editor piekļuvi |

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

**Google Sheets:** ieteicamais production variants ir Google OAuth refresh token (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`), jo mēneša Spreadsheet faili tiek veidoti lietotāja Google Drive kvotā. Service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` vai `GOOGLE_SERVICE_ACCOUNT_JSON`) paliek kā fallback, bet parastā My Drive mapē tas nevar izveidot jaunus failus, ja service accountam nav Drive krātuves kvotas. Ja lieto konkrētu Drive mapi, iestati `GOOGLE_SHEETS_FOLDER_ID`. Bez Google ENV rādījumi saglabājas tikai Supabase. Lokālos service account JSON failus glabā ārpus Git; `.gitignore` ignorē `utility-manager-*.json`.

### Local Google Sheets setup

Lokālai Google Sheets sinhronizācijai `.env.local` vajag OAuth datus:

```env
GOOGLE_OAUTH_CLIENT_ID=<Google OAuth client id>
GOOGLE_OAUTH_CLIENT_SECRET=<Google OAuth client secret>
GOOGLE_OAUTH_REFRESH_TOKEN=<Google OAuth refresh token>
GOOGLE_SHEETS_FOLDER_ID=<Google Drive folder id>
```

`GOOGLE_SHEETS_FOLDER_ID` ir tikai mapes ID daļa no Drive URL. Piemēram, no `https://drive.google.com/drive/folders/<folder-id>?usp=drive_link` jāņem tikai `<folder-id>`.

Refresh token iegūšana:

1. Atver [Google OAuth Playground](https://developers.google.com/oauthplayground)
2. Zobratiņā ieslēdz **Use your own OAuth credentials**
3. Ievadi `GOOGLE_OAUTH_CLIENT_ID` un `GOOGLE_OAUTH_CLIENT_SECRET`
4. Autorizē scopes:

```text
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive
```

5. Nospied **Exchange authorization code for tokens**
6. Nokopē `refresh_token` uz `.env.local` kā `GOOGLE_OAUTH_REFRESH_TOKEN`

Pēc `.env.local` izmaiņām obligāti pārstartē dev serveri, jo Next.js servera ENV tiek nolasīti startā:

```bash
npm run dev
```

Ja Google OAuth app ir **Testing** režīmā, refresh token var beigties pēc aptuveni 7 dienām. Ilgākam production lietojumam publicē OAuth app vai atjauno tokenu, kad Google sāk atgriezt `invalid_grant`.

**Schema:** `supabase/migrations/` — `001`–`016`; `schema_migrations` (auto-managed by migrate script). Pēc jaunas migrācijas obligāti `npm run db:migrate`.

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
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` | Optional Google Sheets sync (recommended) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` or `GOOGLE_SERVICE_ACCOUNT_JSON` | Optional Google Sheets service account fallback |
| `GOOGLE_SHEETS_FOLDER_ID` | Optional Drive folder for monthly spreadsheets |

4. Deploy
5. In Supabase → Authentication → URL Configuration, add production redirect:
   - Site URL: `https://your-app.vercel.app`
   - Redirect: `https://your-app.vercel.app/auth/callback`

Run `npm run db:migrate` from your machine against the production Supabase DB when you add new migrations.

**Google Sheets production ENV:** Vercel → Project → Settings → Environment Variables. Ieteicamais variants production:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID=<Google OAuth client id>
GOOGLE_OAUTH_CLIENT_SECRET=<Google OAuth client secret>
GOOGLE_OAUTH_REFRESH_TOKEN=<Google OAuth refresh token>
GOOGLE_SHEETS_FOLDER_ID=<Google Drive folder id>
```

Pēc ENV saglabāšanas palaid Vercel **Redeploy**, lai servera funkcijas ielasa jaunos mainīgos. Ja izmanto service account fallback, Drive mapei jābūt kopīgotai ar service account e-pastu kā **Editor**; OAuth režīmā pietiek ar lietotāja piekļuvi. Admin sadaļā **Rādījumi** poga **Atjaunot Google Sheet** manuāli sinhronizē izvēlēto mēnesi; jaunie web/e-pasta iesniegumi sinhronizējas automātiski pēc saglabāšanas.

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
│       ├── page.tsx         # redirect → /admin/submissions
│       ├── submissions/     # iesniegtie rādījumi, CSV
│       ├── clients/
│       ├── meters/
│       ├── email/
│       ├── whatsapp/
│       ├── integrations/    # Resend
│       └── settings/
├── api/
│   ├── admin/               # settings, clients, meters, email/inbox, integrations, submissions/google-sheet (auth + CSRF)
│   ├── cron/
│   │   └── fetch-emails/    # GET — IMAP + imports (CRON_SECRET; ārējs scheduler)
│   └── public/
│       ├── lookup/          # GET — klienta meklēšana serverī
│       ├── submissions/     # POST — rādījumi (signed token, rate limit)
│       └── whatsapp/        # POST — rādījumi kā WhatsApp ziņa (signed token, rate limit)
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
    ├── utility/             # repository, google-sheets-sync, parse-meter-email, whatsapp-*, …
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

### v1.0.33

- **Drošības atjauninājumi** — `next` 16.4.6, `nodemailer` 10.6.0, `mailparser` 3.14.5, `zod` 4.6.7, `sharp` ≥ 0.35.5; overrides `deepmerge-ts`, `ip-address`, `nanoid` un `source-map-js`, lai produkcijas `npm audit` vairs nebloķētu high un critical

### v1.0.32

- **Telefona aģents** — AI Receptionist var pieņemt skaitītāju rādījumus zvanā: tas atrod klientu pēc numura un rādījumu saglabā tikai pēc apstiprinājuma
- **API sadaļa** — Iestatījumu apakšizvēlnē ir adrese un piekļuves atslēga ar kopēšanu, ieslēgšanu un jaunas atslēgas ģenerēšanu (migrācija `023`)

### v1.0.31

- **E-pasts un WhatsApp** — konta un kanāla iestatījumi ir savās sadaļās; kopējos iestatījumos paliek periods, tālruņi un FAQ teksts
- **Rādījumi** — pie CSV ir poga Sūtīt; tā pagaidām neko nesūta

### v1.0.30

- **Daļēja iesniegšana** — forma grupē skaitītājus pa adresēm un veidiem, rāda m³ un ļauj nodot tikai vēl neiesniegtos rādījumus
- **Admin rādījumi** — katrai izvēlnei ir savs URL, redzams iesniegto skaitītāju skaits, un CSV lejupielādē tikai šī mēneša iesniegtos rādījumus klienta tabulas kolonnās
- **Resend** — Iestatījumu apakšizvēlnē ir Integrācijas ar sūtītāja e-pastu un API atslēgu; ieslēgta tā sūta rādījumu paziņojumus

### v1.0.29

- **Klientu reģistrs** — klienta kods, kontakti, skaitītāja derīgums, objekta adrese, apkure un rādījumi ar 3 zīmēm aiz komata; publiskā meklēšana ir tikai pēc klienta koda
- **Rādījumu periods** — adminā var norādīt, ka rādījumus drīkst nodot tikai pēdējās X mēneša dienas; ārpus perioda forma un serveris iesniegšanu nepieņem
- **Admin** — saraksti rāda visus klientus un skaitītājus, kļūdas parādās toast, WhatsApp bloks ir tikai ar numuru, un e-pasts joslas labajā pusē saīsinās dinamiski

### v1.0.28

- **Drošības atjauninājumi** — `next` 16.2.12 (proxy bypass, SSRF, cache confusion, DoS labojumi), `mailparser` 3.9.14 (`linkify-it` DoS), `postcss` ≥ 8.5.18 (path traversal), `sharp` ≥ 0.35.0 (libvips CVE)
- **`gaxios` override ≥ 7.3.0** — `googleapis-common` pieprasa `gaxios` 7.1.3, kas caur `rimraf` → `glob` → `minimatch` ievelk ievainojamu `brace-expansion`; jaunākais `gaxios` šo ķēdi vairs nelieto
- **CI** — bloķējošais `npm audit` tagad pārbauda produkcijas atkarības (`--omit=dev`); pilnais audits paliek informatīvs, jo `brace-expansion` un `js-yaml` labojumi pārrauj ESLint `minimatch` ķēdi

### v1.0.27

- **WhatsApp Business** — admin iestatījumos jauns kanāls ar režīmiem `wa.me` saite vai Meta Cloud API, sūtītāja numura ID, write-only piekļuves tokens, paziņojumu numurs, veidne un rediģējams ziņas teksts; migrācija `018`
- **Rādījumu forma** — poga „Nosūtīt ar WhatsApp”: saites režīmā atver WhatsApp ar sagatavotu ziņu, API režīmā sūta caur `POST /api/public/whatsapp`
- **Paziņojumi** — pēc web iesnieguma WhatsApp ziņa tiek sūtīta paralēli e-pastam; adminā poga „Sūtīt testa ziņu” (`POST /api/admin/settings/whatsapp-test`)

### v1.0.26

- **Admin klienti** — labota jauna klienta izveide, kad `publicToken` bija tukša virkne un API validācija to noraidīja

### v1.0.25

- **Klienta rādījumu saite** — katram klientam unikāls `/r/{public_token}` URL ar to pašu rādījumu formu; admin klientu tabulā pogas atvērt saiti jaunā cilnē un kopēt to starpliktuvē; migrācija `017`
- **Public submit UX** — noņemts Google Sheet sinhronizācijas progress bloks no rādījumu formas; iesniegšanas laikā paliek tikai pogas loading stāvoklis

### v1.0.23

- **Public production fix** — `CSP` pielāgots tā, lai Next.js publiskās lapas hidrācija netiek nobloķēta; produkcijā atkal strādā klienta meklēšana, FAQ klikšķi un citas publiskās UI interakcijas

### v1.0.22

- **Admin FAQ teksts** — `/admin` iestatījumos pievienots rediģējams SMS/WhatsApp/e-pasta rādījumu paraugs no `contact_settings.reading_submission_template`; publiskais FAQ lieto šo vērtību
- **Performance** — `proxy.ts` darbojas tikai admin ceļiem, admin `GET` endpointi vairs nelādē pilnu state, un submissions mēneša skatam pievienota optimizēta DB indeksa migrācija `016`
- **Server/runtime** — publiskais submit pabeidz atbildi ātrāk, pārvietojot sekmīgo audit log un paziņojuma e-pastu ārpus kritiskā request ceļa; Google/IMAP route handleriem skaidri norādīts Node runtime

### v1.0.21

- **Public submit UX** — arī „Rādījumi jau iesniegti” blokā pievienots 5 sekunžu countdown un automātiska atgriešanās uz sākuma lapu

### v1.0.20

- **Public submit UX + Google Sheets** — rādījumu iesniegšanai pievienots skaidrs progress stāvoklis kritiskajai Google Sheet sinhronizācijai
- **Admin performance** — submissions ielāde ierobežota pa mēnešiem, e-pasta fetch/import sadalīts mazākos batch darbos, un public lookup saņem trigram indeksus
- **Drošība** — admin-bound CSRF tokens, production CSP bez inline skriptiem, strukturēti public submit audit eventi un atkārtoti atjaunots `security-check.md`

### v1.0.19

- **Google Sheets** — web rādījumu iesniegums tagad ir veiksmīgs tikai pēc Google Sheet atjaunošanas; ja sinhronizācija neizdodas, DB ieraksts tiek atcelts un kļūda ir redzama uzreiz

### v1.0.18

- **Google Sheets** — web iesniegumi sinhronizējas ar validēto klienta/skaitītāju snapshotu un automātiski mēģina vēlreiz pēc īslaicīgas Google API kļūmes

### v1.0.17

- **Google Sheets OAuth** — mēneša failu izveide ar lietotāja OAuth refresh token, lai faili nonāk lietotāja Drive kvotā/mapē; service account paliek kā fallback ar skaidru kvotas kļūdu
- **Setup** — production ENV dokumentēti `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` un Drive mapes prasības

### v1.0.16

- **Google Sheets** — automātiski mēneša Spreadsheet faili rādījumiem; viena rinda uz klientu, e-pasta merge atjaunina esošo rindu; admin poga manuāli atjauno izvēlēto mēnesi; migrācija `013`
- **Setup** — `googleapis`, Google service account ENV un `google_sheet_months` pārbaude Supabase testā

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
