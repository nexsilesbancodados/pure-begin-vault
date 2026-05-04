-- Garantir que a função handle_updated_at tenha search_path definido
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- Restringir permissão de execução de funções internas para segurança
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;

-- Criar índices de performance para consultas filtradas por organização
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_organization_id ON public.employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_organization_id ON public.sales_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_organization_id ON public.bot_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_goals_organization_id ON public.business_goals(organization_id);

-- Configuração de Storage para Avatares (Opcional, mas útil para perfis)
-- Nota: A criação de buckets via SQL pode exigir permissões específicas, 
-- mas deixamos as políticas preparadas para quando o bucket 'avatars' for criado.

CREATE POLICY "Avatares públicos" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Usuários podem subir seus próprios avatares" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
