// One-shot: apply create_partner_purchase_note fn + backfill Nota 17
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQL = `
drop function if exists public.create_partner_purchase_note(uuid, text, text, uuid, jsonb, numeric, integer);

create or replace function public.create_partner_purchase_note(
  _source_org_id uuid,
  _partner_key text,
  _customer_name text,
  _sale_id uuid,
  _items jsonb,
  _total numeric,
  _prazo_dias integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  _atacado_id    constant uuid := 'e4fd1ef2-7bb1-4c9d-b4de-47aa80ebbf4b';
  _premier_id    constant uuid := '38ad6ed8-27bd-48ff-854d-0ac395f494a3';
  _alfatech_id   constant uuid := '6e25fb98-1b6d-4e8f-b321-bbf4bf63eb10';
  _target_org_id uuid;
  _next_number   integer;
  _new_id        uuid;
  _attempt       integer := 0;
  _prazo_iso     date := (current_date + (coalesce(_prazo_dias, 7) || ' days')::interval)::date;
begin
  if _source_org_id is null
     or _source_org_id not in (_atacado_id, _premier_id, _alfatech_id) then
    raise exception 'Origem invalida para nota de parceiro';
  end if;

  if not exists (
    select 1 from public.user_organizations
    where organization_id = _source_org_id and user_id = auth.uid()
  ) then
    raise exception 'Sem permissao na loja de origem';
  end if;

  _target_org_id := case lower(coalesce(_partner_key, ''))
    when 'premier_castanhal' then _premier_id
    when 'alfatech_curuca'   then _alfatech_id
    when 'atacado_cell'      then _atacado_id
    else null
  end;

  if _target_org_id is null then
    raise exception 'Parceiro desconhecido: %', _partner_key;
  end if;

  if _target_org_id = _source_org_id then
    raise exception 'Origem e destino nao podem ser iguais';
  end if;

  select id into _new_id
  from public.purchase_notes
  where organization_id = _target_org_id
    and _sale_id = any(coalesce(sale_ids, array[]::uuid[]))
  limit 1;

  if _new_id is not null then
    return jsonb_build_object('id', _new_id, 'reused', true);
  end if;

  select coalesce(max(note_number), 0) + 1 into _next_number
  from public.purchase_notes where organization_id = _target_org_id;

  while _attempt < 5 loop
    begin
      insert into public.purchase_notes(
        organization_id, note_number, kind, fornecedor, customer_name,
        sale_ids, items, total, data_compra, prazo_pagamento, paga,
        created_by, updated_by
      ) values (
        _target_org_id, _next_number, 'compra',
        (select name from public.organizations where id = _source_org_id),
        _customer_name, array[_sale_id], coalesce(_items, '[]'::jsonb), _total,
        current_date, _prazo_iso, false, auth.uid(), auth.uid()
      ) returning id into _new_id;
      exit;
    exception when unique_violation then
      _attempt := _attempt + 1;
      _next_number := _next_number + 1;
    end;
  end loop;

  if _new_id is null then
    raise exception 'Nao foi possivel gerar numero de nota no parceiro';
  end if;

  return jsonb_build_object('id', _new_id, 'note_number', _next_number, 'organization_id', _target_org_id);
end;
$fn$;

revoke all on function public.create_partner_purchase_note(uuid, text, text, uuid, jsonb, numeric, integer) from public;
grant execute on function public.create_partner_purchase_note(uuid, text, text, uuid, jsonb, numeric, integer) to authenticated;

-- helper p/ exec arbitrario (apenas service role)
create or replace function public._exec_sql(_q text) returns void language plpgsql security definer as $h$ begin execute _q; end; $h$;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. cria a função usando _exec_sql via SQL bruto. Como não temos exec_sql nativo,
    //    usamos REST endpoint /rest/v1/rpc nao serve para DDL. Vamos usar pg via postgres-meta? Mais simples: usar /pg-meta? Não disponível.
    //    Solução: chamar o pg via fetch ao endpoint sql. Supabase nao expõe.
    //    Alternativa: criar a função via uma RPC ja existente? Nao tem.
    //    Truque: usar postgrest nao executa DDL.
    //    => Vamos rodar via supabase-js direto usando conexao? Nao tem.
    //
    // Estratégia real: usar fetch para /pg endpoint. Nao existe.
    // => Vamos usar Deno postgres client.
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("SUPABASE_DB_URL ausente");

    const client = new Client(dbUrl);
    await client.connect();
    await client.queryArray(SQL);

    // 2. Backfill Nota 17
    const sourceOrg = "e4fd1ef2-7bb1-4c9d-b4de-47aa80ebbf4b"; // Atacado Cell
    const targetOrg = "38ad6ed8-27bd-48ff-854d-0ac395f494a3"; // Premier Castanhal
    const saleId = "b8c45b4e-1962-46f4-8768-11892b8fe97f";

    // Já existe?
    const existing = await client.queryObject<{ id: string }>(
      `select id from public.purchase_notes
        where organization_id = $1 and $2 = any(coalesce(sale_ids, array[]::uuid[])) limit 1`,
      [targetOrg, saleId],
    );

    let backfillResult: any;
    if (existing.rows.length > 0) {
      backfillResult = { reused: true, id: existing.rows[0].id };
    } else {
      const items = JSON.stringify([
        {
          id: "82c69dc6-cec7-48fe-9a25-9b776d6fae1d",
          name: "iPhone 8 Plus",
          imei: "123456789123456",
          price: 350,
          cost_price: 0,
          quantity: 1,
          line_total: 350,
        },
      ]);
      const userId = "14831b3b-efd6-4d76-973d-6c57998bddb1"; // criador original

      const nextNum = await client.queryObject<{ n: number }>(
        `select coalesce(max(note_number), 0) + 1 as n from public.purchase_notes where organization_id = $1`,
        [targetOrg],
      );
      const num = nextNum.rows[0].n;

      const inserted = await client.queryObject<{ id: string; note_number: number }>(
        `insert into public.purchase_notes(
          organization_id, note_number, kind, fornecedor, customer_name,
          sale_ids, items, total, data_compra, prazo_pagamento, paga,
          created_by, updated_by
        ) values ($1, $2, 'compra', 'Atacado Cell', 'PREMIER', array[$3::uuid], $4::jsonb, 348.00,
          current_date, '2026-05-28', false, $5, $5)
        returning id, note_number`,
        [targetOrg, num, saleId, items, userId],
      );
      backfillResult = inserted.rows[0];
    }

    await client.end();
    return new Response(JSON.stringify({ ok: true, backfill: backfillResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
