-- 2. Módulo Financeiro Ativo
CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    category TEXT,
    status TEXT CHECK (status IN ('paid', 'pending', 'cancelled')) DEFAULT 'pending',
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own transactions" ON public.finance_transactions
    FOR ALL USING (auth.uid() = user_id);

-- 3. Automações de Chatbot (Builder)
CREATE TABLE IF NOT EXISTS public.bot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    trigger_type TEXT DEFAULT 'keyword',
    trigger_value TEXT,
    nodes JSONB DEFAULT '[]'::jsonb, -- Armazena a estrutura drag-and-drop
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bot flows" ON public.bot_flows
    FOR ALL USING (auth.uid() = user_id);

-- 4. Gestão de Estoque
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 5,
    unit_price DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT CHECK (type IN ('in', 'out', 'adjustment')) NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage inventory items" ON public.inventory_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage inventory movements" ON public.inventory_movements FOR ALL USING (auth.uid() = user_id);

-- 5. Relatórios Avançados (Analytics)
-- Criamos uma view para facilitar o cálculo de métricas avançadas
CREATE OR REPLACE VIEW public.advanced_metrics AS
WITH sales_data AS (
    SELECT 
        user_id,
        count(id) as total_sales,
        sum(total_amount) as total_revenue,
        count(distinct customer_id) as unique_customers
    FROM public.sales_orders
    WHERE status = 'concluded'
    GROUP BY user_id
),
customer_lifetime AS (
    SELECT 
        user_id,
        avg(total_amount) as ltv
    FROM public.sales_orders
    WHERE status = 'concluded'
    GROUP BY user_id
)
SELECT 
    s.user_id,
    s.total_revenue,
    s.total_sales,
    s.unique_customers,
    c.ltv,
    (s.total_revenue / NULLIF(s.unique_customers, 0)) as arpu
FROM sales_data s
JOIN customer_lifetime c ON s.user_id = c.user_id;

-- Trigger para baixa automática de estoque ao concluir venda
CREATE OR REPLACE FUNCTION public.handle_sale_inventory()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'concluded' AND OLD.status != 'concluded' THEN
        -- Aqui viria a lógica de percorrer os itens do pedido e dar baixa
        -- Por simplicidade, vamos registrar que houve uma venda
        NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
