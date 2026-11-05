-- What the booking pages, the board, the admin queue and email action links read and call.

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
  if b.status in ('released', 'cancelled', 'no_show', 'declined') then return money_fail('booking_not_active'); end if;

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

-- One booking, as one side sees it. The delivery code only ever goes to the buyer.
create or replace function money_booking_view(p_booking uuid, p_viewer uuid) returns jsonb language plpgsql stable as $$
declare
  b bookings;
  s slots;
  facts jsonb;
  is_buyer boolean;
  req backup_requests;
  report code_reports;
  d deliveries;
  plain_code text;
begin
  select * into b from bookings where id = p_booking;
  if not found or p_viewer is null or p_viewer not in (b.farmer_id, b.buyer_id) then
    return money_fail('not_your_booking');
  end if;
  is_buyer := p_viewer = b.buyer_id;
  select * into strict s from slots where id = b.slot_id;
  facts := money_booking_facts(b);
  select * into req from backup_requests where booking_id = b.id;
  select * into report from code_reports where booking_id = b.id;
  select * into d from deliveries where booking_id = b.id;
  if is_buyer and b.status in ('booked', 'confirmed', 'contested') and b.arrived_at is null then
    select code into plain_code from booking_codes where booking_id = b.id;
  end if;

  return facts || jsonb_build_object(
    'ok', true, 'id', b.id, 'role', case when is_buyer then 'buyer' else 'farmer' end,
    'status', b.status, 'closed_reason', b.closed_reason, 'reserve_kobo', b.reserve_kobo,
    'approval_deadline', b.approval_deadline, 'confirm_deadline', b.confirm_deadline,
    'arrived_at', b.arrived_at, 'late_notice_at', b.late_notice_at, 'late_expected_at', b.late_expected_at,
    'late_check_at', b.late_check_at, 'keep_waiting_at', b.keep_waiting_at,
    'code_locked', b.code_locked_at is not null, 'is_backup', b.backup_request_id is not null,
    'no_show_at', b.window_end + make_interval(hours => money_rule('NO_SHOW_GRACE_HOURS')::int),
    'no_code_until', b.window_end + make_interval(hours => money_rule('NOCODE_GRACE_HOURS')::int),
    'record_by', b.arrived_at + make_interval(hours => money_rule('BUYER_RECORD_HOURS')::int),
    'delivery_code', plain_code,
    'contact', logistics_booking_contact(b.id, p_viewer),
    'reliability', money_farmer_reliability(b.farmer_id),
    'delivery', case when d.id is null then null else jsonb_build_object(
      'measured_kg', d.measured_kg, 'gross_kobo', d.gross_kobo, 'units_received', d.units_received,
      'units_declined', d.units_declined, 'scale_photo', d.scale_photo_urls[1],
      'reply_deadline', d.reply_deadline, 'farmer_reply', d.farmer_reply) end,
    'settlement', (select jsonb_build_object('gross_kobo', sum(gross_kobo), 'fees_kobo', sum(fees_kobo),
        'farmer_fee_kobo', sum(farmer_fee_kobo), 'net_kobo', sum(net_kobo))
      from money_settlements where booking_id = b.id having count(*) > 0),
    'payout_status', (select case when bool_and(p.status = 'paid') then 'paid' else 'sending' end
      from money_payouts p join money_settlements st on st.id = p.settlement_id where st.booking_id = b.id having count(*) > 0),
    'report', case when report.id is null then null else jsonb_build_object(
      'status', report.status, 'buyer_deadline_at', report.buyer_deadline_at, 'decision', report.decision) end,
    'backup', case when req.id is null then null else jsonb_build_object(
      'status', req.status, 'qty', req.qty, 'price_kobo', req.price_kobo, 'deadline_at', req.deadline_at,
      'remaining', (select capacity_remaining from slots where id = req.slot_id)) end);
end $$;

create or replace function logistics_my_bookings(p_viewer uuid) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'code', b.code, 'qty', b.qty, 'status', b.status, 'window_start', s.window_start,
    'is_buyer', b.buyer_id = p_viewer, 'arrived', b.arrived_at is not null,
    'commodity', coalesce(c.plain_plural, c.name), 'unit_price_kobo', b.unit_price_kobo,
    'farmer', f.name, 'reliability', money_farmer_reliability(b.farmer_id),
    'contact', logistics_booking_contact(b.id, p_viewer)
  ) order by s.window_start desc), '[]')
  from bookings b
  join users f on f.id = b.farmer_id
  join slots s on s.id = b.slot_id
  join demand_listings l on l.id = s.listing_id
  join commodities c on c.id = l.commodity_id
  where p_viewer in (b.farmer_id, b.buyer_id);
