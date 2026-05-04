-- Criar tabela de organizações (tenants)
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em organizações
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Adicionar organization_id em perfis
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Criar tabela de funcionários
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  position TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em funcionários
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Políticas para Organizations
CREATE POLICY "Owners can view their own organization"
ON public.organizations FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own organization"
ON public.organizations FOR UPDATE
USING (auth.uid() = owner_id);

-- Políticas para Employees (Isolamento por organização)
CREATE POLICY "Users can view employees of their organization"
ON public.employees FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = employees.organization_id
  )
);

CREATE POLICY "Users can manage employees of their organization"
ON public.employees FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = employees.organization_id
  )
);

-- Atualizar gatilho de novo usuário para incluir organização (opcional no início)
-- Aqui assumimos que a organização será criada posteriormente via UI.

-- Trigger para updated_at nas novas tabelas
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();