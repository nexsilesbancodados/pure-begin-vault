create table if not exists public.purchase_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  note_number integer not null,
  fornecedor text not null default '',
  data_compra date not null default current_date,
  prazo_pagamento date,
  paga boolean not null default false,
  total numeric(14,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_notes_org_number_unique unique (organization_id, note_number),
  constraint purchase_notes_items_is_array check (jsonb_typeof(items) = 'array')
);

create index if not exists idx_purchase_notes_org_updated on public.purchase_notes(organization_id, updated_at desc);
create index if not exists idx_purchase_notes_org_due on public.purchase_notes(organization_id, prazo_pagamento) where paga = false;

alter table public.purchase_notes enable row level security;

create policy "purchase_notes org select"
  on public.purchase_notes for select
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

create policy "purchase_notes org insert"
  on public.purchase_notes for insert
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

create policy "purchase_notes org update"
  on public.purchase_notes for update
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

create policy "purchase_notes org delete"
  on public.purchase_notes for delete
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

create trigger update_purchase_notes_updated_at
  before update on public.purchase_notes
  for each row execute function public.handle_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.purchase_notes;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
