## Situação atual

- Página `/automacao` e edge function `automation-runner` existem, mas as tabelas que elas usam **não existem** no banco (`automations`, `automation_runs`, `tasks`, `messages`, `pipeline_leads`).
- O código usa `user_id` para isolamento, mas o resto do schema (`leads`, `funnel_stages`, `bot_conversations`, etc.) usa `organization_id` com RLS por organização.
- Nenhum gatilho do app dispara o `automation-runner` hoje — não há chamada quando um lead é criado, quando uma mensagem chega no WhatsApp, ou quando um lead muda de etapa.
- A automação "sem resposta há 24h" precisa de um job agendado que ainda não existe.

## O que será feito

### 1. Migration: criar as tabelas que faltam (padrão multi-tenant por organização)

- `automations` — fluxos configurados (nome, gatilho, ação, config jsonb, ativo)
- `automation_runs` — log de execução (sucesso, erro, skipped, payload)
- `tasks` — tarefas geradas pelas ações (título, descrição, prioridade, status, due_date, lead_id)
- `messages` — histórico de mensagens (direção inbound/outbound, lead_id, content) usado para detectar "primeira mensagem" e "sem resposta há 24h"
- Todas com `organization_id` + RLS isolando por `profiles.organization_id = auth.uid()`
- Índices em `(organization_id, trigger_type, is_active)` na `automations` para o runner ser rápido

### 2. Refatorar `supabase/functions/automation-runner/index.ts`

- Trocar todos os filtros `user_id` por `organization_id`
- Aceitar payload `{ organization_id, trigger_type, payload }`
- Resolver `funnel_stages` por `organization_id` ao invés de `user_id`
- Manter as condições já implementadas (palavras-chave, fora do horário, primeira mensagem, etapa específica)

### 3. Atualizar `src/routes/automacao.tsx`

- Carregar `organization_id` do profile do usuário e usar no insert/select de `automations`
- (Já funciona o resto da UI, só troca o campo de isolamento)

### 4. Conectar os 4 gatilhos no código

- **`new_lead`**: chamar `automation-runner` toda vez que um lead é inserido (helper `fireAutomation` em `src/lib/automation-trigger.ts`, plugado em `LeadsTable` e nos pontos onde leads nascem — `funil/AddDealDialog`, webhook do bot, etc.)
- **`message_received`**: o webhook `bot-webhook` já recebe mensagens — adicionar uma chamada ao `automation-runner` ao final, com `payload.content`, `payload.phone`, `payload.lead_id`
- **`stage_changed`**: chamar quando um deal muda de coluna no Kanban (em `funil/StageColumn` / lógica de drag-drop) com `payload.from_stage_id` e `payload.to_stage_id`
- **`no_reply_24h`**: novo cron `pg_cron` que roda de hora em hora chamando o `automation-runner` para cada lead cuja última mensagem inbound é > 24h e ainda não teve outbound depois (job lê via SQL e enfileira via `net.http_post`)

### 5. Seed dos 4 fluxos prontos

Após as tabelas existirem, inserir (uma vez, para a organização atual do usuário logado) usando o `add data` tool:

1. **Boas-vindas WhatsApp em novo lead** — gatilho `new_lead`, ação `send_message`, mensagem "Olá {{nome}}! 👋 Recebemos seu contato e em instantes um vendedor falará com você."
2. **Resposta fora do horário** — gatilho `message_received`, ação `send_message`, condição `outside_business_hours: true` (08:00–18:00), mensagem "Olá! Estamos fora do expediente (08h–18h). Retornaremos pela manhã. 🙏"
3. **Follow-up 24h sem resposta** — gatilho `no_reply_24h`, ação `send_message` + `also_create_task` (tarefa "Retomar contato com {{nome}}"), mensagem "Oi {{nome}}, ainda posso te ajudar com algo?"
4. **E-mail ao fechar venda** — gatilho `stage_changed`, ação `send_email`, condição `target_stage_name: "Ganho"` (cria a etapa se não existir), assunto "Bem-vindo(a) à família!", corpo HTML simples.

### 6. Verificação

- Rodar `automation-runner` manualmente via `curl_edge_functions` com payload de teste para garantir que executa e grava em `automation_runs`.
- Confirmar no DB (`select * from automation_runs order by created_at desc limit 5`).

## Detalhes técnicos relevantes

- **Auth/RLS**: o edge function continua usando `service_role` para escrever em qualquer org, mas filtra por `organization_id` recebido no payload. Quem chama o runner é sempre código nosso (frontend autenticado ou outra edge function), nunca cliente anônimo.
- **`config.toml`**: `automation-runner` já está com `verify_jwt = false` para poder ser chamado por outros functions internamente.
- **Cron 24h**: `pg_cron` + `pg_net` chamando `https://htsjkvczxlrsfapkbidq.supabase.co/functions/v1/automation-runner` a cada hora.
- **Sem dependências novas** — tudo com bibliotecas já presentes no projeto.

## O que NÃO está incluído (posso fazer depois se quiser)

- Editar fluxos existentes na UI (hoje a página só cria/pausa/exclui)
- Visualizar log de execuções (`automation_runs`) na UI
- Dashboard de métricas das automações
- Suporte a templates de mensagem com mídia (áudio/imagem)
