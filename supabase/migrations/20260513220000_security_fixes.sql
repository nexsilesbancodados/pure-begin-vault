-- Security fixes from scan results

-- 1) pending_signups: explicit deny for all client roles (service_role bypasses RLS)
alter table if exists public.pending_signups enable row level security;
drop policy if exists "pending_signups_no_client_access" on public.pending_signups;
create policy "pending_signups_no_client_access" on public.pending_signups
  as restrictive for all to authenticated, anon
  using (false) with check (false);

-- 2) payments: block client INSERT/UPDATE/DELETE; SELECT remains owner-scoped
drop policy if exists "payments_block_insert" on public.payments;
drop policy if exists "payments_block_update" on public.payments;
drop policy if exists "payments_block_delete" on public.payments;
create policy "payments_block_insert" on public.payments
  for insert to authenticated, anon with check (false);
create policy "payments_block_update" on public.payments
  for update to authenticated, anon using (false) with check (false);
create policy "payments_block_delete" on public.payments
  for delete to authenticated, anon using (false);

-- 3) subscriptions: prevent client tampering; webhooks use service_role
drop policy if exists "subs_update_own" on public.subscriptions;
drop policy if exists "subs_insert_own" on public.subscriptions;
drop policy if exists "subs_block_update" on public.subscriptions;
drop policy if exists "subs_block_insert" on public.subscriptions;
drop policy if exists "subs_block_delete" on public.subscriptions;
create policy "subs_block_update" on public.subscriptions
  for update to authenticated, anon using (false) with check (false);
create policy "subs_block_insert" on public.subscriptions
  for insert to authenticated, anon with check (false);
create policy "subs_block_delete" on public.subscriptions
  for delete to authenticated, anon using (false);

-- 4) user_roles: prevent self-escalation; admins can manage other users in their org
drop policy if exists "user_roles admin manage" on public.user_roles;
drop policy if exists "user_roles admin select" on public.user_roles;
drop policy if exists "user_roles admin insert" on public.user_roles;
drop policy if exists "user_roles admin update" on public.user_roles;
drop policy if exists "user_roles admin delete" on public.user_roles;

create policy "user_roles admin select" on public.user_roles
  for select to authenticated
  using (has_role(auth.uid(), organization_id, 'admin'::app_role));

create policy "user_roles admin insert" on public.user_roles
  for insert to authenticated
  with check (
    has_role(auth.uid(), organization_id, 'admin'::app_role)
    and user_id <> auth.uid()
  );

create policy "user_roles admin update" on public.user_roles
  for update to authenticated
  using (has_role(auth.uid(), organization_id, 'admin'::app_role) and user_id <> auth.uid())
  with check (has_role(auth.uid(), organization_id, 'admin'::app_role) and user_id <> auth.uid());

create policy "user_roles admin delete" on public.user_roles
  for delete to authenticated
  using (has_role(auth.uid(), organization_id, 'admin'::app_role) and user_id <> auth.uid());

-- 5) storage.objects: avatars UPDATE/DELETE restricted to owner (folder = uid)
drop policy if exists "Avatares update own" on storage.objects;
drop policy if exists "Avatares delete own" on storage.objects;
create policy "Avatares update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Avatares delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
