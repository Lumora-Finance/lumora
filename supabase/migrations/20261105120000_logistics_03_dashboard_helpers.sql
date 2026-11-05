-- Dashboard helper functions that the front-end API routes expect.
-- These aggregate data already in the DB; they don't introduce new tables.

-- Stats for the dashboard hero strip.
create or replace function logistics_dashboard_stats(p_user uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'active_posts', coalesce((
      select count(*) from demand_listings where buyer_id = p_user and status = 'active'
    ), 0),
    'upcoming_bookings', coalesce((
      select count(*) from bookings b
      join slots s on s.id = b.slot_id
      where p_user in (b.farmer_id, b.buyer_id)
        and b.status in ('booked', 'confirmed')
        and s.window_start >= now()
    ), 0),
    'monthly_kobo', coalesce((
      select sum(net_kobo) from money_settlements
      where farmer_id = p_user
        and created_at >= date_trunc('month', now())
    ), 0),
    'monthly_count', coalesce((
      select count(*) from money_settlements
      where farmer_id = p_user
        and created_at >= date_trunc('month', now())
    ), 0)
  );
$$;

-- Recent settled deliveries for the transactions page.
create or replace function logistics_my_transactions(p_user uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'gross_kobo', s.gross_kobo,
    'fees_kobo', s.fees_kobo,
    'net_kobo', s.net_kobo,
    'kind', s.kind,
    'created_at', s.created_at,
    'booking', case when b.id is not null then jsonb_build_object(
      'code', b.code,
      'slot', case when sl.id is not null then jsonb_build_object(
        'listing', case when l.id is not null then jsonb_build_object(
          'spec', l.spec,
          'commodity', case when c.id is not null then jsonb_build_object('name', c.name, 'unit', c.unit) end,
          'buyer', case when bu.id is not null then jsonb_build_object('id', bu.id, 'name', bu.name) end
        ) end
      ) end,
      'farmer', case when f.id is not null then jsonb_build_object('id', f.id, 'name', f.name) end
    ) end
  ) order by s.created_at desc), '[]')
  from money_settlements s
  left join bookings b on b.id = s.booking_id
  left join slots sl on sl.id = b.slot_id
  left join demand_listings l on l.id = sl.listing_id
  left join commodities c on c.id = l.commodity_id
  left join users bu on bu.id = l.buyer_id
  left join users f on f.id = s.farmer_id
  where s.farmer_id = p_user
  limit 50;
$$;

-- The user's demand listings (posts) for the posts page.
create or replace function logistics_my_listings(p_user uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'spec', l.spec,
    'unit_price_kobo', l.unit_price_kobo,
    'capacity_per_day', l.capacity_per_day,
    'status', l.status,
    'commodity', case when c.id is not null then jsonb_build_object('id', c.id, 'name', c.name, 'unit', c.unit) end
  ) order by l.created_at desc), '[]')
  from demand_listings l
  left join commodities c on c.id = l.commodity_id
  where l.buyer_id = p_user;
$$;

-- Grant execute to service_role only.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('logistics_dashboard_stats', 'logistics_my_transactions', 'logistics_my_listings')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
