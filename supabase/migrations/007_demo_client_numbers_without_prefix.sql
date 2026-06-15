-- Remove K- prefix from seeded demo client numbers

update public.clients
set client_number = '12345'
where id = 'a0000001-0000-4000-8000-000000000001'
  and client_number = 'K-12345';

update public.clients
set client_number = '67890'
where id = 'a0000001-0000-4000-8000-000000000002'
  and client_number = 'K-67890';

update public.clients
set client_number = '11111'
where id = 'a0000001-0000-4000-8000-000000000003'
  and client_number = 'K-11111';
