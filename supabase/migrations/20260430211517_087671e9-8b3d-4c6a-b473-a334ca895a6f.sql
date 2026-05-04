-- Índices para a tabela products
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_import_id ON public.products(import_id);

-- Índices para a tabela import_history
CREATE INDEX IF NOT EXISTS idx_import_history_user_id ON public.import_history(user_id);