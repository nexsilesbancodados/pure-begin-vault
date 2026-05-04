-- Bot integration fields
alter table public.bot_settings
  add column if not exists whatsapp_instance text,
  add column if not exists webhook_secret text default encode(gen_random_bytes(16), 'hex');

alter table public.bot_conversations
  add column if not exists transcript jsonb not null default '[]'::jsonb;

create index if not exists bot_conv_phone_idx on public.bot_conversations(user_id, contact_phone);

-- Helper para criar estágios padrão se o usuário ainda não tem
create or replace function public.ensure_default_funnel_stages(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.funnel_stages where user_id = _user_id) then
    insert into public.funnel_stages (user_id, name, color, order_index) values
      (_user_id, 'Novo Lead', '#6366f1', 0),
      (_user_id, 'Em Contato', '#3b82f6', 1),
      (_user_id, 'Qualificado', '#8b5cf6', 2),
      (_user_id, 'Proposta', '#f59e0b', 3),
      (_user_id, 'Ganho', '#10b981', 4),
      (_user_id, 'Perdido', '#ef4444', 5);
  end if;
end;
$$;