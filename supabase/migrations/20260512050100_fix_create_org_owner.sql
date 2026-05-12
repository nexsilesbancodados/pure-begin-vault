-- Fix: organizations.owner_id é NOT NULL → create_organization_for_user precisa setar.

create or replace function public.create_organization_for_user(_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if _name is null or length(trim(_name)) = 0 then
    raise exception 'nome obrigatório';
  end if;

  insert into public.organizations (name, owner_id)
  values (trim(_name), auth.uid())
  returning id into v_org_id;

  insert into public.user_organizations (user_id, organization_id, role, is_default)
  values (auth.uid(), v_org_id, 'owner', false);

  return v_org_id;
end;
$$;
