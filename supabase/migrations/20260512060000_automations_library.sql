-- Sistema completo de automações: templates pré-prontos + agendamento diário
-- Templates ficam disponíveis pra qualquer org instalar/customizar.

create table if not exists public.automation_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- transactional|operational|marketing|engagement
  trigger_type text not null,
  channel text not null, -- whatsapp|email|both|internal
  name text not null,
  description text,
  default_subject text,
  default_body text not null,
  default_delay_minutes int default 0,
  variables text[] default '{}'::text[],
  recommended boolean default true,
  active_by_default boolean default false,
  created_at timestamptz default now()
);

create index if not exists automation_templates_trigger_idx on public.automation_templates (trigger_type);

-- Instâncias da automação por org (ativa/desativa + customiza)
create table if not exists public.automation_installs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  template_id uuid references public.automation_templates(id),
  trigger_type text not null,
  channel text not null,
  subject text,
  body text not null,
  delay_minutes int default 0,
  is_active boolean default true,
  conditions jsonb default '{}'::jsonb, -- filtros adicionais
  last_run_at timestamptz,
  total_runs int default 0,
  total_failures int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists automation_installs_org_trigger_idx
  on public.automation_installs (organization_id, trigger_type, is_active);

alter table public.automation_installs enable row level security;

drop policy if exists "automation_installs select own" on public.automation_installs;
create policy "automation_installs select own" on public.automation_installs
  for select using (
    organization_id in (
      select organization_id from public.user_organizations where user_id = auth.uid()
    )
  );

drop policy if exists "automation_installs cud own" on public.automation_installs;
create policy "automation_installs cud own" on public.automation_installs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Log de execuções (extra detalhes além do automation_runs existente)
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  install_id uuid references public.automation_installs(id) on delete cascade,
  organization_id uuid not null,
  trigger_type text not null,
  channel text not null,
  target_phone text,
  target_email text,
  rendered_body text,
  status text not null default 'pending', -- pending|sent|failed|skipped
  error text,
  ran_at timestamptz default now()
);

create index if not exists automation_logs_install_idx on public.automation_logs (install_id, ran_at desc);
create index if not exists automation_logs_org_idx on public.automation_logs (organization_id, ran_at desc);

alter table public.automation_logs enable row level security;

drop policy if exists "automation_logs select org" on public.automation_logs;
create policy "automation_logs select org" on public.automation_logs
  for select using (
    organization_id in (
      select organization_id from public.user_organizations where user_id = auth.uid()
    )
  );

