-- Migrate legacy admin_users (local password_hash) to Supabase Auth whitelist

alter table public.admin_users
  add column if not exists auth_user_id uuid;

alter table public.admin_users
  drop column if exists password_hash;

alter table public.admin_users
  drop column if exists is_active;

alter table public.admin_users
  drop column if exists updated_at;

create unique index if not exists admin_users_email_lower_idx
  on public.admin_users (lower(email));

alter table public.admin_users enable row level security;

drop policy if exists "admin_users deny client access" on public.admin_users;
create policy "admin_users deny client access"
on public.admin_users
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
