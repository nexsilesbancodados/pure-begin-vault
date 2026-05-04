-- Since we added the email column, but it might be NULL for existing profiles,
-- and we don't know the exact display_name, let's just make sure the user is admin.
-- If the user signs up with this email, the trigger (if any) or manual update will work.

UPDATE public.profiles SET role = 'super_admin' WHERE email = 'alfatech791@gmail.com';

-- Just in case display_name was used as email before
UPDATE public.profiles SET role = 'super_admin' WHERE display_name = 'alfatech791@gmail.com';
