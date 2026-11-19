-- Access key for the phone agent that takes meter readings. Kept server-side in site_integrations.

insert into public.site_integrations (integration_key, client_secret, is_configured, is_enabled)
values (
  'voice_agent',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  true,
  true
)
on conflict (integration_key) do nothing;
