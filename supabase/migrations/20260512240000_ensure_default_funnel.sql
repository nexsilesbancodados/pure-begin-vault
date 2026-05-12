-- Cria etapas padrão do funil se a org/user ainda não tiver nenhuma.
-- Chamada pelo CRM hub no mount (crm.tsx).

CREATE OR REPLACE FUNCTION public.ensure_default_funnel_stages(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_count integer;
BEGIN
  -- Pega org do user
  SELECT organization_id INTO v_org_id
  FROM profiles
  WHERE id = _user_id;

  IF v_org_id IS NULL THEN
    RETURN; -- sem org, não cria nada
  END IF;

  -- Já tem etapas?
  SELECT COUNT(*) INTO v_count
  FROM funnel_stages
  WHERE organization_id = v_org_id;

  IF v_count > 0 THEN
    RETURN;
  END IF;

  -- Cria as 5 etapas padrão
  INSERT INTO funnel_stages (organization_id, user_id, name, color, order_index)
  VALUES
    (v_org_id, _user_id, 'Novo Contato',   '#3B82F6', 0),
    (v_org_id, _user_id, 'Qualificação',   '#8B5CF6', 1),
    (v_org_id, _user_id, 'Proposta',       '#F59E0B', 2),
    (v_org_id, _user_id, 'Negociação',     '#EC4899', 3),
    (v_org_id, _user_id, 'Ganho',          '#10B981', 4),
    (v_org_id, _user_id, 'Perdido',        '#EF4444', 5);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_funnel_stages(uuid) TO authenticated;
