-- Trigger automática: quando profiles.organization_id é setado, garante entry em user_organizations.
-- Resolve o caso de novos usuários (após o seed inicial).

create or replace function public.sync_user_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is not null
     and (tg_op = 'INSERT' or new.organization_id is distinct from old.organization_id) then
    insert into public.user_organizations (user_id, organization_id, role, is_default)
    values (new.id, new.organization_id, 'owner', true)
    on conflict (user_id, organization_id) do nothing;

    -- desmarca outras como default (a "ativa" passa a ser a nova)
    update public.user_organizations
    set is_default = false
    where user_id = new.id and organization_id <> new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_user_organization on public.profiles;
create trigger trg_sync_user_organization
after insert or update of organization_id on public.profiles
for each row execute function public.sync_user_organization();
