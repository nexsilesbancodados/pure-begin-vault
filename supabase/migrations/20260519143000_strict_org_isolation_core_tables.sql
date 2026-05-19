-- Strict multi-store isolation for core operational data.
-- Every authenticated read/write must match the row organization_id.

alter table public.sales_orders enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.accounts_receivable enable row level security;
alter table public.accounts_payable enable row level security;
alter table public.service_orders enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists "Users can manage their sales" on public.sales_orders;
drop policy if exists "RLS_Isolation_Orders" on public.sales_orders;
drop policy if exists "strict_org_sales_orders" on public.sales_orders;
create policy "strict_org_sales_orders" on public.sales_orders
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

drop policy if exists "strict_org_sale_items" on public.sale_items;
create policy "strict_org_sale_items" on public.sale_items
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

drop policy if exists "strict_org_sale_payments" on public.sale_payments;
create policy "strict_org_sale_payments" on public.sale_payments
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

drop policy if exists "Users can manage their own customers" on public.customers;
drop policy if exists "strict_org_customers" on public.customers;
create policy "strict_org_customers" on public.customers
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

drop policy if exists "Users can manage their own products" on public.products;
drop policy if exists "strict_org_products" on public.products;
create policy "strict_org_products" on public.products
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

drop policy if exists "Users can manage their finances" on public.finance_transactions;
drop policy if exists "Users can manage their own transactions" on public.finance_transactions;
drop policy if exists "Finance access policy" on public.finance_transactions;
drop policy if exists "strict_org_finance_transactions" on public.finance_transactions;
create policy "strict_org_finance_transactions" on public.finance_transactions
  for all to authenticated
  using (organization_id is not null and (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin()))
  with check (organization_id is not null and (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin()));

drop policy if exists "strict_org_accounts_receivable" on public.accounts_receivable;
create policy "strict_org_accounts_receivable" on public.accounts_receivable
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

drop policy if exists "strict_org_accounts_payable" on public.accounts_payable;
create policy "strict_org_accounts_payable" on public.accounts_payable
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

drop policy if exists "Users can manage their service orders" on public.service_orders;
drop policy if exists "strict_org_service_orders" on public.service_orders;
create policy "strict_org_service_orders" on public.service_orders
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());

drop policy if exists "org_members_stockmov" on public.stock_movements;
drop policy if exists "strict_org_stock_movements" on public.stock_movements;
create policy "strict_org_stock_movements" on public.stock_movements
  for all to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin())
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_super_admin());