------------------------------------------------------------
-- SEED: 25+ templates prontos pra loja de celular
------------------------------------------------------------
insert into public.automation_templates (category, trigger_type, channel, name, description, default_subject, default_body, default_delay_minutes, variables, recommended, active_by_default)
values
  -- Transactional (relacionamento user/SaaS)
  ('transactional', 'user.signup', 'email', 'Boas-vindas',
    'Email enviado quando user faz primeiro cadastro.',
    'Bem-vindo ao ConectaCRM, {{nome}}!',
    'Oi {{nome}}, bem-vindo! Sua conta foi criada. Próximo passo: conectar seu WhatsApp em Configurações.', 0,
    '{nome,email}', true, true),

  ('transactional', 'user.signup', 'whatsapp', 'Boas-vindas WhatsApp',
    'Mensagem WhatsApp opcional pós-cadastro.',
    null,
    'Oi {{nome}}! Conta criada no ConectaCRM ✅. Qualquer dúvida, responde aqui.', 5,
    '{nome}', true, false),

  ('transactional', 'subscription.payment_received', 'email', 'Pagamento confirmado',
    'Após webhook MP confirmar pagamento.',
    'Pagamento confirmado · {{plano}}',
    'Pagamento de R$ {{valor}} recebido. Sua assinatura {{plano}} está ativa até {{validade}}.', 0,
    '{plano,valor,validade}', true, true),

  ('transactional', 'subscription.payment_failed', 'email', 'Pagamento falhou',
    'Cartão recusado.',
    'Atenção: pagamento não aprovado',
    'Não conseguimos cobrar sua assinatura. Atualize o cartão em /minha-conta antes de {{prazo}}.', 0,
    '{prazo}', true, true),

  ('transactional', 'subscription.trial_ending_soon', 'email', 'Trial acabando',
    '3 dias antes do trial expirar.',
    'Seu trial acaba em 3 dias',
    'Olá {{nome}}, seu período gratuito termina em {{prazo}}. Garanta acesso contínuo escolhendo um plano.', 0,
    '{nome,prazo}', true, true),

  -- Operacional (cliente do lojista)
  ('operational', 'os.received', 'whatsapp', 'OS recebida',
    'Cliente entregou aparelho na loja.',
    null,
    'Oi {{cliente_nome}}! Recebemos seu {{equipamento}}. OS #{{os_numero}} aberta. Acompanhe em {{link_os}}.', 0,
    '{cliente_nome,equipamento,os_numero,link_os}', true, true),

  ('operational', 'os.in_diagnosis', 'whatsapp', 'Em diagnóstico',
    'Status mudou pra "em diagnóstico".',
    null,
    'Oi {{cliente_nome}}, estamos analisando seu {{equipamento}}. Em breve te passamos o diagnóstico.', 0,
    '{cliente_nome,equipamento}', true, true),

  ('operational', 'os.in_repair', 'whatsapp', 'Em reparo',
    'Cliente aprovou orçamento.',
    null,
    'Boas notícias {{cliente_nome}}: começamos o reparo do seu {{equipamento}}. Previsão: {{previsao}}.', 0,
    '{cliente_nome,equipamento,previsao}', true, true),

  ('operational', 'os.ready', 'whatsapp', 'Pronta para retirar',
    'OS concluída.',
    null,
    'Seu {{equipamento}} está pronto pra retirar, {{cliente_nome}}! Garantia: {{garantia_dias}} dias. Te aguardamos.', 0,
    '{cliente_nome,equipamento,garantia_dias}', true, true),

  ('operational', 'os.overdue', 'whatsapp', 'OS atrasada (lembrete interno)',
    'Notifica o dono quando OS passou da previsão.',
    null,
    'OS #{{os_numero}} de {{cliente_nome}} está atrasada (previsão {{previsao}}). Status: {{status_atual}}.', 0,
    '{os_numero,cliente_nome,previsao,status_atual}', true, false),

  ('operational', 'sale.completed', 'whatsapp', 'Cupom pós-venda',
    'Manda link do cupom não-fiscal pelo WhatsApp.',
    null,
    'Obrigado pela compra, {{cliente_nome}}! Veja seu cupom: {{link_cupom}}', 0,
    '{cliente_nome,link_cupom}', true, true),

  ('operational', 'sale.completed', 'email', 'Cupom pós-venda email',
    'Envia link do cupom por email.',
    'Sua compra na {{loja_nome}}',
    'Olá {{cliente_nome}}, obrigado pela compra! Acesse o cupom: {{link_cupom}}', 0,
    '{cliente_nome,loja_nome,link_cupom}', true, false),

  ('operational', 'quote.created', 'whatsapp', 'Orçamento criado',
    'Envia link do orçamento pra cliente.',
    null,
    'Oi {{cliente_nome}}! Seu orçamento está pronto: {{link_orcamento}} (válido até {{validade}}).', 0,
    '{cliente_nome,link_orcamento,validade}', true, true),

  ('operational', 'quote.no_response_24h', 'whatsapp', 'Follow-up orçamento 24h',
    'Cliente não respondeu em 24h.',
    null,
    'Oi {{cliente_nome}}, viu nosso orçamento de {{valor}}? Posso esclarecer alguma dúvida?', 1440,
    '{cliente_nome,valor}', true, true),

  ('operational', 'quote.expiring_soon', 'whatsapp', 'Orçamento expirando',
    '1 dia antes do orçamento vencer.',
    null,
    '{{cliente_nome}}, seu orçamento vence amanhã ({{validade}}). Quer fechar com a gente?', 0,
    '{cliente_nome,validade}', true, true),

  -- Engagement
  ('engagement', 'customer.first_purchase', 'whatsapp', 'Boas-vindas cliente novo',
    'Após primeira compra.',
    null,
    'Bem-vindo à família {{loja_nome}}, {{cliente_nome}}! Qualquer coisa, é só chamar aqui.', 60,
    '{cliente_nome,loja_nome}', true, true),

  ('engagement', 'customer.birthday', 'whatsapp', 'Aniversário cliente',
    'Felicitação no dia do aniversário.',
    null,
    'Feliz aniversário, {{cliente_nome}}! 🎉 Cupom de {{desconto}}% nas compras hoje. Te esperamos!', 0,
    '{cliente_nome,desconto}', true, true),

  ('engagement', 'customer.inactive_90d', 'whatsapp', 'Cliente inativo 90 dias',
    'Reativação de cliente que não volta.',
    null,
    'Oi {{cliente_nome}}, faz tempo que não te vemos! Que tal dar uma passada? Temos novidades.', 0,
    '{cliente_nome}', true, false),

  ('engagement', 'sale.after_7d', 'whatsapp', 'Check 7 dias pós-venda',
    'Avalia satisfação após 1 semana.',
    null,
    'Oi {{cliente_nome}}, tudo bem com seu {{produto}} comprado há 1 semana? Qualquer dúvida estamos aqui.', 10080,
    '{cliente_nome,produto}', true, true),

  ('engagement', 'os.delivered_3d', 'whatsapp', 'NPS pós-OS',
    '3 dias após entrega da OS, pede nota.',
    null,
    'Oi {{cliente_nome}}! Tudo certo com o {{equipamento}}? De 0 a 10, quanto recomendaria nosso serviço?', 4320,
    '{cliente_nome,equipamento}', true, true),

  ('engagement', 'warranty.expiring_30d', 'whatsapp', 'Garantia próxima de vencer',
    'Avisa 30 dias antes da garantia expirar.',
    null,
    'Atenção {{cliente_nome}}: a garantia do {{produto}} expira em 30 dias. Tudo funcionando bem?', 0,
    '{cliente_nome,produto}', true, false),

  -- Marketing
  ('marketing', 'lead.captured', 'whatsapp', 'Primeiro contato lead',
    'Lead novo chegou via Instagram/site.',
    null,
    'Oi {{lead_nome}}, obrigado pelo contato! Como posso te ajudar?', 0,
    '{lead_nome}', true, true),

  ('marketing', 'lead.no_response_3d', 'whatsapp', 'Reengajar lead frio',
    'Lead sem resposta há 3 dias.',
    null,
    'Oi {{lead_nome}}, ainda tem interesse? Posso te mostrar opções dentro do seu orçamento.', 4320,
    '{lead_nome}', true, false),

  -- Internal (notifica equipe)
  ('operational', 'stock.below_minimum', 'internal', 'Estoque baixo (notif loja)',
    'Produto-chave abaixo do mínimo.',
    null,
    '⚠ Estoque baixo: {{produto}} ({{saldo}}/{{minimo}}). Hora de repor.', 0,
    '{produto,saldo,minimo}', true, true),

  ('operational', 'sale.high_value', 'internal', 'Venda alta (notif dono)',
    'Venda acima do limite configurado.',
    null,
    '💰 Venda de R$ {{valor}} fechada por {{vendedor}}. Cliente: {{cliente}}.', 0,
    '{valor,vendedor,cliente}', true, false),

  ('operational', 'os.opened', 'internal', 'Nova OS aberta (notif técnico)',
    'Avisa técnico responsável.',
    null,
    '🔧 Nova OS #{{os_numero}}: {{equipamento}} ({{problema}}).', 0,
    '{os_numero,equipamento,problema}', true, false),

  ('operational', 'receivable.overdue', 'internal', 'Conta a receber atrasada',
    'Cliente atrasou pagamento.',
    null,
    '📌 {{cliente}} está em atraso desde {{vencimento}}. Valor: R$ {{valor}}.', 0,
    '{cliente,vencimento,valor}', true, true)
on conflict do nothing;
