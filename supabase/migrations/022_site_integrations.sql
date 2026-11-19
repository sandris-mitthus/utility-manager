-- Admin-managed integrations. Secrets stay server-side; clients cannot read the table.

create table if not exists public.site_integrations (
  integration_key text primary key,
  client_id text not null default '',
  client_secret text not null default '',
  is_configured boolean not null default false,
  is_enabled boolean not null default false,
  configured_account_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_integrations_key_check check (integration_key ~ '^[a-z0-9_]+$')
);

drop trigger if exists site_integrations_set_updated_at on public.site_integrations;
create trigger site_integrations_set_updated_at
  before update on public.site_integrations
  for each row execute function public.set_updated_at();

insert into public.site_integrations (integration_key)
values ('resend')
on conflict (integration_key) do nothing;

alter table public.site_integrations enable row level security;

drop policy if exists "site_integrations deny client access" on public.site_integrations;
create policy "site_integrations deny client access"
on public.site_integrations
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
