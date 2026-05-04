ALTER TABLE public.bot_conversations 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bot_conversations_tags ON public.bot_conversations USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_assigned_to ON public.bot_conversations(assigned_to);