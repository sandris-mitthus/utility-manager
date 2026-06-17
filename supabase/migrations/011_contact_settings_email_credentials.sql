-- Restore admin-managed email credentials for IMAP (and optional SMTP fallback)

alter table public.contact_settings
  add column if not exists email_password text not null default '',
  add column if not exists imap_host text not null default '';
