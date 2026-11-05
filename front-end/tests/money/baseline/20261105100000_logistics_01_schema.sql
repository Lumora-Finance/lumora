-- Delivery logistics and location capture. Lumora doesn't run transport: the farmer delivers or the
-- buyer collects. Exact locations live in tables no client can read. See docs/logistics.md.
do $$ begin
  create type delivery_mode as enum ('farmer_delivers', 'buyer_collects');
exception when duplicate_object then null; end $$;

create table if not exists areas (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  -- The order farmers see areas in, on the SMS menu and the area grid.
  position int not null
);

-- Keep in step with lib/logistics/areas.ts. A test fails if they differ.
insert into areas (name, lat, lng, position) values
  ('Bukuru', 9.799912, 8.866667, 1),
  ('Barkin Ladi', 9.533000, 8.900000, 2),
  ('Rayfield', 9.839666, 8.912744, 3),
  ('Angwan Rukuba', 9.929486, 8.909463, 4),
  ('Tudun Wada', 9.897599, 8.871352, 5),
  ('Beach Road', 9.905000, 8.900000, 6),
  ('Farin Gada', 9.959185, 8.868421, 7),
  ('Terminus', 9.919084, 8.889830, 8),
  ('Bauchi Road', 9.936327, 8.893449, 9),
  ('Angwan Rogo', 9.946083, 8.888239, 10)
on conflict (name) do update set lat = excluded.lat, lng = excluded.lng, position = excluded.position;

alter table users add column if not exists area_id uuid references areas (id);

-- Exact location. Nobody reads this directly except the service role.
create table if not exists user_locations (
  user_id uuid primary key references users (id) on delete cascade,
  area_id uuid not null references areas (id),
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  address text,
  location_source text not null check (location_source in ('device_gps', 'agent_gps', 'area_pick', 'sms_area')),
  location_accuracy_m numeric(8, 1),
  captured_by uuid references users (id),
  updated_at timestamptz not null default now()
);

alter table commodities
  add column if not exists latest_window_end time,
  add column if not exists max_units_per_crate int check (max_units_per_crate > 0),
  add column if not exists plain_name text,
  add column if not exists plain_plural text;

insert into commodities (name, unit, latest_window_end, max_units_per_crate, plain_name, plain_plural) values
  ('Live broilers', 'kg', '11:00', 10, 'chicken', 'chickens'),
  ('Turkey', 'kg', '11:00', 10, 'turkey', 'turkeys'),
  ('Tomatoes', 'basket', null, null, 'basket of tomatoes', 'baskets of tomatoes'),
  ('Eggs', 'crate', null, null, 'crate of eggs', 'crates of eggs')
on conflict (name) do update set unit = excluded.unit, latest_window_end = excluded.latest_window_end,
  max_units_per_crate = excluded.max_units_per_crate, plain_name = excluded.plain_name, plain_plural = excluded.plain_plural;

alter table demand_listings
  add column if not exists delivery_mode delivery_mode not null default 'farmer_delivers',
  add column if not exists area_id uuid references areas (id),
  add column if not exists window_start time,
  add column if not exists window_end time;

-- Apart from demand_listings, because the whole of that table is public for the board.
create table if not exists listing_private (
  listing_id uuid primary key references demand_listings (id) on delete cascade,
  delivery_address text
);

alter table sms_menus add column if not exists slot_id uuid references slots (id);

create table if not exists sms_onboarding (
  phone text primary key,
  step text not null check (step in ('name', 'area')),
  name text,
  page int not null default 0,
  updated_at timestamptz not null default now()
);

-- Live birds can't wait in the heat, whatever a form sends.
create or replace function logistics_window_problem(p_commodity uuid, p_window_end time)
returns time language sql stable as $$
  select latest_window_end from commodities
  where id = p_commodity and latest_window_end is not null and p_window_end > latest_window_end;
$$;

create or replace function logistics_check_listing_window() returns trigger language plpgsql as $$
begin
  if new.window_end is not null and logistics_window_problem(new.commodity_id, new.window_end) is not null then
    raise exception 'window_too_late';
  end if;
  return new;
