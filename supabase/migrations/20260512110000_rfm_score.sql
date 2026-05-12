-- RFM Score (Recency, Frequency, Monetary) — segmentação automática de clientes
-- Cria view que calcula scores 1-5 e categoriza clientes em segmentos.

create or replace view public.customer_rfm as
with sales_agg as (
  select
    c.id as customer_id,
    c.name,
    c.phone,
    c.email,
    c.organization_id,
    coalesce(count(s.id) filter (where s.status <> 'cancelada'), 0) as freq,
    coalesce(sum(s.total_amount) filter (where s.status <> 'cancelada'), 0) as monetary,
    max(s.created_at) filter (where s.status <> 'cancelada') as last_purchase
  from public.customers c
  left join public.sales_orders s on s.customer_id = c.id
  group by c.id, c.name, c.phone, c.email, c.organization_id
),
scored as (
  select *,
    case
      when last_purchase is null then 1
      when last_purchase > now() - interval '30 days' then 5
      when last_purchase > now() - interval '60 days' then 4
      when last_purchase > now() - interval '90 days' then 3
      when last_purchase > now() - interval '180 days' then 2
      else 1
    end as r_score,
    case
      when freq = 0 then 1
      when freq >= 10 then 5
      when freq >= 5 then 4
      when freq >= 3 then 3
      when freq >= 2 then 2
      else 1
    end as f_score,
    case
      when monetary >= 10000 then 5
      when monetary >= 5000 then 4
      when monetary >= 2000 then 3
      when monetary >= 500 then 2
      when monetary > 0 then 1
      else 0
    end as m_score
  from sales_agg
)
select *,
  (r_score + f_score + m_score) as total_score,
  case
    when r_score >= 4 and f_score >= 4 and m_score >= 4 then 'champions'
    when r_score >= 4 and f_score >= 3 then 'loyal'
    when r_score >= 4 and m_score >= 3 then 'big_spender'
    when r_score = 5 and f_score <= 2 then 'new_customer'
    when r_score >= 3 and f_score >= 3 then 'potential_loyal'
    when r_score <= 2 and f_score >= 3 then 'at_risk'
    when r_score <= 2 and m_score >= 4 then 'cant_lose'
    when r_score <= 1 and f_score >= 2 then 'lost'
    when freq = 0 then 'never_bought'
    else 'regular'
  end as segment
from scored;

grant select on public.customer_rfm to authenticated;

comment on view public.customer_rfm is 'RFM segmentation: champions (top), loyal, big_spender, new_customer, potential_loyal, at_risk, cant_lose, lost, regular, never_bought';
