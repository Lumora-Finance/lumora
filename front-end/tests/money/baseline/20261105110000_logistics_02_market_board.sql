-- What the market board needs: spec weights for take-home, declared stock for the flock, and follows.
drop function if exists logistics_board_rows(timestamptz, text);

create function logistics_board_rows(p_now timestamptz, p_commodity text default null)
returns table (
  listing_id uuid, slot_id uuid, buyer text, area text, area_lat numeric, area_lng numeric, price_kobo bigint,
  price_unit text, remaining int, min_qty int, window_start timestamptz, window_end timestamptz,
  delivery_mode delivery_mode, plain_name text, plain_plural text, spec text,
  commodity text, min_weight_kg numeric, max_weight_kg numeric
) language sql stable as $$
  select l.id, s.id, u.name, a.name, a.lat, a.lng, l.unit_price_kobo, c.unit, s.capacity_remaining, l.min_qty,
    s.window_start, s.window_end, l.delivery_mode, coalesce(c.plain_name, c.name), coalesce(c.plain_plural, c.name), l.spec,
    c.name, l.min_unit_weight_kg, l.max_unit_weight_kg
  from demand_listings l
  join users u on u.id = l.buyer_id
  join commodities c on c.id = l.commodity_id
  join areas a on a.id = l.area_id
  join lateral (
    select * from slots sl
    where sl.listing_id = l.id and sl.status = 'open'
      and (p_now < sl.cutoff_at or (sl.reopened_until is not null and p_now < sl.reopened_until))
    order by sl.date limit 1
  ) s on true
  where l.status = 'active'
    and (p_commodity is null or c.name ilike '%' || p_commodity || '%' or c.plain_name ilike '%' || p_commodity || '%'
      or c.plain_plural ilike '%' || p_commodity || '%')
  order by l.unit_price_kobo desc, s.date;
$$;

create or replace function logistics_board(p_farmer uuid, p_now timestamptz default now()) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'farmer_area', (select jsonb_build_object('name', a.name, 'lat', a.lat, 'lng', a.lng)
      from users u join areas a on a.id = u.area_id where u.id = p_farmer),
    'rows', coalesce((select jsonb_agg(to_jsonb(r)) from logistics_board_rows(p_now) r), '[]'),
    -- Stock declared for the soonest day still to come, per commodity.
    'stock', coalesce((select jsonb_object_agg(x.name, x.qty_declared) from (
      select distinct on (c.name) c.name, s.qty_declared
      from producer_stock s join commodities c on c.id = s.commodity_id
      where s.farmer_id = p_farmer and s.date >= (p_now at time zone 'Africa/Lagos')::date
      order by c.name, s.date
    ) x), '{}'),
    'follows', coalesce((select jsonb_agg(c.name) from commodity_follows f join commodities c on c.id = f.commodity_id
      where f.farmer_id = p_farmer), '[]'));
$$;

create or replace function logistics_follow_commodity(p_farmer uuid, p_commodity text) returns jsonb
language plpgsql as $$
declare
  c uuid;
begin
  select id into c from commodities where name = p_commodity;
  if c is null then return money_fail('unknown_commodity'); end if;
  insert into commodity_follows (farmer_id, commodity_id) values (p_farmer, c) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- "We'll text you when one posts": followers in the buyer's area hear about each new day of demand.
create or replace function logistics_notify_followers() returns trigger language plpgsql as $$
declare
  l demand_listings;
  c commodities;
  buyer users;
  place areas;
  farmer record;
begin
  select * into l from demand_listings where id = new.listing_id;
  if l.area_id is null then return new; end if;
  select * into c from commodities where id = l.commodity_id;
  select * into buyer from users where id = l.buyer_id;
  select * into place from areas where id = l.area_id;

  for farmer in
    select u.phone from commodity_follows f join users u on u.id = f.farmer_id
    where f.commodity_id = l.commodity_id and u.area_id = l.area_id and u.id <> l.buyer_id
    order by u.created_at limit 100
  loop
    perform money_sms(farmer.phone, format('%s in %s wants %s. Send BUYERS %s to see the price.',
      buyer.name, place.name, coalesce(c.plain_plural, c.name), upper(coalesce(c.plain_name, c.name))));
  end loop;
  return new;
end $$;

drop trigger if exists slots_notify_followers on slots;
create trigger slots_notify_followers after insert on slots
  for each row execute function logistics_notify_followers();

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'logistics\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
