-- SMS commands. The phone number is the identity, as the sender has no session.

create or replace function money_sms_inbound(p_phone text, p_body text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  recent int;
  u users;
begin
  select count(*) into recent from sms_inbound where phone = p_phone
    and received_at > p_now - make_interval(mins => money_rule('SMS_RATE_WINDOW_MINUTES')::int);
  insert into sms_inbound (phone, body, received_at) values (p_phone, p_body, p_now);
  if recent >= money_rule('SMS_RATE_LIMIT') then
    return money_fail('rate_limited');
  end if;
  select * into u from users where phone = p_phone;
  if not found then return money_fail('unknown_phone'); end if;
  return jsonb_build_object('ok', true, 'user_id', u.id, 'role', u.role);
end $$;

create or replace function money_sms_link(p_phone text, p_booking uuid, p_now timestamptz) returns void
language sql as $$
  update sms_inbound set booking_id = p_booking where id = (
    select max(id) from sms_inbound where phone = p_phone and received_at = p_now
  );
$$;

-- YES answers whichever question is open. With more than one open, the farmer has to say which.
create or replace function money_sms_yes(p_phone text, p_code text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  u users;
  open_ids uuid[];
  open_codes text[];
  b bookings;
  result jsonb;
begin
  select * into strict u from users where phone = p_phone;
  select array_agg(x.id), array_agg(x.code) into open_ids, open_codes from (
    select id, code from bookings where farmer_id = u.id and status in ('booked', 'delivered')
      and (p_code is null or code = p_code)
      and (status = 'delivered' or confirm_sms_at is not null or p_code is not null)
    order by created_at
  ) x;
  if open_ids is null then return money_fail('nothing_to_confirm'); end if;
  if cardinality(open_ids) > 1 then
    return money_fail('ambiguous', jsonb_build_object('codes', open_codes));
  end if;
  select * into strict b from bookings where id = open_ids[1];
  perform money_sms_link(p_phone, b.id, p_now);
  if b.status = 'booked' then
    result := money_confirm_booking(b.id, u.id, p_now);
    return result || jsonb_build_object('action', 'confirmed', 'code', b.code);
  end if;
  result := money_farmer_reply(b.id, u.id, 'yes', null, p_now);
  return result || jsonb_build_object('action', 'settled', 'code', b.code);
end $$;

create or replace function money_sms_delivered(p_phone text, p_code text, p_digits text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  u users;
  b bookings;
begin
  select * into strict u from users where phone = p_phone;
  select * into b from bookings where code = p_code and farmer_id = u.id;
  if not found then return money_fail('booking_not_found'); end if;
  perform money_sms_link(p_phone, b.id, p_now);
  return money_submit_code(b.id, u.id, p_digits, p_now);
end $$;

create or replace function money_sms_dispute(p_phone text, p_code text, p_claim_kg numeric, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  u users;
  b bookings;
  open_ids uuid[];
begin
  select * into strict u from users where phone = p_phone;
  select array_agg(id) into open_ids from bookings
    where farmer_id = u.id and status = 'delivered' and (p_code is null or code = p_code);
  if open_ids is null then return money_fail('nothing_to_dispute'); end if;
  if cardinality(open_ids) > 1 then return money_fail('ambiguous'); end if;
  select * into strict b from bookings where id = open_ids[1];
  perform money_sms_link(p_phone, b.id, p_now);
  return money_farmer_reply(b.id, u.id, 'dispute', p_claim_kg, p_now);
end $$;

create or replace function money_sms_cancel(p_phone text, p_code text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  u users;
  b bookings;
begin
  select * into strict u from users where phone = p_phone;
  select * into b from bookings where code = p_code and (farmer_id = u.id or buyer_id = u.id);
  if not found then return money_fail('booking_not_found'); end if;
  perform money_sms_link(p_phone, b.id, p_now);
  if b.farmer_id = u.id then return money_cancel_farmer(b.id, u.id, p_now); end if;
  return money_cancel_buyer(b.id, u.id, p_now);
end $$;

-- A numbered list for this phone. It's information, not a reservation.
create or replace function money_sms_buyers(p_phone text, p_commodity text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  rows jsonb;
begin
  delete from sms_menus where phone = p_phone;
  with choices as (
    select l.id as listing_id, u.name as buyer, l.unit_price_kobo, s.capacity_remaining, s.date,
      row_number() over (order by l.unit_price_kobo desc, s.date) as position
    from demand_listings l
    join commodities c on c.id = l.commodity_id
    join users u on u.id = l.buyer_id
    join lateral (
      select * from slots sl where sl.listing_id = l.id and sl.status = 'open' and sl.capacity_remaining > 0
        and p_now < sl.cutoff_at order by sl.date limit 1
    ) s on true
    where l.status = 'active' and c.name ilike p_commodity
    order by l.unit_price_kobo desc, s.date limit 5
  ), saved as (
    insert into sms_menus (phone, position, listing_id, created_at)
    select p_phone, position, listing_id, p_now from choices returning 1
  )
  select jsonb_agg(jsonb_build_object('n', position, 'buyer', buyer, 'price', money_naira(unit_price_kobo),
    'left', capacity_remaining, 'day', to_char(date, 'Dy')) order by position) into rows from choices;
  return jsonb_build_object('ok', true, 'rows', coalesce(rows, '[]'));
end $$;

create or replace function money_sms_book(p_phone text, p_position int, p_qty int, p_day text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  u users;
  m sms_menus;
  slot_id uuid;
begin
  select * into strict u from users where phone = p_phone;
  select * into m from sms_menus where phone = p_phone and position = p_position;
  if not found then return money_fail('no_such_choice'); end if;
  select id into slot_id from slots
  where listing_id = m.listing_id and status = 'open'
    and date >= (p_now at time zone 'Africa/Lagos')::date
    and upper(to_char(date, 'DY')) = upper(left(p_day, 3))
  order by date limit 1;
  if slot_id is null then return money_fail('no_slot_that_day'); end if;
  return book_slot(slot_id, u.id, p_qty, p_now);
end $$;
