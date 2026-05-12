-- Reduz trial de 7 → 3 dias

-- Atualiza função do trigger
create or replace function public.grant_trial_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starter_id uuid;
begin
  if new.organization_id is null then return new; end if;

  select id into v_starter_id from public.plans where slug = 'starter' and is_active = true limit 1;
  if v_starter_id is null then return new; end if;

  if exists (select 1 from public.subscriptions where user_id = new.id) then
    return new;
  end if;

  insert into public.subscriptions (
    user_id, organization_id, plan_id, status,
    current_period_start, current_period_end
  ) values (
    new.id, new.organization_id, v_starter_id, 'trial',
    now(), now() + interval '3 days'
  );

  return new;
end;
$$;

-- Encurta trials ativos existentes para fim em até 3 dias a partir de agora
update public.subscriptions
set current_period_end = least(current_period_end, now() + interval '3 days'),
    updated_at = now()
where status = 'trial';
