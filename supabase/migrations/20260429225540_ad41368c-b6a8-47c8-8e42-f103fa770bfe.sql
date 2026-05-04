-- =========================================================
-- 1. Função que cria o pacote padrão de automações por usuário
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_default_automations(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  -- 1. Boas-vindas no primeiro contato
  INSERT INTO public.automations (user_id, name, trigger_type, action_type, is_active, config)
  SELECT _user_id, 'Boas-vindas no 1º contato', 'message_received', 'send_message', true,
    jsonb_build_object(
      'condition', jsonb_build_object('first_message_only', true),
      'message', 'Olá {{nome}}! 👋 Obrigado por entrar em contato. Em que posso te ajudar hoje?',
      'also_create_task', true,
      'task_title', 'Qualificar novo lead',
      'task_priority', 'high'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automations
    WHERE user_id = _user_id AND name = 'Boas-vindas no 1º contato'
  );

  -- 2. Auto-resposta fora do horário comercial
  INSERT INTO public.automations (user_id, name, trigger_type, action_type, is_active, config)
  SELECT _user_id, 'Resposta fora do horário', 'message_received', 'send_message', true,
    jsonb_build_object(
      'condition', jsonb_build_object('outside_business_hours', true, 'start', '08:00', 'end', '18:00'),
      'message', 'Olá {{nome}}! Recebemos sua mensagem fora do horário de atendimento (08h-18h). Retornaremos assim que possível. 🙏'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automations
    WHERE user_id = _user_id AND name = 'Resposta fora do horário'
  );

  -- 3. Palavras-chave de compra → mover para Qualificando + tarefa
  INSERT INTO public.automations (user_id, name, trigger_type, action_type, is_active, config)
  SELECT _user_id, 'Interesse de compra detectado', 'message_received', 'move_pipeline', true,
    jsonb_build_object(
      'condition', jsonb_build_object('keywords', ARRAY['preço','preco','valor','comprar','quanto custa','quanto é','quero','tem disponível']),
      'target_stage_name', 'Qualificando',
      'also_send_message', true,
      'message', 'Que ótimo {{nome}}! Vou te enviar todos os detalhes agora mesmo. 🚀',
      'also_create_task', true,
      'task_title', 'Enviar proposta para {{nome}}',
      'task_priority', 'high'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automations
    WHERE user_id = _user_id AND name = 'Interesse de compra detectado'
  );

  -- 4. Objeções → criar tarefa
  INSERT INTO public.automations (user_id, name, trigger_type, action_type, is_active, config)
  SELECT _user_id, 'Objeção detectada', 'message_received', 'create_task', true,
    jsonb_build_object(
      'condition', jsonb_build_object('keywords', ARRAY['caro','muito caro','depois','vou pensar','pensar melhor','sem dinheiro','não tenho','nao tenho','tá caro']),
      'task_title', 'Contornar objeção - {{nome}}',
      'task_priority', 'high',
      'task_description', 'Cliente demonstrou objeção. Última mensagem: {{mensagem}}'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automations
    WHERE user_id = _user_id AND name = 'Objeção detectada'
  );

  -- 5. Pedido de atendente humano → notificar time
  INSERT INTO public.automations (user_id, name, trigger_type, action_type, is_active, config)
  SELECT _user_id, 'Pedido de atendente humano', 'message_received', 'notify_team', true,
    jsonb_build_object(
      'condition', jsonb_build_object('keywords', ARRAY['humano','atendente','pessoa','falar com alguém','falar com alguem','gerente','responsável','responsavel']),
      'also_create_task', true,
      'task_title', '🚨 URGENTE: {{nome}} pediu atendente humano',
      'task_priority', 'high',
      'also_send_message', true,
      'message', 'Entendido {{nome}}! Já estou chamando um atendente humano para você. Aguarde só um momento. 🙋'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automations
    WHERE user_id = _user_id AND name = 'Pedido de atendente humano'
  );

  -- 6. Confirmação de pagamento
  INSERT INTO public.automations (user_id, name, trigger_type, action_type, is_active, config)
  SELECT _user_id, 'Pagamento informado pelo cliente', 'message_received', 'move_pipeline', true,
    jsonb_build_object(
      'condition', jsonb_build_object('keywords', ARRAY['paguei','pago','comprovante','pix enviado','transferi','transferido','pix feito']),
      'target_stage_name', 'Aguardando Pagamento',
      'also_send_message', true,
      'message', 'Perfeito {{nome}}! Já estou conferindo seu pagamento. Em instantes te confirmo. ✅',
      'also_create_task', true,
      'task_title', 'Confirmar pagamento de {{nome}}',
      'task_priority', 'high'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automations
    WHERE user_id = _user_id AND name = 'Pagamento informado pelo cliente'
  );

  -- 7. Follow-up sem resposta 24h
  INSERT INTO public.automations (user_id, name, trigger_type, action_type, is_active, config)
  SELECT _user_id, 'Follow-up 24h sem resposta', 'no_reply_24h', 'send_message', true,
    jsonb_build_object(
      'message', 'Oi {{nome}}, tudo bem? Vi que ficamos sem conversar. Posso te ajudar com mais alguma coisa? 😊',
      'also_create_task', true,
      'task_title', 'Reengajar lead {{nome}}',
      'task_priority', 'medium'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automations
    WHERE user_id = _user_id AND name = 'Follow-up 24h sem resposta'
  );

  -- 8. Pós-venda (quando movido para Concluído)
  INSERT INTO public.automations (user_id, name, trigger_type, action_type, is_active, config)
  SELECT _user_id, 'Agradecimento pós-venda', 'stage_changed', 'send_message', true,
    jsonb_build_object(
      'condition', jsonb_build_object('target_stage_name', 'Concluído'),
      'message', 'Muito obrigado pela confiança {{nome}}! 🎉 Foi um prazer atender você. Qualquer coisa, estou por aqui!',
      'also_create_task', true,
      'task_title', 'Pesquisa NPS - {{nome}} (7 dias)',
      'task_priority', 'low'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automations
    WHERE user_id = _user_id AND name = 'Agradecimento pós-venda'
  );
END;
$$;

-- =========================================================
-- 2. Aplicar para todos os usuários existentes
-- =========================================================
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT DISTINCT id FROM auth.users LOOP
    PERFORM public.seed_default_automations(u.id);
  END LOOP;
END $$;

-- =========================================================
-- 3. Trigger para auto-criar pacote em novos usuários
-- =========================================================
CREATE OR REPLACE FUNCTION public.on_new_user_seed_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_automations(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_automations_on_new_user ON auth.users;
CREATE TRIGGER trg_seed_automations_on_new_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.on_new_user_seed_automations();