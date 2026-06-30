-- Index public lookup paths so client search does not require full-table reads.

create extension if not exists pg_trgm with schema extensions;

create index if not exists clients_client_number_lookup_idx
  on public.clients (client_number);

create index if not exists clients_address_trgm_idx
  on public.clients
  using gin (address gin_trgm_ops);
