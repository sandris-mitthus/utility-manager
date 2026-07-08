-- Per-client opaque token for direct reading submission links (/r/{token})

alter table public.clients
  add column if not exists public_token text;

update public.clients
set public_token = gen_random_uuid()::text
where public_token is null;

alter table public.clients
  alter column public_token set not null;

alter table public.clients
  alter column public_token set default gen_random_uuid()::text;

create unique index if not exists clients_public_token_unique_idx
  on public.clients (public_token);
