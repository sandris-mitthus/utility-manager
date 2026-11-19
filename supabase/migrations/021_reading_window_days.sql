-- How many last days of the month clients may submit meter readings.
-- 0 means the whole month is open.

alter table public.contact_settings
  add column if not exists reading_window_days smallint not null default 0;

alter table public.contact_settings
  drop constraint if exists contact_settings_reading_window_days_check;

alter table public.contact_settings
  add constraint contact_settings_reading_window_days_check
  check (reading_window_days between 0 and 31);
