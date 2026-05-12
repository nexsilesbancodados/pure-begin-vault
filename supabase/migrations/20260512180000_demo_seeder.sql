-- RPC seed_demo_data: cria produtos/clientes/leads de exemplo pra org do user.
-- Idempotente — se já tem >= 5 produtos, não duplica.

CREATE OR REPLACE FUNCTION public.seed_demo_data() RETURNS jsonb AS $$
DECLARE
  org_id uuid;
  uid uuid := auth.uid();
  existing_products int;
  prods_created int := 0;
  customers_created int := 0;
  leads_created int := 0;
BEGIN
  -- pega org ativa do user
  SELECT organization_id INTO org_id FROM profiles WHERE id = uid;
  IF org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_organization');
  END IF;

  SELECT COUNT(*) INTO existing_products FROM products WHERE organization_id = org_id;

  IF existing_products < 5 THEN
    INSERT INTO products (organization_id, user_id, name, category, price, stock_quantity, brand, description, active)
    VALUES
      (org_id, uid, 'iPhone 15 Pro 256GB Natural', 'Smartphone', 8499.00, 3, 'Apple', 'iPhone 15 Pro · 256GB · Tela 6.1" Super Retina XDR', true),
      (org_id, uid, 'iPhone 14 128GB Azul', 'Smartphone', 5299.00, 5, 'Apple', 'iPhone 14 · 128GB · Câmera dupla 12MP', true),
      (org_id, uid, 'Samsung Galaxy S24 Ultra 512GB', 'Smartphone', 9299.00, 2, 'Samsung', 'Galaxy S24 Ultra · S Pen · 200MP', true),
      (org_id, uid, 'Galaxy A55 256GB Preto', 'Smartphone', 2599.00, 8, 'Samsung', 'A55 · 5G · 256GB · 8GB RAM', true),
      (org_id, uid, 'Xiaomi Redmi Note 13 Pro', 'Smartphone', 1899.00, 12, 'Xiaomi', 'Redmi Note 13 Pro · 256GB · 200MP', true),
      (org_id, uid, 'AirPods Pro 2ª geração', 'Acessório', 1799.00, 6, 'Apple', 'AirPods Pro · Cancelamento ativo de ruído', true),
      (org_id, uid, 'Carregador USB-C 20W', 'Acessório', 89.00, 30, 'Genérica', 'Compatível iPhone 15 e Android', true),
      (org_id, uid, 'Película de vidro iPhone 15', 'Película', 49.00, 50, 'Premium', 'Película 3D · Cobertura total', true),
      (org_id, uid, 'Capa Silicone iPhone 14 Preta', 'Capa', 79.00, 25, 'Premium', 'Capa em silicone · TPU resistente', true),
      (org_id, uid, 'Cabo USB-C 1m Original', 'Cabo', 119.00, 40, 'Apple', 'Cabo USB-C de carregamento · 1 metro', true);
    GET DIAGNOSTICS prods_created = ROW_COUNT;
  END IF;

  -- Clientes demo (só se tiver < 3)
  IF (SELECT COUNT(*) FROM customers WHERE organization_id = org_id) < 3 THEN
    INSERT INTO customers (organization_id, user_id, name, phone, email)
    VALUES
      (org_id, uid, 'Maria Silva (DEMO)', '(11) 98765-4321', 'maria.demo@example.com'),
      (org_id, uid, 'João Pereira (DEMO)', '(21) 99876-5432', 'joao.demo@example.com'),
      (org_id, uid, 'Ana Costa (DEMO)', '(31) 98123-4567', 'ana.demo@example.com'),
      (org_id, uid, 'Carlos Mendes (DEMO)', '(85) 99234-5678', 'carlos.demo@example.com');
    GET DIAGNOSTICS customers_created = ROW_COUNT;
  END IF;

  -- Leads demo (só se tiver < 3)
  BEGIN
    IF (SELECT COUNT(*) FROM leads WHERE organization_id = org_id) < 3 THEN
      INSERT INTO leads (organization_id, user_id, name, phone, source, status)
      VALUES
        (org_id, uid, 'Lucas (interessado iPhone 15)', '(11) 91234-5678', 'WhatsApp', 'novo'),
        (org_id, uid, 'Patricia (orçamento tela)', '(11) 92345-6789', 'Instagram', 'em_atendimento'),
        (org_id, uid, 'Roberto (troca de aparelho)', '(11) 93456-7890', 'Indicação', 'proposta');
      GET DIAGNOSTICS leads_created = ROW_COUNT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'products', prods_created,
    'customers', customers_created,
    'leads', leads_created
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO authenticated;

-- RPC clear_demo_data: remove tudo com "(DEMO)" no nome
CREATE OR REPLACE FUNCTION public.clear_demo_data() RETURNS jsonb AS $$
DECLARE
  org_id uuid;
  prods_removed int := 0;
  cust_removed int := 0;
BEGIN
  SELECT organization_id INTO org_id FROM profiles WHERE id = auth.uid();
  IF org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_organization');
  END IF;

  DELETE FROM customers WHERE organization_id = org_id AND name LIKE '%(DEMO)%';
  GET DIAGNOSTICS cust_removed = ROW_COUNT;

  RETURN jsonb_build_object('customers_removed', cust_removed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.clear_demo_data() TO authenticated;