end $$;

drop trigger if exists demand_listings_window on demand_listings;
create trigger demand_listings_window before insert or update on demand_listings
  for each row execute function logistics_check_listing_window();

-- The fixed decline reasons. Keep in step with lib/logistics/decline.ts.
create or replace function logistics_decline_problem(p_units_declined int, p_reasons jsonb)
returns text language plpgsql immutable as $$
declare
  item jsonb;
  reason text;
begin
  if p_units_declined = 0 then return null; end if;
  if jsonb_typeof(coalesce(p_reasons, 'null')) <> 'array' or jsonb_array_length(p_reasons) <> p_units_declined then
    return 'reason_per_unit_required';
  end if;
  for item in select * from jsonb_array_elements(p_reasons) loop
    reason := item ->> 'reason';
    if reason is null or reason not in ('dead_on_arrival', 'underweight', 'overweight_or_bloated',
        'sick_or_injured', 'outside_spec', 'other') then
      return 'invalid_reason';
    end if;
    if reason = 'other' and coalesce(btrim(item ->> 'note'), '') = '' then return 'note_required'; end if;
    if reason in ('dead_on_arrival', 'sick_or_injured') and coalesce(item ->> 'photo_url', '') = '' then
      return 'photo_required';
    end if;
  end loop;
  return null;
end $$;

-- A backstop, so no route can write a delivery that breaks these rules.
create or replace function logistics_check_delivery() returns trigger language plpgsql as $$
declare
  problem text := logistics_decline_problem(new.units_declined, new.decline_reasons);
begin
  if problem is not null then raise exception 'decline_%', problem; end if;
  return new;
end $$;

drop trigger if exists deliveries_decline_rules on deliveries;
create trigger deliveries_decline_rules before insert or update on deliveries
  for each row execute function logistics_check_delivery();

-- Returns a rule failure rather than raising, then leaves settlement to the existing function.
create or replace function logistics_record_delivery(
  p_booking uuid, p_buyer uuid, p_units_received int, p_units_declined int, p_decline_reasons jsonb,
  p_measured_kg numeric, p_scale_photos text[], p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  problem text := logistics_decline_problem(p_units_declined, p_decline_reasons);
begin
  if problem is not null then return money_fail(problem); end if;
  return money_record_delivery(p_booking, p_buyer, p_units_received, p_units_declined, p_decline_reasons,
    p_measured_kg, p_scale_photos, p_now);
end $$;

create or replace function logistics_areas() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'lat', lat, 'lng', lng) order by position), '[]') from areas;
$$;

-- Signing up with Firebase creates no row here, and nothing can be booked without one.
create or replace function logistics_save_profile(
  p_firebase_uid text, p_name text, p_phone text, p_role text
) returns jsonb language plpgsql as $$
declare
  u users;
begin
  if p_role not in ('farmer', 'buyer') then return money_fail('invalid_role'); end if;
  if exists (select 1 from users where phone = p_phone and firebase_uid is distinct from p_firebase_uid) then
    return money_fail('phone_in_use');
  end if;
  insert into users (firebase_uid, name, phone, role) values (p_firebase_uid, p_name, p_phone, p_role)
  on conflict (firebase_uid) do update set name = excluded.name, phone = excluded.phone
  returning * into u;
  return jsonb_build_object('ok', true, 'id', u.id, 'role', u.role);
end $$;

