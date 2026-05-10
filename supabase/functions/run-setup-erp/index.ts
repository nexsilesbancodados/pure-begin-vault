import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SQL = `
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  name text not null,
  document text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_suppliers_org on public.suppliers(organization_id);
alter table public.suppliers enable row level security;
drop policy if exists "suppliers org all" on public.suppliers;
create policy "suppliers org all" on public.suppliers for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  name text not null,
  email text,
  phone text,
  document text,
  address text,
  city text,
  state text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_org on public.customers(organization_id, created_at desc);
create index if not exists idx_customers_phone on public.customers(phone);
alter table public.customers enable row level security;
drop policy if exists "customers org all" on public.customers;
create policy "customers org all" on public.customers for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  name text not null,
  sku text,
  ean text,
  ncm text,
  reference text,
  category text not null default 'Geral',
  brand text,
  supplier text,
  supplier_id uuid,
  model text,
  price numeric(14,2) not null default 0,
  wholesale_price numeric(14,2),
  cost_price numeric(14,2) default 0,
  stock_quantity numeric(14,3) not null default 0,
  min_stock numeric(14,3) default 0,
  unit text not null default 'un',
  weight numeric(10,3),
  location text,
  image_url text,
  description text,
  active boolean not null default true,
  has_imei boolean not null default false,
  import_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_org on public.products(organization_id, created_at desc);
create index if not exists idx_products_sku on public.products(sku);
create index if not exists idx_products_name on public.products(name);
alter table public.products enable row level security;
drop policy if exists "products org all" on public.products;
create policy "products org all" on public.products for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.product_imei (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  imei text not null,
  serial text,
  status text not null default 'in_stock',
  cost_price numeric(14,2),
  notes text,
  sale_id uuid,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id, imei)
);
create index if not exists idx_imei_product on public.product_imei(product_id);
create index if not exists idx_imei_status on public.product_imei(organization_id, status);
alter table public.product_imei enable row level security;
drop policy if exists "imei org all" on public.product_imei;
create policy "imei org all" on public.product_imei for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null,
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2),
  reason text,
  reference_type text,
  reference_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_mov_product on public.stock_movements(product_id, created_at desc);
create index if not exists idx_stock_mov_org on public.stock_movements(organization_id, created_at desc);
alter table public.stock_movements enable row level security;
drop policy if exists "stock_mov org all" on public.stock_movements;
create policy "stock_mov org all" on public.stock_movements for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.import_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  filename text not null,
  total_rows int not null default 0,
  imported_rows int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);
create index if not exists idx_import_org on public.import_history(organization_id, created_at desc);
alter table public.import_history enable row level security;
drop policy if exists "import org all" on public.import_history;
create policy "import org all" on public.import_history for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

alter table public.sales_orders add column if not exists customer_id uuid;
alter table public.sales_orders add column if not exists sale_number bigint;
alter table public.sales_orders add column if not exists subtotal numeric(14,2) default 0;
alter table public.sales_orders add column if not exists discount numeric(14,2) default 0;
alter table public.sales_orders add column if not exists addition numeric(14,2) default 0;
alter table public.sales_orders add column if not exists payment_method text;
alter table public.sales_orders add column if not exists notes text;
alter table public.sales_orders add column if not exists channel text default 'pdv';
alter table public.sales_orders add column if not exists seller_id uuid;
alter table public.sales_orders add column if not exists updated_at timestamptz not null default now();
create sequence if not exists public.sales_orders_number_seq;
create index if not exists idx_sales_org_created on public.sales_orders(organization_id, created_at desc);
create index if not exists idx_sales_customer on public.sales_orders(customer_id);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sale_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid,
  product_name text not null,
  sku text,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  unit_cost numeric(14,2),
  discount numeric(14,2) default 0,
  total numeric(14,2) not null default 0,
  imei text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_sale_items_product on public.sale_items(product_id);
alter table public.sale_items enable row level security;
drop policy if exists "sale_items org all" on public.sale_items;
create policy "sale_items org all" on public.sale_items for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sale_id uuid not null references public.sales_orders(id) on delete cascade,
  method text not null,
  amount numeric(14,2) not null,
  installments int default 1,
  fee_amount numeric(14,2) default 0,
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_sale_pay_sale on public.sale_payments(sale_id);
alter table public.sale_payments enable row level security;
drop policy if exists "sale_pay org all" on public.sale_payments;
create policy "sale_pay org all" on public.sale_payments for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  os_number bigint,
  customer_id uuid,
  technician_id uuid,
  equipment text not null,
  brand text,
  model text,
  serial text,
  imei text,
  problem_description text,
  diagnosis text,
  solution text,
  accessories text,
  password_pattern text,
  estimated_cost numeric(14,2) default 0,
  parts_cost numeric(14,2) default 0,
  labor_cost numeric(14,2) default 0,
  total_cost numeric(14,2) default 0,
  warranty_days int default 90,
  status text not null default 'open',
  priority text default 'normal',
  due_date timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create sequence if not exists public.service_orders_number_seq;
create index if not exists idx_so_org on public.service_orders(organization_id, created_at desc);
create index if not exists idx_so_customer on public.service_orders(customer_id);
create index if not exists idx_so_status on public.service_orders(organization_id, status);
alter table public.service_orders enable row level security;
drop policy if exists "service_orders org all" on public.service_orders;
create policy "service_orders org all" on public.service_orders for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.service_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  product_id uuid,
  description text not null,
  item_type text not null default 'part',
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_so_items_so on public.service_order_items(service_order_id);
alter table public.service_order_items enable row level security;
drop policy if exists "so_items org all" on public.service_order_items;
create policy "so_items org all" on public.service_order_items for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.service_order_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  user_id uuid not null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_so_hist_so on public.service_order_history(service_order_id, created_at desc);
alter table public.service_order_history enable row level security;
drop policy if exists "so_hist org all" on public.service_order_history;
create policy "so_hist org all" on public.service_order_history for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid not null,
  name text not null,
  code text not null,
  type text not null,
  parent_id uuid references public.chart_of_accounts(id) on delete set null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_coa_user on public.chart_of_accounts(user_id);
create index if not exists idx_coa_org on public.chart_of_accounts(organization_id);
alter table public.chart_of_accounts enable row level security;
drop policy if exists "coa owner all" on public.chart_of_accounts;
create policy "coa owner all" on public.chart_of_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid not null,
  type text not null,
  amount numeric(14,2) not null,
  description text,
  category text,
  account_id uuid references public.chart_of_accounts(id) on delete set null,
  payment_method text,
  reference_type text,
  reference_id uuid,
  transaction_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_ft_user_date on public.finance_transactions(user_id, transaction_date desc);
create index if not exists idx_ft_org_date on public.finance_transactions(organization_id, transaction_date desc);
alter table public.finance_transactions enable row level security;
drop policy if exists "ft owner all" on public.finance_transactions;
create policy "ft owner all" on public.finance_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  supplier_id uuid,
  description text not null,
  amount numeric(14,2) not null,
  due_date date not null,
  paid_at timestamptz,
  paid_amount numeric(14,2),
  status text not null default 'pending',
  category text,
  account_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ap_org_due on public.accounts_payable(organization_id, due_date);
create index if not exists idx_ap_status on public.accounts_payable(organization_id, status);
alter table public.accounts_payable enable row level security;
drop policy if exists "ap org all" on public.accounts_payable;
create policy "ap org all" on public.accounts_payable for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  customer_id uuid,
  sale_id uuid,
  description text not null,
  amount numeric(14,2) not null,
  due_date date not null,
  paid_at timestamptz,
  paid_amount numeric(14,2),
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ar_org_due on public.accounts_receivable(organization_id, due_date);
create index if not exists idx_ar_status on public.accounts_receivable(organization_id, status);
alter table public.accounts_receivable enable row level security;
drop policy if exists "ar org all" on public.accounts_receivable;
create policy "ar org all" on public.accounts_receivable for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(14,2) not null default 0,
  closing_amount numeric(14,2),
  expected_amount numeric(14,2),
  difference numeric(14,2),
  status text not null default 'open',
  notes text
);
create index if not exists idx_crs_org_status on public.cash_register_sessions(organization_id, status);
create unique index if not exists uniq_one_open_session_per_user on public.cash_register_sessions(user_id) where status = 'open';
alter table public.cash_register_sessions enable row level security;
drop policy if exists "crs org all" on public.cash_register_sessions;
create policy "crs org all" on public.cash_register_sessions for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create table if not exists public.cash_register_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  session_id uuid not null references public.cash_register_sessions(id) on delete cascade,
  user_id uuid not null,
  type text not null,
  amount numeric(14,2) not null,
  description text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_session on public.cash_register_movements(session_id, created_at desc);
alter table public.cash_register_movements enable row level security;
drop policy if exists "crm org all" on public.cash_register_movements;
create policy "crm org all" on public.cash_register_movements for all using (public.is_org_member(auth.uid(), organization_id)) with check (public.is_org_member(auth.uid(), organization_id));

create or replace function public.checkout_sale(_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  _org uuid;
  _user uuid := auth.uid();
  _sale_id uuid;
  _item jsonb;
  _pay jsonb;
  _qty numeric;
  _pid uuid;
begin
  if _user is null then raise exception 'auth required'; end if;
  select organization_id into _org from public.profiles where id = _user;
  if _org is null then raise exception 'user has no organization'; end if;

  insert into public.sales_orders(organization_id, user_id, customer_id, total_amount, subtotal, discount, addition, payment_method, notes, channel, sale_number, status, seller_id)
  values (
    _org, _user,
    nullif(_payload->>'customer_id','')::uuid,
    coalesce((_payload->>'total')::numeric,0),
    coalesce((_payload->>'subtotal')::numeric,0),
    coalesce((_payload->>'discount')::numeric,0),
    coalesce((_payload->>'addition')::numeric,0),
    _payload->>'payment_method',
    _payload->>'notes',
    coalesce(_payload->>'channel','pdv'),
    nextval('public.sales_orders_number_seq'),
    'completed',
    _user
  ) returning id into _sale_id;

  for _item in select * from jsonb_array_elements(coalesce(_payload->'items','[]'::jsonb))
  loop
    _pid := nullif(_item->>'product_id','')::uuid;
    _qty := coalesce((_item->>'quantity')::numeric,1);
    insert into public.sale_items(organization_id, sale_id, product_id, product_name, sku, quantity, unit_price, unit_cost, discount, total, imei, metadata)
    values (
      _org, _sale_id, _pid,
      coalesce(_item->>'product_name','Item'),
      _item->>'sku',
      _qty,
      coalesce((_item->>'unit_price')::numeric,0),
      nullif(_item->>'unit_cost','')::numeric,
      coalesce((_item->>'discount')::numeric,0),
      coalesce((_item->>'total')::numeric, coalesce((_item->>'unit_price')::numeric,0) * _qty),
      _item->>'imei',
      coalesce(_item->'metadata','{}'::jsonb)
    );
    if _pid is not null then
      update public.products set stock_quantity = coalesce(stock_quantity,0) - _qty, updated_at = now() where id = _pid and organization_id = _org;
      insert into public.stock_movements(organization_id, user_id, product_id, movement_type, quantity, reason, reference_type, reference_id)
      values (_org, _user, _pid, 'out', _qty, 'venda', 'sale', _sale_id);
      if (_item->>'imei') is not null and length(_item->>'imei')>0 then
        update public.product_imei set status='sold', sale_id=_sale_id, sold_at=now() where organization_id=_org and product_id=_pid and imei=_item->>'imei';
      end if;
    end if;
  end loop;

  for _pay in select * from jsonb_array_elements(coalesce(_payload->'payments','[]'::jsonb))
  loop
    insert into public.sale_payments(organization_id, sale_id, method, amount, installments, fee_amount, reference)
    values (_org, _sale_id, coalesce(_pay->>'method','cash'), coalesce((_pay->>'amount')::numeric,0), coalesce((_pay->>'installments')::int,1), coalesce((_pay->>'fee_amount')::numeric,0), _pay->>'reference');
  end loop;

  insert into public.finance_transactions(organization_id, user_id, type, amount, description, category, payment_method, reference_type, reference_id, transaction_date)
  values (_org, _user, 'income', coalesce((_payload->>'total')::numeric,0), 'Venda #'||_sale_id, 'sales', _payload->>'payment_method', 'sale', _sale_id, now());

  return _sale_id;
end;
$fn$;

grant execute on function public.checkout_sale(jsonb) to authenticated;

create or replace function public.bump_updated_at() returns trigger language plpgsql as $fn$
begin new.updated_at = now(); return new; end;
$fn$;

drop trigger if exists trg_products_upd on public.products;
create trigger trg_products_upd before update on public.products for each row execute function public.bump_updated_at();

drop trigger if exists trg_so_upd on public.service_orders;
create trigger trg_so_upd before update on public.service_orders for each row execute function public.bump_updated_at();

drop trigger if exists trg_customers_upd on public.customers;
create trigger trg_customers_upd before update on public.customers for each row execute function public.bump_updated_at();
`;

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) return new Response(JSON.stringify({ error: "no SUPABASE_DB_URL" }), { status: 500 });
  const client = new Client(url);
  try {
    await client.connect();
    const cleaned = SQL.replace(/^\s*--[^\n]*\n/gm, "");
    const stmts = cleaned.split(/;\s*\n(?=(?:create|alter|drop|insert|do|grant)\b)/i);
    let ran = 0;
    const errors: string[] = [];
    for (const s of stmts) {
      const sql = s.trim().replace(/;$/, "");
      if (!sql) continue;
      try { await client.queryArray(sql); ran++; }
      catch (e: any) {
        const msg = String(e?.message || e);
        if (!/already exists|is already member of publication|duplicate/i.test(msg)) {
          errors.push(`${msg} -- SQL: ${sql.slice(0, 120)}`);
        }
      }
    }
    return new Response(JSON.stringify({ ok: errors.length === 0, ran, errors }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  } finally { try { await client.end(); } catch {} }
});
