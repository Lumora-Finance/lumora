-- Notifications, the email outbox, signed action links, and the facts both are written from.
-- Words live in lib/email/templates. Rows hold only the kind and the facts.

create or replace function money_notify(
  p_user uuid, p_kind text, p_booking uuid, p_data jsonb, p_now timestamptz,
  p_actions text[] default '{}', p_expires timestamptz default null, p_email boolean default true
) returns uuid language plpgsql as $$
declare
  new_id uuid;
  one_action text;
  new_token uuid;
  token_map jsonb := '{}';
  address text;
begin
  if p_user is null then return null; end if;
  insert into notifications (user_id, kind, booking_id, data, created_at)
  values (p_user, p_kind, p_booking, coalesce(p_data, '{}'), p_now)
  returning id into new_id;

  select nullif(btrim(email), '') into address from users where id = p_user;
  if not p_email or address is null then return new_id; end if;

  foreach one_action in array p_actions loop
    insert into action_tokens (user_id, booking_id, action, expires_at, created_at)
    values (p_user, p_booking, one_action, p_expires, p_now)
    returning id into new_token;
    token_map := token_map || jsonb_build_object(one_action,
      jsonb_build_object('id', new_token, 'expires_at', p_expires));
  end loop;

  insert into email_outbox (notification_id, to_email, action_tokens, next_attempt_at, created_at)
  values (new_id, address, token_map, p_now, p_now);
  return new_id;
end $$;

-- Everything a booking's messages need to say. The address is the buyer's, and only farmers on the
-- booking, or the buyer, ever receive this.
create or replace function money_booking_facts(p_booking bookings) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'booking_id', p_booking.id, 'code', p_booking.code, 'qty', p_booking.qty,
    'unit', coalesce(c.unit_plural, c.plain_plural, c.name),
    'goods', coalesce(c.goods_plural, c.plain_plural, c.name),
    'farmer', f.name, 'buyer', u.name, 'area', a.name,
    'price_kobo', p_booking.unit_price_kobo, 'price_unit', c.unit,
    'window_start', s.window_start, 'window_end', p_booking.window_end, 'cutoff_at', s.cutoff_at,
    'capacity_total', s.capacity_total, 'capacity_remaining', s.capacity_remaining,
    'address', p.delivery_address, 'collects', l.delivery_mode = 'buyer_collects')
  from slots s
  join demand_listings l on l.id = s.listing_id
  join commodities c on c.id = l.commodity_id
  join users f on f.id = p_booking.farmer_id
  join users u on u.id = p_booking.buyer_id
  left join areas a on a.id = l.area_id
  left join listing_private p on p.listing_id = l.id
  where s.id = p_booking.slot_id;
$$;

-- booked qty x minimum spec weight x price: what fees are a percentage of.
create or replace function money_booking_minimum(p_booking bookings) returns bigint language sql stable as $$
  select money_round_kobo(p_booking.qty * l.min_unit_weight_kg * p_booking.unit_price_kobo)
  from slots s join demand_listings l on l.id = s.listing_id where s.id = p_booking.slot_id;
$$;

-- Keep in step with lib/geo.ts. A test fails if they differ.
create or replace function money_distance_km(a_lat numeric, a_lng numeric, b_lat numeric, b_lng numeric)
returns int language sql immutable as $$
  select round(2 * 6371 * asin(sqrt(
    power(sin(radians((b_lat - a_lat)::float8) / 2), 2) +
    cos(radians(a_lat::float8)) * cos(radians(b_lat::float8)) * power(sin(radians((b_lng - a_lng)::float8) / 2), 2)
  )) * 1.3)::int;
$$;

-- Farmers near a listing, nearest first. With a date: those with stock left that day. Without one:
-- those who follow the produce. Farmers without a mapped area match on their area's name.
create or replace function money_nearby_farmers(
  p_listing uuid, p_limit int, p_stock_date date default null, p_exclude uuid default null
) returns table (farmer_id uuid, distance_km int) language sql stable as $$
  with place as (
    select l.id, l.commodity_id, l.buyer_id, a.lat, a.lng, u.area as buyer_area
    from demand_listings l join users u on u.id = l.buyer_id left join areas a on a.id = l.area_id
    where l.id = p_listing
  )
  select f.id, money_distance_km(place.lat, place.lng, fa.lat, fa.lng)
  from place
  join users f on f.id <> place.buyer_id and f.id is distinct from p_exclude
  left join areas fa on fa.id = f.area_id
  where (
      money_distance_km(place.lat, place.lng, fa.lat, fa.lng) <= money_rule('NEARBY_KM')
      or (fa.id is null and f.area = place.buyer_area)
    )
    and case when p_stock_date is null
      then exists (select 1 from commodity_follows cf where cf.farmer_id = f.id and cf.commodity_id = place.commodity_id)
      else exists (
        select 1 from producer_stock ps
        where ps.farmer_id = f.id and ps.commodity_id = place.commodity_id and ps.date = p_stock_date
          and ps.qty_declared > (
            select coalesce(sum(b.qty), 0) from bookings b
            join slots bs on bs.id = b.slot_id join demand_listings bl on bl.id = bs.listing_id
            where b.farmer_id = f.id and bs.date = p_stock_date and bl.commodity_id = place.commodity_id
              and b.status in ('pending_approval', 'booked', 'confirmed', 'contested', 'delivered', 'disputed', 'settled'))
      ) end
  order by 2 nulls last, f.created_at
  limit p_limit;