$$;

-- Backup requests are on everyone's board, and pinned for those who were told about them.
drop function if exists logistics_board_rows(timestamptz, text);
create function logistics_board_rows(p_now timestamptz, p_commodity text default null)
returns table (
  listing_id uuid, slot_id uuid, buyer text, area text, area_lat numeric, area_lng numeric, price_kobo bigint,
  price_unit text, remaining int, min_qty int, window_start timestamptz, window_end timestamptz,
  delivery_mode delivery_mode, plain_name text, plain_plural text, spec text,
  commodity text, min_weight_kg numeric, max_weight_kg numeric, urgent boolean
) language sql stable as $$
  select l.id, s.id, u.name, a.name, a.lat, a.lng, l.unit_price_kobo, c.unit, s.capacity_remaining, l.min_qty,
    s.window_start, s.window_end, l.delivery_mode, coalesce(c.plain_name, c.name), coalesce(c.plain_plural, c.name), l.spec,
    c.name, l.min_unit_weight_kg, l.max_unit_weight_kg, l.backup_of_booking is not null
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
      where f.farmer_id = p_farmer), '[]'),
    'pinned', coalesce((select jsonb_agg(r.slot_id) from backup_notified n
      join backup_requests r on r.id = n.request_id
      where n.farmer_id = p_farmer and r.status = 'open'), '[]'),
    'reliability', money_farmer_reliability(p_farmer),
    'completed_deliveries', (select count(*) from bookings where farmer_id = p_farmer and status = 'settled'));
$$;

-- The flock on the board. It stands for the coming week, so a backup request can find this farmer on
-- whichever day one is needed.
create or replace function logistics_declare_stock(p_farmer uuid, p_commodity text, p_qty int, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  c uuid;
  today date := (p_now at time zone 'Africa/Lagos')::date;
begin
  if p_qty is null or p_qty < 0 then return money_fail('invalid_quantity'); end if;
  select id into c from commodities where name = p_commodity;
  if c is null then return money_fail('unknown_commodity'); end if;
  insert into producer_stock (farmer_id, commodity_id, date, qty_declared)
  select p_farmer, c, today + offs, p_qty from generate_series(0, 6) offs
  on conflict (farmer_id, commodity_id, date) do update set qty_declared = excluded.qty_declared;
  return jsonb_build_object('ok', true);
end $$;

-- Followers hear about each new day of demand, now by email and in the app.
create or replace function logistics_notify_followers() returns trigger language plpgsql as $$
declare
  l demand_listings;
  c commodities;
  buyer users;
  place areas;
  farmer record;
begin
  select * into l from demand_listings where id = new.listing_id;
  if l.area_id is null or l.backup_of_booking is not null then return new; end if;
  select * into c from commodities where id = l.commodity_id;
  select * into buyer from users where id = l.buyer_id;
  select * into place from areas where id = l.area_id;

  for farmer in
    select f.farmer_id from commodity_follows f join users u on u.id = f.farmer_id
    where f.commodity_id = l.commodity_id and u.area_id = l.area_id and u.id <> l.buyer_id
    order by u.created_at limit 100
  loop
    perform money_notify(farmer.farmer_id, 'new_demand', null, jsonb_build_object(
      'buyer', buyer.name, 'area', place.name, 'goods', coalesce(c.goods_plural, c.plain_plural, c.name),
      'price_kobo', l.unit_price_kobo, 'price_unit', c.unit), now());
  end loop;
  return new;
end $$;

create or replace function money_admin_code_reports() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(row order by (row ->> 'ops_deadline_at')), '[]') from (
    select jsonb_build_object(
      'id', r.id, 'ops_deadline_at', r.ops_deadline_at, 'reported_at', r.created_at,
      'booking', jsonb_build_object('id', b.id, 'code', b.code, 'qty', b.qty, 'reserve_kobo', b.reserve_kobo,
        'unit_price_kobo', b.unit_price_kobo),
      'window_start', s.window_start, 'window_end', b.window_end,
      'fee_kobo', money_round_kobo(money_booking_minimum(b) * money_rule('LATE_CANCEL_FEE_PCT') / 100),
      'farmer', jsonb_build_object('name', f.name, 'phone', f.phone),
      'buyer', jsonb_build_object('name', u.name, 'phone', u.phone)
    ) as row
    from code_reports r
    join bookings b on b.id = r.booking_id
    join slots s on s.id = b.slot_id
    join users f on f.id = b.farmer_id
    join users u on u.id = b.buyer_id
    where r.status = 'ops'
  ) q;
