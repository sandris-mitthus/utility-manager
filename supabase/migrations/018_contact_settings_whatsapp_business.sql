-- WhatsApp Business channel for meter reading submissions.
-- contact_settings already has RLS with a deny policy for anon/authenticated (005).

alter table public.contact_settings
  add column if not exists whatsapp_mode text not null default 'off',
  add column if not exists whatsapp_phone_number_id text not null default '',
  add column if not exists whatsapp_access_token text not null default '',
  add column if not exists whatsapp_notify_number text not null default '',
  add column if not exists whatsapp_template_name text not null default '',
  add column if not exists whatsapp_template_language text not null default 'lv',
  add column if not exists whatsapp_message_template text;

alter table public.contact_settings
  alter column whatsapp_message_template set default 'Skaitītāju rādījumi
Klienta numurs: {client_number}
Adrese: {address}
Mēnesis: {month}
{readings}';

update public.contact_settings
set whatsapp_message_template = 'Skaitītāju rādījumi
Klienta numurs: {client_number}
Adrese: {address}
Mēnesis: {month}
{readings}'
where whatsapp_message_template is null
   or btrim(whatsapp_message_template) = '';

alter table public.contact_settings
  alter column whatsapp_message_template set not null;

update public.contact_settings
set whatsapp_mode = 'off'
where whatsapp_mode is null
   or whatsapp_mode not in ('off', 'link', 'api');

alter table public.contact_settings
  drop constraint if exists contact_settings_whatsapp_mode_check;

alter table public.contact_settings
  add constraint contact_settings_whatsapp_mode_check
  check (whatsapp_mode in ('off', 'link', 'api'));
