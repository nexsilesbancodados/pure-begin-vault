alter table public.bot_conversations
  drop constraint if exists bot_conversations_user_phone_key;
alter table public.bot_conversations
  add constraint bot_conversations_user_phone_key unique (user_id, contact_phone);