$$;

-- Email action links. Opening a link only reads this. Nothing changes until the one button is pressed.
create or replace function money_action_preview(p_token uuid, p_user uuid, p_now timestamptz default now())
returns jsonb language plpgsql stable as $$
declare
  t action_tokens;
  b bookings;
begin
  select * into t from action_tokens where id = p_token;
  if not found then return money_fail('token_not_found'); end if;
  if t.user_id <> p_user then return money_fail('not_yours'); end if;
  if t.used_at is not null then return money_fail('used', jsonb_build_object('booking_id', t.booking_id)); end if;
  if p_now >= t.expires_at then return money_fail('expired', jsonb_build_object('booking_id', t.booking_id)); end if;
  select * into strict b from bookings where id = t.booking_id;
  return jsonb_build_object('ok', true, 'action', t.action, 'expires_at', t.expires_at, 'booking_id', t.booking_id,
    'status', b.status, 'facts', money_booking_facts(b));
end $$;

-- The one button. The token is spent only if the action worked, so a rule failure can be retried
-- until the link expires, and a double click can't run it twice.
create or replace function money_action_perform(
  p_token uuid, p_user uuid, p_claim_kg numeric default null, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  t action_tokens;
  result jsonb;
begin
  select * into t from action_tokens where id = p_token for update;
  if not found then return money_fail('token_not_found'); end if;
  if t.user_id <> p_user then return money_fail('not_yours'); end if;
  if t.used_at is not null then return money_fail('used', jsonb_build_object('booking_id', t.booking_id)); end if;
  if p_now >= t.expires_at then return money_fail('expired', jsonb_build_object('booking_id', t.booking_id)); end if;

  result := case t.action
    when 'confirm' then money_confirm_booking(t.booking_id, p_user, p_now)
    when 'cancel_farmer' then money_cancel_farmer(t.booking_id, p_user, p_now)
    when 'approve' then money_answer_approval(t.booking_id, p_user, 'approve', p_now)
    when 'decline' then money_answer_approval(t.booking_id, p_user, 'decline', p_now)
    when 'find_backup' then money_request_backup(t.booking_id, p_user, null, null, p_now)
    when 'keep_waiting' then money_keep_waiting(t.booking_id, p_user, p_now)
    when 'confirm_weight' then money_farmer_reply(t.booking_id, p_user, 'yes', null, p_now)
    when 'dispute' then money_farmer_reply(t.booking_id, p_user, 'dispute', p_claim_kg, p_now)
    else money_fail('unknown_action')
  end;

  if (result ->> 'ok')::boolean then
    update action_tokens set used_at = p_now where id = t.id;
    perform money_event('action_token', t.id, 'used', p_user::text, null, jsonb_build_object('action', t.action, 'booking_id', t.booking_id));
  end if;
  return result || jsonb_build_object('booking_id', t.booking_id);
end $$;

-- Server only, like every other money function.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'money\_%' or p.proname like 'wallet\_%'
      or p.proname like 'logistics\_%' or p.proname = 'book_slot')
      and p.proname <> 'money_current_user'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

create or replace function logistics_my_profile(p_user uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'phone', u.phone, 'area', a.name,
    'address', l.address, 'location_source', l.location_source,
    'approve_first_time_farmers', u.approve_first_time_farmers, 'reliability', money_farmer_reliability(u.id),
    -- The admin panel and profile sync read these.
    'is_admin', u.is_admin, 'verified', u.verified, 'photo_url', u.photo_url, 'display_name', u.display_name, 'email', u.email)
  from users u left join user_locations l on l.user_id = u.id left join areas a on a.id = l.area_id
  where u.id = p_user;
$$;
