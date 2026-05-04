create table if not exists public.bot_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  is_active boolean not null default false,
  bot_name text not null default 'Assistente Virtual',
  greeting text not null default 'Olá! 👋 Sou o assistente virtual. Como posso ajudar?',
  away_message text not null default 'No momento estamos fora do horário de atendimento. Retornaremos em breve!',
  fallback_message text not null default 'Desculpe, não entendi. Vou transferir para um atendente humano.',
  business_hours jsonb not null default '{"enabled":false,"start":"08:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb,
  ai_provider text not null default 'deepseek',
  ai_model text not null default 'deepseek-chat',
  ai_temperature numeric not null default 0.7,
  system_prompt text not null default 'Você é um atendente cordial de uma loja de celulares. Responda de forma breve, clara e amigável.',
  handoff_keywords text[] not null default array['humano','atendente','pessoa']::text[],
  auto_reply_delay_seconds integer not null default 2,
  max_messages_before_handoff integer not null default 10,
  collect_lead_info boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bot_settings enable row level security;

create policy "Users manage their bot_settings"
on public.bot_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger bot_settings_updated_at
  before update on public.bot_settings
  for each row execute function public.handle_updated_at();

create table if not exists public.bot_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_phone text not null,
  contact_name text,
  messages_count integer not null default 0,
  status text not null default 'active',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.bot_conversations enable row level security;

create policy "Users manage their bot_conversations"
on public.bot_conversations for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists bot_conversations_user_idx on public.bot_conversations(user_id, last_message_at desc);