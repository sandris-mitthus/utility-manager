-- Seed demo clients, meters, and contact settings (idempotent)

insert into public.contact_settings (
  id,
  email,
  email_password,
  sms_number,
  whatsapp_number,
  phone_number
)
values (
  1,
  'radijumi@utility.lv',
  'demo-parole',
  '+371 2000 0001',
  '+371 2000 0002',
  '+371 6700 0000'
)
on conflict (id) do update set
  email = excluded.email,
  email_password = excluded.email_password,
  sms_number = excluded.sms_number,
  whatsapp_number = excluded.whatsapp_number,
  phone_number = excluded.phone_number;

insert into public.clients (id, client_number, address)
values
  ('a0000001-0000-4000-8000-000000000001', '12345', 'Brīvības iela 1, Rīga'),
  ('a0000001-0000-4000-8000-000000000002', '67890', 'Tallinas iela 5, Rīga'),
  ('a0000001-0000-4000-8000-000000000003', '11111', 'Elizabetes iela 10, Rīga')
on conflict (id) do update set
  client_number = excluded.client_number,
  address = excluded.address;

insert into public.meters (id, number, type, verification_date, client_id, location, previous_reading)
values
  ('b0000001-0000-4000-8000-000000000001', 'HW-1001', 'hot_water', '2025-03-15', 'a0000001-0000-4000-8000-000000000001', 'Virtuve', 120.5),
  ('b0000001-0000-4000-8000-000000000002', 'HW-1002', 'hot_water', '2025-03-15', 'a0000001-0000-4000-8000-000000000001', 'Vannas istaba', 89.2),
  ('b0000001-0000-4000-8000-000000000003', 'CW-2001', 'cold_water', '2024-11-20', 'a0000001-0000-4000-8000-000000000001', 'Virtuve', 45),
  ('b0000001-0000-4000-8000-000000000004', 'CW-2002', 'cold_water', '2024-11-20', 'a0000001-0000-4000-8000-000000000001', 'Vannas istaba', 32.1),
  ('b0000001-0000-4000-8000-000000000005', 'SW-3001', 'sewage', '2025-01-10', 'a0000001-0000-4000-8000-000000000001', 'Kopējā', 77),
  ('b0000001-0000-4000-8000-000000000006', 'HW-2001', 'hot_water', '2025-02-01', 'a0000001-0000-4000-8000-000000000002', 'Virtuve', 64.3),
  ('b0000001-0000-4000-8000-000000000007', 'CW-3001', 'cold_water', '2024-10-05', 'a0000001-0000-4000-8000-000000000002', 'Virtuve', 18.7),
  ('b0000001-0000-4000-8000-000000000008', 'SW-4001', 'sewage', '2025-01-10', 'a0000001-0000-4000-8000-000000000002', 'Sanmezgls', 41.2),
  ('b0000001-0000-4000-8000-000000000009', 'HW-3001', 'hot_water', '2025-04-12', 'a0000001-0000-4000-8000-000000000003', 'Virtuve', 55.8),
  ('b0000001-0000-4000-8000-000000000010', 'CW-4001', 'cold_water', '2024-12-18', 'a0000001-0000-4000-8000-000000000003', 'Vannas istaba', 22.4),
  ('b0000001-0000-4000-8000-000000000011', 'CW-4002', 'cold_water', '2024-12-18', 'a0000001-0000-4000-8000-000000000003', 'Virtuve', 11.9),
  ('b0000001-0000-4000-8000-000000000012', 'SW-5001', 'sewage', '2024-09-12', 'a0000001-0000-4000-8000-000000000003', 'Kopējā', 34.6)
on conflict (id) do update set
  number = excluded.number,
  type = excluded.type,
  verification_date = excluded.verification_date,
  client_id = excluded.client_id,
  location = excluded.location,
  previous_reading = excluded.previous_reading;
