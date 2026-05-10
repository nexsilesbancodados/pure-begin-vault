-- Completeness pack (no payments)
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists role text not null default 'owner';

update public.profiles set display_name = coalesce(display_name, nome, split_part(email,'@',1)) where display_name is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _org uuid; _full_name text;
begin
  _full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  if (new.raw_user_meta_data->>'organization_id') is not null then
    insert into public.profiles (id, email, nome, display_name, organization_id, role)
    values (new.id, new.email, _full_name, _full_name,
            (new.raw_user_meta_data->>'organization_id')::uuid,
            coalesce(new.raw_user_meta_data->>'role','vendedor'));
  else
    insert into public.organizations(owner_id, name)
    values (new.id, coalesce(new.raw_user_meta_data->>'company', _full_name||' — Workspace'))
    returning id into _org;
    insert into public.profiles (id, email, nome, display_name, organization_id, role)
    values (new.id, new.email, _full_name, _full_name, _org, 'owner');
    insert into public.user_roles(user_id, organization_id, role)
    values (new.id, _org, 'admin') on conflict do nothing;
  end if;
  return new;
end; $$;

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_by uuid not null,
  email text not null,
  role text not null default 'vendedor',
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_team_invitations_org on public.team_invitations(organization_id);
create index if not exists idx_team_invitations_email on public.team_invitations(email);
create index if not exists idx_team_invitations_token on public.team_invitations(token);
alter table public.team_invitations enable row level security;
drop policy if exists "team_invites org all" on public.team_invitations;
create policy "team_invites org all" on public.team_invitations
  for all using (public.is_org_member(auth.uid(), organization_id))
  with check (public.is_org_member(auth.uid(), organization_id));
drop policy if exists "team_invites public select" on public.team_invitations;
create policy "team_invites public select" on public.team_invitations for select using (true);

insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars public read') then
    create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars auth upload') then
    create policy "avatars auth upload" on storage.objects for insert
      with check (bucket_id = 'avatars' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars auth update own') then
    create policy "avatars auth update own" on storage.objects for update
      using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars auth delete own') then
    create policy "avatars auth delete own" on storage.objects for delete
      using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;
