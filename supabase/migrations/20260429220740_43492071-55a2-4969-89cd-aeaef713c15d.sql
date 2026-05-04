CREATE OR REPLACE FUNCTION public.ensure_default_funnel_stages(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    stage_count INTEGER;
BEGIN
    SELECT count(*) INTO stage_count FROM public.funnel_stages WHERE user_id = _user_id;

    IF stage_count = 0 THEN
        INSERT INTO public.funnel_stages (user_id, name, color, order_index)
        VALUES
            (_user_id, 'Novo Contato',        '#3B82F6', 1),
            (_user_id, 'Qualificando',        '#F59E0B', 2),
            (_user_id, 'Proposta Enviada',    '#8B5CF6', 3),
            (_user_id, 'Negociando',          '#EC4899', 4),
            (_user_id, 'Aguardando Pagamento','#06B6D4', 5),
            (_user_id, 'Concluído',           '#22C55E', 6),
            (_user_id, 'Não qualificado',     '#EF4444', 7);
    END IF;
END;
$function$;