$$;

-- "18 of 19 on time". Every delivery and every no-show counts; a code entered after the window doesn't
-- count as on time.
create or replace function money_farmer_reliability(p_farmer uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'on_time', count(*) filter (where arrived_at is not null and arrived_at <= window_end),
    'total', count(*) filter (where arrived_at is not null or status = 'no_show'))
  from bookings where farmer_id = p_farmer;
$$;

create or replace function money_set_email(p_user uuid, p_email text) returns void language sql as $$
  update users set email = nullif(lower(btrim(p_email)), '') where id = p_user;
$$;

create or replace function money_set_approve_first_time(p_buyer uuid, p_on boolean) returns jsonb language plpgsql as $$
begin
  update users set approve_first_time_farmers = p_on where id = p_buyer;
  perform money_event('user', p_buyer, 'approve_first_time_farmers', p_buyer::text, null, jsonb_build_object('on', p_on));
  return jsonb_build_object('ok', true, 'on', p_on);
end $$;

-- The email job. Two runs can't claim one message. A run that died mid-send is picked up again, and
-- the send uses the row id as its idempotency key, so that can't deliver twice.
create or replace function money_email_claim(p_now timestamptz default now(), p_limit int default 50)
returns jsonb language plpgsql as $$
declare
  claimed jsonb;
begin
  with next_up as (
    select id from email_outbox
    where (status = 'queued' and next_attempt_at <= p_now)
       or (status = 'sending' and claimed_at < p_now - interval '15 minutes')
    order by created_at limit p_limit for update skip locked
  ), updated as (
    update email_outbox o set status = 'sending', claimed_at = p_now, attempts = attempts + 1
    from next_up where o.id = next_up.id returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'to', u.to_email, 'kind', n.kind, 'data', n.data,
    'booking_id', n.booking_id, 'created_at', n.created_at, 'action_tokens', u.action_tokens)), '[]') into claimed
  from updated u join notifications n on n.id = u.notification_id;
  return claimed;
end $$;

create or replace function money_email_sent(p_id uuid, p_now timestamptz default now()) returns void language sql as $$
  update email_outbox set status = 'sent', sent_at = p_now, last_error = null where id = p_id;
$$;

create or replace function money_email_failed(p_id uuid, p_error text, p_now timestamptz default now())
returns void language plpgsql as $$
declare
  o email_outbox;
begin
  select * into strict o from email_outbox where id = p_id for update;
  if o.attempts >= money_rule('EMAIL_MAX_ATTEMPTS') then
    update email_outbox set status = 'failed', last_error = p_error where id = p_id;
    perform money_alert('email_failed', jsonb_build_object('email_id', p_id, 'error', p_error));
  else
    update email_outbox set status = 'queued', last_error = p_error,
      next_attempt_at = p_now + make_interval(mins => (money_rule('EMAIL_RETRY_MINUTES')::int) * (2 ^ (o.attempts - 1))::int)
    where id = p_id;
  end if;
end $$;

-- The bell. Newest first, at most 30.
create or replace function money_notifications(p_user uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'unread', (select count(*) from notifications where user_id = p_user and read_at is null),
    'items', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
      select id, kind, booking_id, data, read_at, created_at from notifications
      where user_id = p_user order by created_at desc limit 30
    ) r), '[]'));
$$;

-- One notification, or with no id, all of them.
create or replace function money_notifications_read(p_user uuid, p_id uuid default null, p_now timestamptz default now())
returns jsonb language sql as $$
  update notifications set read_at = p_now
  where user_id = p_user and read_at is null and (p_id is null or id = p_id);
  select jsonb_build_object('ok', true);
$$;
