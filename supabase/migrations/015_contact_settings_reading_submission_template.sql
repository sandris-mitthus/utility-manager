-- Admin-managed FAQ reading submission template

alter table public.contact_settings
  add column if not exists reading_submission_template text,
  alter column reading_submission_template set default 'Klienta numurs: KLIENTA NUMURS
Aukstais ūdens: AUKSTA ŪDENS RĀDĪJUMI
Karstais ūdens: KARSTA ŪDENS RĀDĪJUMI
Kanalizācija: KANALIZĀCIJAS RĀDĪJUMI';

update public.contact_settings
set reading_submission_template = 'Klienta numurs: KLIENTA NUMURS
Aukstais ūdens: AUKSTA ŪDENS RĀDĪJUMI
Karstais ūdens: KARSTA ŪDENS RĀDĪJUMI
Kanalizācija: KANALIZĀCIJAS RĀDĪJUMI'
where reading_submission_template is null
   or btrim(reading_submission_template) = '';

alter table public.contact_settings
  alter column reading_submission_template set not null;
