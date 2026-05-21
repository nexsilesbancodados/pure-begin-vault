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
as $$
declare
  _atacado_id constant uuid := 'e4fd1ef2-7bb1-4c9d-b4de-47aa80ebbf4b';
  _target_org_id uuid;
  _next_number integer;
  _new_id uuid;
  _attempt integer := 0;
  _prazo_iso date := (current_date + (coalesce(_prazo_dias, 7) || ' days')::interval)::date;
begin
  if _source_org_id is null or _source_org_id <> _atacado_id then
    raise exception 'Origem invalida para nota de parceiro';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = _source_org_id and user_id = auth.uid()
  ) then
    raise exception 'Sem permissao na loja de origem';
  end if;

  _target_org_id := case lower(coalesce(_partner_key, ''))
    when 'premier_castanhal' then '38ad6ed8-27bd-48ff-854d-0ac395f494a3'::uuid
    when 'alfatech_curuca'   then '6e25fb98-1b6d-4e8f-b321-bbf4bf63eb10'::uuid
    else null
  end;

  if _target_org_id is null then
    raise exception 'Parceiro desconhecido: %', _partner_key;
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
        _target_org_id, _next_number, 'compra', 'Atacado Cell (parceiro)',
        _customer_name, array[_sale_id], _items, _total,
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
$$;

revoke all on function public.create_partner_purchase_note(uuid, text, text, uuid, jsonb, numeric, integer) from public;
grant execute on function public.create_partner_purchase_note(uuid, text, text, uuid, jsonb, numeric, integer) to authenticated;
