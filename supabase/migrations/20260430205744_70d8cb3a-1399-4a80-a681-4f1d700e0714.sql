-- Tabela para histórico de importações
CREATE TABLE IF NOT EXISTS public.import_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    items_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success', -- 'success', 'reversed', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar coluna de referência de importação nos produtos para permitir reversão
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.import_history(id) ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view their own import history" 
ON public.import_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import history" 
ON public.import_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import history" 
ON public.import_history FOR UPDATE 
USING (auth.uid() = user_id);