create or replace function logistics_save_location(
  p_user uuid, p_area text, p_lat numeric, p_lng numeric, p_source text, p_accuracy numeric,
  p_address text default null, p_captured_by uuid default null, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  a areas;
  uses_centroid boolean := p_source in ('area_pick', 'sms_area');
begin
  select * into a from areas where name = p_area;
  if not found then return money_fail('unknown_area'); end if;
  if not uses_centroid and (p_lat is null or p_lng is null) then return money_fail('coordinates_required'); end if;

  insert into user_locations (user_id, area_id, lat, lng, address, location_source, location_accuracy_m, captured_by, updated_at)
  values (p_user, a.id,
    case when uses_centroid then a.lat else p_lat end,
    case when uses_centroid then a.lng else p_lng end,
    nullif(btrim(p_address), ''), p_source, case when uses_centroid then null else p_accuracy end, p_captured_by, p_now)
  on conflict (user_id) do update set area_id = excluded.area_id, lat = excluded.lat, lng = excluded.lng,
    address = coalesce(excluded.address, user_locations.address), location_source = excluded.location_source,
    location_accuracy_m = excluded.location_accuracy_m, captured_by = excluded.captured_by, updated_at = excluded.updated_at;

  update users set area_id = a.id, area = a.name where id = p_user;
  return jsonb_build_object('ok', true, 'area', a.name);
end $$;

create or replace function logistics_my_profile(p_user uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'phone', u.phone, 'area', a.name,
    'address', l.address, 'location_source', l.location_source)
  from users u left join user_locations l on l.user_id = u.id left join areas a on a.id = l.area_id
  where u.id = p_user;
$$;

create or replace function logistics_agent_add_farmer(
  p_agent uuid, p_name text, p_phone text, p_area text, p_lat numeric, p_lng numeric, p_accuracy numeric,
  p_address text default null, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  farmer uuid;
begin
  if not exists (select 1 from users where id = p_agent and role in ('agent', 'admin')) then
    return money_fail('not_an_agent');
  end if;
  if exists (select 1 from users where phone = p_phone) then return money_fail('phone_in_use'); end if;
  insert into users (name, phone, role) values (p_name, p_phone, 'farmer') returning id into farmer;
  return logistics_save_location(farmer, p_area, p_lat, p_lng,
    case when p_lat is null then 'area_pick' else 'agent_gps' end, p_accuracy, p_address, p_agent, p_now)
    || jsonb_build_object('farmer_id', farmer);
end $$;

create or replace function logistics_create_listing(
  p_buyer uuid, p_commodity text, p_unit_price_kobo bigint, p_capacity int, p_min_qty int,
  p_min_weight numeric, p_max_weight numeric, p_mode text, p_date date, p_window_start time, p_window_end time,
  p_cutoff_hours int, p_address text, p_spec text, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  c commodities;
  buyer_area uuid;
  listing_id uuid;
  slot_id uuid;
  latest time;
  starts timestamptz;
  full_spec text;
begin
  if not exists (select 1 from users where id = p_buyer and role = 'buyer') then return money_fail('not_a_buyer'); end if;
  select * into c from commodities where name = p_commodity;
  if not found then return money_fail('unknown_commodity'); end if;
  select area_id into buyer_area from user_locations where user_id = p_buyer;
  if buyer_area is null then return money_fail('location_required'); end if;

  if p_unit_price_kobo is null or p_unit_price_kobo <= 0 or p_capacity is null or p_capacity <= 0
     or p_min_qty is null or p_min_qty <= 0 or p_min_qty > p_capacity then
    return money_fail('invalid_numbers');
  end if;
  if p_min_weight is null or p_max_weight is null or p_min_weight <= 0 or p_max_weight < p_min_weight then
    return money_fail('invalid_weights');
  end if;
  if p_mode not in ('farmer_delivers', 'buyer_collects') then return money_fail('invalid_mode'); end if;
  if p_mode = 'farmer_delivers' and coalesce(btrim(p_address), '') = '' then return money_fail('address_required'); end if;
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then return money_fail('invalid_window'); end if;

  latest := logistics_window_problem(c.id, p_window_end);
  if latest is not null then
    return money_fail('window_too_late', jsonb_build_object('latest', to_char(latest, 'HH24:MI')));
  end if;

  starts := (p_date + p_window_start) at time zone 'Africa/Lagos';
  if starts - make_interval(hours => p_cutoff_hours) <= p_now then return money_fail('too_soon'); end if;

  full_spec := concat_ws(' ', nullif(btrim(p_spec), ''),
    case when c.max_units_per_crate is not null then format('Up to %s per crate.', c.max_units_per_crate) end);

  insert into demand_listings (buyer_id, commodity_id, spec, unit_price_kobo, capacity_per_day, cutoff_hours, min_qty,
    min_unit_weight_kg, max_unit_weight_kg, delivery_mode, area_id, window_start, window_end)
  values (p_buyer, c.id, full_spec, p_unit_price_kobo, p_capacity, p_cutoff_hours, p_min_qty, p_min_weight, p_max_weight,
    p_mode::delivery_mode, buyer_area, p_window_start, p_window_end)
  returning id into listing_id;

  insert into listing_private (listing_id, delivery_address)
  values (listing_id, case when p_mode = 'farmer_delivers' then btrim(p_address) end);

  insert into slots (listing_id, date, window_start, window_end, cutoff_at, capacity_total, capacity_remaining)
  values (listing_id, p_date, starts, (p_date + p_window_end) at time zone 'Africa/Lagos',
    starts - make_interval(hours => p_cutoff_hours), p_capacity, p_capacity)
  returning id into slot_id;

  return jsonb_build_object('ok', true, 'listing_id', listing_id, 'slot_id', slot_id, 'spec', full_spec);
end $$;

-- Area names and centroids only. lib/geo.ts works out the distance from these.
create or replace function logistics_board_rows(p_now timestamptz, p_commodity text default null)
returns table (
  listing_id uuid, slot_id uuid, buyer text, area text, area_lat numeric, area_lng numeric, price_kobo bigint,
  price_unit text, remaining int, min_qty int, window_start timestamptz, window_end timestamptz,
  delivery_mode delivery_mode, plain_name text, plain_plural text, spec text
) language sql stable as $$
  select l.id, s.id, u.name, a.name, a.lat, a.lng, l.unit_price_kobo, c.unit, s.capacity_remaining, l.min_qty,
    s.window_start, s.window_end, l.delivery_mode, coalesce(c.plain_name, c.name), coalesce(c.plain_plural, c.name), l.spec
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
    'rows', coalesce((select jsonb_agg(to_jsonb(r)) from logistics_board_rows(p_now) r), '[]'));
$$;

-- The other party's phone, address and pin, only for someone on a live booking between them.
create or replace function logistics_booking_contact(p_booking uuid, p_viewer uuid) returns jsonb
language plpgsql stable as $$
declare
  b bookings;
  other uuid;
  person users;
  loc user_locations;
  the_listing uuid;
  mode delivery_mode;
  listing_address text;
  address text;
begin
  select * into b from bookings where id = p_booking;
  if not found or p_viewer is null or p_viewer not in (b.farmer_id, b.buyer_id) then
    return money_fail('not_your_booking');
  end if;
  if b.status in ('released', 'cancelled', 'no_show') then return money_fail('booking_not_active'); end if;

  other := case when p_viewer = b.farmer_id then b.buyer_id else b.farmer_id end;
  select * into strict person from users where id = other;
  select * into loc from user_locations where user_id = other;
  select s.listing_id into strict the_listing from slots s where s.id = b.slot_id;
  select l.delivery_mode into strict mode from demand_listings l where l.id = the_listing;
  select p.delivery_address into listing_address from listing_private p where p.listing_id = the_listing;

  -- A farmer delivering goes to the listing's address. Otherwise it's the person's own.
  address := case when p_viewer = b.farmer_id then coalesce(listing_address, loc.address) else loc.address end;

  return jsonb_build_object('ok', true, 'name', person.name, 'phone', person.phone, 'address', address,
    'lat', loc.lat, 'lng', loc.lng, 'delivery_mode', mode);
end $$;

create or replace function logistics_my_bookings(p_viewer uuid) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'code', b.code, 'qty', b.qty, 'status', b.status, 'window_start', s.window_start,
    'is_buyer', b.buyer_id = p_viewer, 'arrived', b.arrived_at is not null,
    'commodity', coalesce(c.plain_plural, c.name), 'unit_price_kobo', b.unit_price_kobo,
    'contact', logistics_booking_contact(b.id, p_viewer)
  ) order by s.window_start desc), '[]')
  from bookings b
  join slots s on s.id = b.slot_id
  join demand_listings l on l.id = s.listing_id
  join commodities c on c.id = l.commodity_id
  where p_viewer in (b.farmer_id, b.buyer_id);
