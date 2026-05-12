-- LGPD Art. 18 VI/X: direito de esquecimento
-- RPC pra deletar conta + todos dados pessoais (anonimização cascata)

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  -- 1. Cancela subscriptions
  update public.subscriptions
    set status = 'cancelled', canceled_at = now()
    where user_id = v_uid;

  -- 2. Anonimiza profiles
  update public.profiles
    set nome = 'Usuário Removido',
        email = null,
        avatar_url = null,
        biografia = null
    where id = v_uid;

  -- 3. Apaga relacionamento user_organizations
  delete from public.user_organizations where user_id = v_uid;

  -- 4. Apaga registros pessoais (logs, notifications, audit_logs do user)
  delete from public.notifications where user_id = v_uid;
  delete from public.audit_logs where user_id = v_uid;

  -- 5. Apaga conta auth (cascata vai cuidar do resto via FKs)
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
