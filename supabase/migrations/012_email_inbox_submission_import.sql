-- E-pasta ierakstu importa statuss uz readings_submissions

alter table public.email_inbox_messages
  add column if not exists submission_imported_at timestamptz,
  add column if not exists submission_month text
    check (submission_month is null or submission_month ~ '^\d{4}-\d{2}$'),
  add column if not exists submission_client_id uuid references public.clients(id) on delete set null,
  add column if not exists submission_import_error text not null default '';

create index if not exists email_inbox_messages_submission_imported_at_idx
  on public.email_inbox_messages (submission_imported_at desc nulls last);
