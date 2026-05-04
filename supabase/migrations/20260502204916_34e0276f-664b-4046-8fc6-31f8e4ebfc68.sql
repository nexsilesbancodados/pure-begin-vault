-- Primeiro, garantimos que o perfil existe para o ID do auth.users correspondente
INSERT INTO public.profiles (id, email, display_name, role)
VALUES ('70815c35-c265-4962-ace1-bcc68ca595d4', 'alfatech791@gmail.com', 'Admin AlfaTech', 'super_admin')
ON CONFLICT (id) DO UPDATE 
SET role = 'super_admin', 
    display_name = COALESCE(public.profiles.display_name, 'Admin AlfaTech'),
    email = 'alfatech791@gmail.com';
