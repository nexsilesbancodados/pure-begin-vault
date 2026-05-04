-- Catálogo de serviços (separado dos service_orders, que são OS de assistência técnica)
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  price numeric DEFAULT 0,
  duration_minutes integer,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  keywords text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own services"
ON public.services FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Bucket de imagens para catálogo (produtos e serviços)
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog', 'catalog', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas: público lê, usuário autenticado escreve em sua própria pasta
CREATE POLICY "Catalog images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'catalog');

CREATE POLICY "Users upload to their catalog folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'catalog' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update their catalog files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'catalog' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete their catalog files"
ON storage.objects FOR DELETE
USING (bucket_id = 'catalog' AND auth.uid()::text = (storage.foldername(name))[1]);