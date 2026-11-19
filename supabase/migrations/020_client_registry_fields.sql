-- Client registry fields from the meter export, 3-decimal readings, and heating meters.

alter table public.clients
  add column if not exists name text not null default '';

alter table public.clients
  add column if not exists email text not null default '';

alter table public.clients
  add column if not exists phone_extra text not null default '';

alter table public.clients
  add column if not exists extra_code text not null default '';

alter table public.meters
  add column if not exists type_code text not null default '';

alter table public.meters
  add column if not exists valid_until date;

alter table public.meters
  add column if not exists address text not null default '';

alter table public.meters
  add column if not exists reading_registered_on date;

alter table public.meters
  add column if not exists reading_period_end date;

alter table public.meters
  add column if not exists reading_record_number text not null default '';

alter table public.meters
  add column if not exists registry_key text;

alter table public.meters
  alter column verification_date drop not null;

alter table public.meters
  alter column previous_reading type numeric(14, 3);

alter table public.meters
  alter column baseline_reading type numeric(14, 3);

alter table public.meters drop constraint if exists meters_number_unique;

alter table public.meters drop constraint if exists meters_type_check;

alter table public.meters
  add constraint meters_type_check
  check (type in ('hot_water', 'cold_water', 'sewage', 'heating'));

create unique index if not exists meters_registry_key_unique_idx
  on public.meters (registry_key);

update public.contact_settings
set
  reading_submission_template = replace(reading_submission_template, 'Klienta numurs:', 'Klienta kods:'),
  whatsapp_message_template = replace(whatsapp_message_template, 'Klienta numurs:', 'Klienta kods:')
where id = 1;
