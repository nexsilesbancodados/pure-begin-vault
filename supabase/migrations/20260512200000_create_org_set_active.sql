-- Fix: create_organization_for_user agora seta profile.organization_id se estiver null
-- e marca como is_default se for a primeira loja do user.

CREATE OR REPLACE FUNCTION public.create_organization_for_user(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_org_id uuid;
  v_existing_count int;
  v_current_active uuid;
begin
  if _name is null or length(trim(_name)) = 0 then
    raise exception 'nome obrigatório';
  end if;

  -- Cria org
  insert into public.organizations (name, owner_id)
  values (trim(_name), auth.uid())
  returning id into v_org_id;

  -- Quantas lojas o user já tem?
  select count(*) into v_existing_count
  from public.user_organizations
  where user_id = auth.uid();

  -- Vincula como owner; primeira loja = default
  insert into public.user_organizations (user_id, organization_id, role, is_default)
  values (auth.uid(), v_org_id, 'owner', v_existing_count = 0);

  -- Se profile.organization_id está null, seta pra esta
  select organization_id into v_current_active
  from public.profiles
  where id = auth.uid();

  if v_current_active is null then
    update public.profiles
    set organization_id = v_org_id
    where id = auth.uid();
  end if;

  return v_org_id;
end;
$function$;
