-- Utility Manager: shared helpers + app settings singleton

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  app_name text not null default 'Utility Manager',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings deny client access" on public.app_settings;
create policy "app_settings deny client access"
on public.app_settings
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
