-- Create crm_pipelines table
CREATE TABLE public.crm_pipelines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for crm_pipelines
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

-- Policies for crm_pipelines
CREATE POLICY "Users can manage their own pipelines"
ON public.crm_pipelines
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create crm_pipeline_stages table
CREATE TABLE public.crm_pipeline_stages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for crm_pipeline_stages
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Policies for crm_pipeline_stages
CREATE POLICY "Users can manage their own pipeline stages"
ON public.crm_pipeline_stages
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.crm_pipelines
        WHERE crm_pipelines.id = pipeline_id
        AND crm_pipelines.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.crm_pipelines
        WHERE crm_pipelines.id = pipeline_id
        AND crm_pipelines.user_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_pipelines_updated_at
BEFORE UPDATE ON public.crm_pipelines
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_crm_pipeline_stages_updated_at
BEFORE UPDATE ON public.crm_pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Alter pipeline_leads to reference crm_pipeline_stages (optional, but good for data integrity)
-- Note: funnel_stages is already used in pipeline_leads. 
-- For now, let's just create the tables and allow the UI to manage multiple pipelines.
