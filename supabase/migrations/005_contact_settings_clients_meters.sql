-- Utility Manager: contact settings, clients, meters

create table if not exists public.contact_settings (
  id smallint primary key default 1 check (id = 1),
  email text not null default '',
  email_password text not null default '',
  sms_number text not null default '',
  whatsapp_number text not null default '',
  phone_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists contact_settings_set_updated_at on public.contact_settings;
create trigger contact_settings_set_updated_at
  before update on public.contact_settings
  for each row execute function public.set_updated_at();

insert into public.contact_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.contact_settings enable row level security;

drop policy if exists "contact_settings deny client access" on public.contact_settings;
create policy "contact_settings deny client access"
on public.contact_settings
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_number text not null,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_client_number_unique unique (client_number)
);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

drop policy if exists "clients deny client access" on public.clients;
create policy "clients deny client access"
on public.clients
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create table if not exists public.meters (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  type text not null,
  verification_date date not null,
  client_id uuid references public.clients(id) on delete cascade,
  location text not null default '',
  previous_reading numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meters_number_unique unique (number),
  constraint meters_type_check check (type in ('hot_water', 'cold_water', 'sewage'))
);

drop trigger if exists meters_set_updated_at on public.meters;
create trigger meters_set_updated_at
  before update on public.meters
  for each row execute function public.set_updated_at();

create index if not exists meters_client_id_idx on public.meters (client_id);

alter table public.meters enable row level security;

drop policy if exists "meters deny client access" on public.meters;
create policy "meters deny client access"
on public.meters
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
