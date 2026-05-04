-- Primeiro, vamos garantir que temos os tipos de roles corretos
-- Roles: 
-- 'super_admin': Lovable/Desenvolvedor (gerencia tudo)
-- 'owner': Quem compra o app (dono da conta)
-- 'admin': Administrador da conta (gerenciado pelo owner)
-- 'financeiro': Acesso financeiro (gerenciado pelo owner/admin)
-- 'vendedor': Acesso de vendas (gerenciado pelo owner/admin)
-- 'employee': Funcionário geral

-- Adicionar coluna owner_id para perfis para vincular funcionários a um dono de conta
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Atualizar restrições de role (se necessário, mas vamos usar check constraint)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'owner', 'admin', 'financeiro', 'vendedor', 'employee', 'user'));

-- Criar função para verificar se o usuário é super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'super_admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para verificar se o usuário é owner ou admin da conta
CREATE OR REPLACE FUNCTION public.is_account_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role IN ('super_admin', 'owner', 'admin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que tabelas críticas tenham owner_id para isolamento
-- Sales orders
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_orders' AND column_name='owner_id') THEN
    ALTER TABLE public.sales_orders ADD COLUMN owner_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Products
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='owner_id') THEN
    ALTER TABLE public.products ADD COLUMN owner_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Finance transactions
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_transactions' AND column_name='owner_id') THEN
    ALTER TABLE public.finance_transactions ADD COLUMN owner_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Atualizar RLS para considerar a hierarquia
-- Exemplo para Profiles: 
-- Super admin vê tudo.
-- Owner vê seus funcionários.
-- Funcionário vê a si mesmo.

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles access policy" ON public.profiles
FOR SELECT USING (
  id = auth.uid() OR 
  owner_id = auth.uid() OR 
  (SELECT owner_id FROM public.profiles WHERE id = auth.uid()) = owner_id OR
  is_super_admin()
);

-- Políticas para Financeiro (apenas owner, admin e financeiro)
DROP POLICY IF EXISTS "Finance access policy" ON public.finance_transactions;
CREATE POLICY "Finance access policy" ON public.finance_transactions
FOR ALL USING (
  is_super_admin() OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin', 'financeiro')
);
