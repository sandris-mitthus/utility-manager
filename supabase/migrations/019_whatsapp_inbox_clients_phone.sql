-- WhatsApp inbound inbox + optional client phone for sender verification

alter table public.clients
  add column if not exists phone text not null default '';

create index if not exists clients_phone_idx
  on public.clients (phone)
  where phone <> '';

create table if not exists public.whatsapp_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text not null,
  from_wa_id text not null default '',
  from_profile_name text not null default '',
  body_text text not null default '',
  received_at timestamptz,
  parsed jsonb not null default '{}'::jsonb,
  parse_status text not null default 'pending'
    check (parse_status in ('pending', 'parsed', 'partial', 'failed')),
  fetched_at timestamptz not null default now(),
  submission_imported_at timestamptz,
  submission_month text
    check (submission_month is null or submission_month ~ '^\d{4}-\d{2}$'),
  submission_client_id uuid references public.clients(id) on delete set null,
  submission_import_error text not null default '',
  constraint whatsapp_inbox_messages_wa_message_id_unique unique (wa_message_id)
);

create index if not exists whatsapp_inbox_messages_fetched_at_idx
  on public.whatsapp_inbox_messages (fetched_at desc);

create index if not exists whatsapp_inbox_messages_received_at_idx
  on public.whatsapp_inbox_messages (received_at desc nulls last);

create index if not exists whatsapp_inbox_messages_submission_imported_at_idx
  on public.whatsapp_inbox_messages (submission_imported_at desc nulls last);

alter table public.whatsapp_inbox_messages enable row level security;

drop policy if exists "whatsapp_inbox_messages deny client access" on public.whatsapp_inbox_messages;
create policy "whatsapp_inbox_messages deny client access"
on public.whatsapp_inbox_messages
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
