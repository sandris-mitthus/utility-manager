-- Submissions, audit log, remove email_password from contact_settings

create table if not exists public.readings_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  submitted_at timestamptz not null default now(),
  readings jsonb not null default '{}'::jsonb,
  unique (client_id, month)
);

create index if not exists readings_submissions_client_month_idx
  on public.readings_submissions (client_id, month desc);

alter table public.readings_submissions enable row level security;

drop policy if exists "readings_submissions deny client access" on public.readings_submissions;
create policy "readings_submissions deny client access"
on public.readings_submissions
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log deny client access" on public.admin_audit_log;
create policy "admin_audit_log deny client access"
on public.admin_audit_log
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

alter table public.contact_settings
  drop column if exists email_password;

update public.contact_settings
set email = coalesce(nullif(email, ''), 'radijumi@utility.lv')
where id = 1;
