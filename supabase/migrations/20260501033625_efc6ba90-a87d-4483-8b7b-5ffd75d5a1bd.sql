-- Tabela de metas de negócio
CREATE TABLE IF NOT EXISTS public.business_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal DECIMAL(12,2) DEFAULT 0,
  weekly_goal DECIMAL(12,2) DEFAULT 0,
  monthly_goal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.business_goals ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own goals" ON public.business_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals" ON public.business_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" ON public.business_goals
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger para updated_at (usando handle_updated_at que já existe)
CREATE TRIGGER update_business_goals_updated_at
BEFORE UPDATE ON public.business_goals
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();