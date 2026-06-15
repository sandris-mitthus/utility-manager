-- Utility Manager: administrator whitelist (invitations later via Resend)

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  auth_user_id uuid,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_users_email_unique unique (email)
);

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
