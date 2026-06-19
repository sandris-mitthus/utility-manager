-- Google Sheets month file mapping for readings exports

create table if not exists public.google_sheet_months (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  spreadsheet_id text not null,
  spreadsheet_url text not null,
  sheet_title text not null default 'Rādījumi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_sheet_months enable row level security;

drop policy if exists "google_sheet_months deny client access" on public.google_sheet_months;
create policy "google_sheet_months deny client access"
on public.google_sheet_months
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