$$;

-- SMS sign-up for feature phones.
create or replace function logistics_sms_state(p_phone text) returns jsonb language sql stable as $$
  select to_jsonb(s) from sms_onboarding s where s.phone = p_phone;
$$;

create or replace function logistics_sms_set(p_phone text, p_step text, p_name text, p_page int, p_now timestamptz)
returns void language sql as $$
  insert into sms_onboarding (phone, step, name, page, updated_at) values (p_phone, p_step, p_name, p_page, p_now)
  on conflict (phone) do update set step = excluded.step, name = excluded.name, page = excluded.page, updated_at = excluded.updated_at;
$$;

create or replace function logistics_sms_finish(p_phone text, p_name text, p_area text, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  u uuid;
begin
  select id into u from users where phone = p_phone;
  if u is null then
    insert into users (phone, name, role) values (p_phone, p_name, 'farmer') returning id into u;
  end if;
  delete from sms_onboarding where phone = p_phone;
  return logistics_save_location(u, p_area, null, null, 'sms_area', null, null, null, p_now);
end $$;

-- Distances need the farmer's area, so the list now carries both centroids.
create or replace function money_sms_buyers(p_phone text, p_commodity text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  rows jsonb;
begin
  delete from sms_menus where phone = p_phone;
  with choices as (
    select r.*, row_number() over () as position from (
      select * from logistics_board_rows(p_now, p_commodity) where remaining > 0 limit 5
    ) r
  ), saved as (
    insert into sms_menus (phone, position, listing_id, slot_id, created_at)
    select p_phone, position, listing_id, slot_id, p_now from choices returning 1
  )
  select jsonb_agg(jsonb_build_object('n', position, 'buyer', buyer, 'area', area, 'area_lat', area_lat, 'area_lng', area_lng,
    'price_kobo', price_kobo, 'price_unit', price_unit, 'remaining', remaining, 'window_start', window_start,
    'delivery_mode', delivery_mode) order by position) into rows
  from choices, (select count(*) from saved) s;
  return jsonb_build_object('ok', true, 'rows', coalesce(rows, '[]'),
    'farmer_area', (select jsonb_build_object('lat', a.lat, 'lng', a.lng) from users u join areas a on a.id = u.area_id where u.phone = p_phone));
end $$;

-- With no day, SELL takes the day shown on the list.
create or replace function money_sms_book(p_phone text, p_position int, p_qty int, p_day text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  u users;
  m sms_menus;
  chosen uuid;
begin
  select * into strict u from users where phone = p_phone;
  select * into m from sms_menus where phone = p_phone and position = p_position;
  if not found then return money_fail('no_such_choice'); end if;
  if p_day is null then
    chosen := m.slot_id;
    if chosen is null then
      select id into chosen from slots
      where listing_id = m.listing_id and status = 'open' and date >= (p_now at time zone 'Africa/Lagos')::date
      order by date limit 1;
    end if;
  else
    select id into chosen from slots
    where listing_id = m.listing_id and status = 'open'
      and date >= (p_now at time zone 'Africa/Lagos')::date
      and upper(to_char(date, 'DY')) = upper(left(p_day, 3))
    order by date limit 1;
  end if;
  if chosen is null then return money_fail('no_slot_that_day'); end if;
  return book_slot(chosen, u.id, p_qty, p_now);
end $$;

-- Security. Exact locations, addresses and phones reach clients only through the server.
do $$
declare
  t text;
begin
  foreach t in array array['areas', 'user_locations', 'listing_private', 'sms_onboarding'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

grant select on areas to anon, authenticated;
drop policy if exists read_areas on areas;
create policy read_areas on areas for select using (true);

grant select on user_locations to authenticated;
drop policy if exists own_location on user_locations;
create policy own_location on user_locations for select to authenticated using (user_id = money_current_user());

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

-- Delivery photos. Paths are random, and the bucket only exists on real Supabase.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('delivery-photos', 'delivery-photos', true) on conflict (id) do nothing;
  end if;
end $$;
