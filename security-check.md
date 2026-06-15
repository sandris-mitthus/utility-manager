# Security audit — utility-manager

**Pašreizējā atzīme:** **8.5 / 10**  
**Pēdējā pilnā pārbaude:** 2026-06-14 (**v1.0.8**, H5/M7/M8/L8 labojumi)

---

## Ātrā pārskata tabula

| Kontrole | Rezultāts |
|----------|-----------|
| Admin API — `requireAdminRead` / `requireAdminWrite` + CSRF header | ✅ |
| CSRF admin mutācijām | ⚠️ `X-Utility-Manager-Request: 1` (statisks; ne sesijas tokens) |
| Supabase RLS (deny `anon` / `authenticated`) | ✅ + `readings_submissions`, `admin_audit_log` |
| Service role tikai serverī | ✅ |
| Publiskā lapa — klientu PII | ✅ Tikai kontakti SSR; lookup caur `GET /api/public/lookup` |
| Publiskie iesniegumi | ✅ Signed `submissionToken` (2h TTL) pēc lookup |
| E-pasta SMTP | ✅ `nodemailer` paziņojums pēc web iesniegšanas (ja konfigurēts) |
| Demo dati / in-memory seed | ✅ Noņemts no `app/` |
| Servera validācija (zod) | ✅ Visi API route faili |
| Rate limiting | ⚠️ In-process (viena instance) |
| HTTP drošības galvenes | ✅ CSP, HSTS, X-Frame-Options, u.c. |
| Edge auth `/api/admin` | ✅ `proxy.ts` agrīns 401 |
| Admin audit log | ✅ `admin_audit_log` |
| CI (push) | ✅ + CSRF, RLS 008, audit log, public lookup smoke |
| Dependabot | ✅ |
| `npm audit` (high+) | ✅ 0 vulnerabilities |

---

## Pašreizējā atzīme: 8.5 / 10

### Stiprās puses

- **Server-side publiskā meklēšana** — `GET /api/public/lookup?q=` atgriež tikai vienu klientu + skaitītājus.
- **Signed submission token** — `POST /api/public/submissions` prasa `submissionToken` no lookup (HMAC, 2h).
- **SMTP paziņojums** — pēc web iesniegšanas (ja `CONTACT_SMTP_HOST` + `CONTACT_EMAIL_PASSWORD`).
- **Admin API defense-in-depth** — edge 401 → sesija → `admin_users` → rate limit → CSRF → zod → audit log.
- **CI paplašināts** — CSRF guard, RLS 008, audit log, public page bez full DB bundle.

### Atlikušie trūkumi (kāpēc ne 10/10)

- **-0.5** — in-process rate limiter (multi-instance vajag Redis/Upstash).
- **-0.5** — service role kompromitācija = pilna DB kontrole (operatīva rotācija).
- **-0.5** — CSRF header statisks; neaizsargā pret same-origin XSS.

---

## Ieteikumi (statuss)

### HIGH

| # | Statuss | Problēma | Risinājums |
|---|---------|----------|------------|
| H1 | ✅ | `email_password` publiskajā lapā | `loadPublicContactSettings()` |
| H2 | ✅ | Plaintext parole DB | `008`; ENV |
| H3 | ✅ | CSRF admin API | `X-Utility-Manager-Request` |
| H4 | ✅ | `DEMO_SEED` bundlē | Demo noņemts |
| H5 | ✅ | Visi klientu dati client bundle | `GET /api/public/lookup` |

### MEDIUM

| # | Statuss | Problēma | Risinājums |
|---|---------|----------|------------|
| M1–M5 | ✅ | Validācija, CSP, headers, rate limit, edge | Ieviests |
| M6 | ℹ️ | Service role uz Vercel | Rotēt atslēgu pēc incidenta; sk. README |
| M7 | ✅ | Publiskie iesniegumi bez auth | Signed `submissionToken` |
| M8 | ✅ | `CONTACT_EMAIL_PASSWORD` neizmantots | `contact-email.ts` + nodemailer |

### LOW

| # | Statuss | Problēma | Risinājums |
|---|---------|----------|------------|
| L1–L7 | ✅ | googleapis, Dependabot, demo, OAuth, audit, seed, migrācijas | Ieviests |
| L8 | ✅ | CI neassertē CSRF/RLS 008 | `ci.yml` smoke job |

---

## API inventārs

| Route | Metodes | Auth | Zod | Rate limit | Audit |
|-------|---------|------|-----|------------|-------|
| `/api/public/lookup` | GET | — | query | ✅ | — |
| `/api/public/submissions` | POST | token | ✅ | ✅ | — |
| `/api/admin/*` | — | admin | ✅ | ✅ | mutācijas |

---

## ENV (SMTP)

| Mainīgais | Mērķis |
|-----------|--------|
| `CONTACT_SMTP_HOST` | SMTP serveris |
| `CONTACT_SMTP_PORT` | Ports (noklus. 587) |
| `CONTACT_SMTP_USER` | SMTP lietotājs (noklus. kontaktu e-pasts) |
| `CONTACT_EMAIL_PASSWORD` | SMTP parole |

---

## Ceļš uz 9–10 / 10

1. Sesijas saistīts CSRF tokens admin mutācijām.
2. Distributed rate limiting (Redis/Upstash).
3. Service role rotācija + alerting production vidē.

---

## Atsauces

| Joma | Ceļš |
|------|------|
| Lookup token | `app/lib/security/lookup-token.ts` |
| Public lookup | `app/api/public/lookup/route.ts` |
| SMTP | `app/lib/utility/contact-email.ts` |
| Publiskā lapa | `app/(protected)/page.tsx` |
| CI | `.github/workflows/ci.yml` |
