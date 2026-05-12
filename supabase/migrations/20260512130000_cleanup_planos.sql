-- Limpar duplicação starter/professional vs pro/business
-- Decisão final de pricing:
--   Starter   R$ 49,90  · 1 loja
--   Pro       R$ 99,90  · 3 lojas (mantém slug pro, remove professional)
--   Business  R$ 249,90 · ilimitado
--   Enterprise R$ 999,90 · whitelabel + SSO

UPDATE plans SET is_active = false WHERE slug = 'professional';

-- Migrar quaisquer subscriptions existentes do plano professional → pro
UPDATE subscriptions s
SET plan_id = (SELECT id FROM plans WHERE slug = 'pro')
WHERE plan_id IN (SELECT id FROM plans WHERE slug = 'professional');

-- Garantir sort_order coerente
UPDATE plans SET sort_order = 1 WHERE slug = 'starter';
UPDATE plans SET sort_order = 2 WHERE slug = 'pro';
UPDATE plans SET sort_order = 3 WHERE slug = 'business';
UPDATE plans SET sort_order = 4 WHERE slug = 'enterprise';
