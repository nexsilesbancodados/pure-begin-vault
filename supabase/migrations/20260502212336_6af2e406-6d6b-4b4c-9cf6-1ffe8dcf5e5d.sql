-- Tabela para gerenciar convites de membros da equipe
CREATE TABLE IF NOT EXISTS public.team_invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Quem convidou (Dono da conta/Admin)
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'gerente', 'vendedor')),
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários podem ver seus próprios convites enviados"
ON public.team_invitations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar convites para sua equipe"
ON public.team_invitations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios convites"
ON public.team_invitations
FOR DELETE
USING (auth.uid() = user_id);

-- Índice para busca rápida de token
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(token);
