-- Remove legacy updated_at trigger from admin_users

drop trigger if exists admin_users_set_updated_at on public.admin_users;
