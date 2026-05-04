INSERT INTO bot_conversations (user_id, contact_phone, contact_name, transcript, status, messages_count, last_message_at)
VALUES ('133da88b-f929-4891-a1a7-50a8abb69554', '5500000000000', 'Teste Suporte', '[{"role": "user", "content": "Olá, isso é um teste", "at": "2026-04-28T22:00:00Z"}]'::jsonb, 'active', 1, now())
ON CONFLICT (user_id, contact_phone) DO UPDATE 
SET last_message_at = now(), transcript = EXCLUDED.transcript;