-- Inbound email inbox for meter reading collection (IMAP)

create table if not exists public.email_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  imap_uid bigint not null,
  message_id text,
  from_address text not null default '',
  subject text not null default '',
  body_text text not null default '',
  received_at timestamptz,
  parsed jsonb not null default '{}'::jsonb,
  parse_status text not null default 'pending'
    check (parse_status in ('pending', 'parsed', 'partial', 'failed')),
  fetched_at timestamptz not null default now(),
  constraint email_inbox_messages_imap_uid_unique unique (imap_uid)
);

create unique index if not exists email_inbox_messages_message_id_unique_idx
  on public.email_inbox_messages (message_id)
  where message_id is not null and message_id <> '';

create index if not exists email_inbox_messages_fetched_at_idx
  on public.email_inbox_messages (fetched_at desc);

create index if not exists email_inbox_messages_received_at_idx
  on public.email_inbox_messages (received_at desc nulls last);

alter table public.email_inbox_messages enable row level security;

drop policy if exists "email_inbox_messages deny client access" on public.email_inbox_messages;
create policy "email_inbox_messages deny client access"
on public.email_inbox_messages
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create table if not exists public.email_fetch_state (
  id int primary key default 1 check (id = 1),
  last_imap_uid bigint not null default 0,
  last_fetch_at timestamptz,
  last_fetch_status text not null default 'never',
  last_error text not null default ''
);

insert into public.email_fetch_state (id)
values (1)
on conflict (id) do nothing;

alter table public.email_fetch_state enable row level security;

drop policy if exists "email_fetch_state deny client access" on public.email_fetch_state;
create policy "email_fetch_state deny client access"
on public.email_fetch_state
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
