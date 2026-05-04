CREATE TABLE public.chart_of_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT CHECK (type IN ('revenue', 'expense', 'asset', 'liability')),
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own chart of accounts" 
ON public.chart_of_accounts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chart of accounts" 
ON public.chart_of_accounts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chart of accounts" 
ON public.chart_of_accounts FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chart of accounts" 
ON public.chart_of_accounts FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at
BEFORE UPDATE ON public.chart_of_accounts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
