-- Booking, confirmation, cancellation, delivery code and recording.
-- Rule failures return { ok: false, code } rather than raising, so a rejected booking can still
-- commit its side effects, such as pausing a listing that has run out of funds.

create or replace function money_fail(p_code text, p_extra jsonb default '{}') returns jsonb
language sql immutable as $$
  select jsonb_build_object('ok', false, 'code', p_code) || p_extra;
$$;

create or replace function money_add_strike(
  p_kind text, p_booking uuid, p_farmer uuid, p_buyer uuid, p_now timestamptz
) returns void language plpgsql as $$
begin
  insert into strikes (kind, booking_id, farmer_id, buyer_id, created_at)
  values (p_kind, p_booking, p_farmer, p_buyer, p_now)
  on conflict (booking_id, kind) do nothing;
  perform money_event('strike', p_booking, p_kind, 'system', null,
    jsonb_build_object('farmer_id', p_farmer, 'buyer_id', p_buyer));

  if p_kind = 'refused_code' and (select count(*) from strikes where buyer_id = p_buyer and kind = 'refused_code')
      >= money_rule('REFUSED_CODE_PAUSE_COUNT') then
    update users set buyer_review_hold = true where id = p_buyer;
    update demand_listings set status = 'paused', paused_reason = 'review'
    where buyer_id = p_buyer and status = 'active';
    perform money_alert('buyer_review', jsonb_build_object('buyer_id', p_buyer));
  end if;
end $$;

create or replace function money_farmer_banned_until(p_farmer uuid, p_now timestamptz)
returns timestamptz language sql stable as $$
  select max(s.created_at) + make_interval(days => money_rule('NO_SHOW_BAN_DAYS')::int)
  from strikes s
  where s.farmer_id = p_farmer and s.kind = 'no_show'
    and s.created_at <= p_now
    and s.created_at + make_interval(days => money_rule('NO_SHOW_BAN_DAYS')::int) > p_now
    and (
      select count(*) from strikes e
      where e.farmer_id = p_farmer and e.kind = 'no_show'
        and e.created_at <= s.created_at
        and e.created_at > s.created_at - make_interval(days => money_rule('NO_SHOW_BAN_WINDOW_DAYS')::int)
    ) >= money_rule('NO_SHOW_BAN_COUNT');
$$;

create or replace function money_new_booking_code() returns text language plpgsql as $$
declare
  candidate text;
begin
  loop
    candidate := 'LM-' || lpad(((get_byte(extensions.gen_random_bytes(1), 0) * 256
      + get_byte(extensions.gen_random_bytes(1), 0)) % 100000)::text, 5, '0');
    exit when not exists (select 1 from bookings where code = candidate);
  end loop;
  return candidate;
end $$;

create or replace function money_new_delivery_code() returns text language sql volatile as $$
  select lpad(((get_byte(b, 0) * 256 + get_byte(b, 1)) % 10000)::text, 4, '0')
  from extensions.gen_random_bytes(2) as b;
$$;

create or replace function book_slot(
  p_slot uuid, p_farmer uuid, p_qty int, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  s slots;
  l demand_listings;
  buyer users;
  booking_id uuid;
  plain_code text := money_new_delivery_code();
  -- Hashed before taking the lock, so a slow hash can't hold up other bookings.
  code_hash text := extensions.crypt(plain_code, extensions.gen_salt('bf', 6));
  available bigint;
  reserve bigint;
  declared int;
  already int;
  completed int;
  banned timestamptz;
  confirm_at timestamptz;
  new_status booking_status;
  booking_code text;
begin
  if p_qty is null or p_qty <= 0 then return money_fail('invalid_quantity'); end if;

  select * into s from slots where id = p_slot for update;
  if not found then return money_fail('slot_not_found'); end if;

  select * into strict l from demand_listings where id = s.listing_id;
  select * into strict buyer from users where id = l.buyer_id;

  if p_farmer = l.buyer_id then return money_fail('own_listing'); end if;
  if s.status <> 'open' or l.status <> 'active' then return money_fail('slot_closed'); end if;
  if p_now >= s.cutoff_at and (s.reopened_until is null or p_now >= s.reopened_until) then
    return money_fail('past_cutoff');
  end if;

  banned := money_farmer_banned_until(p_farmer, p_now);
  if banned is not null then
    return money_fail('farmer_banned', jsonb_build_object('until', banned));
  end if;

  if p_qty < l.min_qty then
    return money_fail('below_minimum', jsonb_build_object('min_qty', l.min_qty));
  end if;
  if p_qty > s.capacity_remaining then
    return money_fail('only_n_left', jsonb_build_object('remaining', s.capacity_remaining));
  end if;

  -- Stops one farmer's parallel bookings from sharing the same declared stock.
  perform pg_advisory_xact_lock(hashtext(p_farmer::text || s.date::text));

  select qty_declared into declared from producer_stock
  where farmer_id = p_farmer and commodity_id = l.commodity_id and date = s.date;
  if found then
    select coalesce(sum(b.qty), 0) into already
    from bookings b
    join slots bs on bs.id = b.slot_id
    join demand_listings bl on bl.id = bs.listing_id
    where b.farmer_id = p_farmer and bs.date = s.date and bl.commodity_id = l.commodity_id
      and b.status in ('booked', 'confirmed', 'delivered', 'disputed', 'settled');
    if p_qty > declared - already then
      return money_fail('over_declared_stock', jsonb_build_object('remaining', declared - already));
    end if;
  end if;

  select count(*) into completed from bookings where farmer_id = p_farmer and status = 'settled';
  if completed = 0 then
    select coalesce(sum(qty), 0) into already from bookings
    where farmer_id = p_farmer and status in ('booked', 'confirmed', 'delivered', 'disputed');
    if already + p_qty > money_rule('NEW_FARMER_FIRST_BOOKING_CAP') then
      return money_fail('new_farmer_cap',
        jsonb_build_object('cap', money_rule('NEW_FARMER_FIRST_BOOKING_CAP')));
    end if;
  end if;

  if l.max_unit_weight_kg is null or l.min_unit_weight_kg is null then
    return money_fail('listing_has_no_weights');
  end if;

  reserve := ceil(p_qty * l.max_unit_weight_kg * l.unit_price_kobo)::bigint;

  -- Locking the row makes the balance check and the reserve one atomic step for this buyer.
  perform 1 from money_balances where bucket = 'buyer_available' and owner_id = l.buyer_id for update;
  available := wallet_get_available(l.buyer_id);
  if available < reserve then
    update demand_listings set status = 'paused', paused_reason = 'insufficient_funds' where id = l.id;
    perform money_event('listing', l.id, 'paused', 'system',
      jsonb_build_object('status', l.status),
      jsonb_build_object('status', 'paused', 'available_kobo', available, 'needed_kobo', reserve));
    perform money_sms(buyer.phone, 'Your Lumora listing is paused. Add funds to keep taking bookings.');
    return money_fail('insufficient_funds');
  end if;

  confirm_at := s.window_start - make_interval(hours => money_rule('CONFIRM_LEAD_HOURS')::int);
  new_status := case when p_now >= confirm_at then 'confirmed' else 'booked' end;
  booking_code := money_new_booking_code();

  insert into bookings (slot_id, farmer_id, buyer_id, qty, code, status, reserve_kobo, unit_price_kobo,
    delivery_code_hash, confirm_by, confirm_deadline, window_end, created_at)
  values (p_slot, p_farmer, l.buyer_id, p_qty, booking_code, new_status, reserve, l.unit_price_kobo,
    code_hash, confirm_at,
    least(s.window_start, greatest(s.cutoff_at,
      confirm_at + make_interval(hours => money_rule('CONFIRM_REPLY_HOURS')::int))),
    s.window_end, p_now)
  returning id into booking_id;

  update slots set capacity_remaining = capacity_remaining - p_qty where id = p_slot;
  perform wallet_reserve(booking_id, l.buyer_id, reserve);

  perform money_event('booking', booking_id, 'booked', p_farmer::text, null, jsonb_build_object(
    'status', new_status, 'qty', p_qty, 'reserve_kobo', reserve));

  -- delivery_code is for the server to pass to the buyer. It must never reach the farmer.
  return jsonb_build_object('ok', true, 'booking_id', booking_id, 'code', booking_code,
    'status', new_status, 'reserve_kobo', reserve,
    'capacity_remaining', s.capacity_remaining - p_qty,
    'delivery_code', plain_code, 'buyer_phone', buyer.phone);
end $$;

-- A buyer who lost the SMS can issue a new code. The old one stops working.
create or replace function money_regenerate_code(p_booking uuid, p_buyer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  plain_code text := money_new_delivery_code();
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status not in ('booked', 'confirmed') or b.arrived_at is not null then
    return money_fail('wrong_state');
  end if;
  update bookings set delivery_code_hash = extensions.crypt(plain_code, extensions.gen_salt('bf', 6)),
    code_attempts = 0, code_locked_at = null where id = p_booking;
  perform money_event('booking', p_booking, 'code_regenerated', p_buyer::text, null, null);
  return jsonb_build_object('ok', true, 'delivery_code', plain_code);
end $$;

-- Reduces a slot's size, but never below what's already booked.
create or replace function money_set_capacity(p_slot uuid, p_buyer uuid, p_total int)
returns jsonb language plpgsql as $$
declare
  s slots;
  booked int;
begin
  select * into s from slots where id = p_slot for update;
  if not found then return money_fail('slot_not_found'); end if;
  if not exists (select 1 from demand_listings where id = s.listing_id and buyer_id = p_buyer) then
    return money_fail('not_your_slot');
  end if;
  booked := s.capacity_total - s.capacity_remaining;
  if p_total < booked then
    return money_fail('below_booked', jsonb_build_object('booked', booked));
  end if;
  update slots set capacity_total = p_total, capacity_remaining = p_total - booked where id = p_slot;
  perform money_event('slot', p_slot, 'capacity_changed', p_buyer::text,
    jsonb_build_object('capacity_total', s.capacity_total), jsonb_build_object('capacity_total', p_total));
  return jsonb_build_object('ok', true, 'capacity_remaining', p_total - booked);
end $$;

create or replace function money_reopen_capacity(p_booking bookings, p_now timestamptz)
returns slots language plpgsql as $$
declare
  s slots;
begin
  update slots set capacity_remaining = capacity_remaining + p_booking.qty,
    reopened_until = case when p_now >= cutoff_at
      then window_start - make_interval(hours => money_rule('REOPEN_LEAD_HOURS')::int)
      else reopened_until end
  where id = p_booking.slot_id
  returning * into s;
  return s;
end $$;

-- Tells nearby farmers who follow this commodity that capacity came free.
create or replace function money_offer_freed(p_booking bookings, p_slot slots, p_now timestamptz)
returns int language plpgsql as $$
declare
  l demand_listings;
  buyer users;
  commodity text;
  farmer record;
  told int := 0;
begin
  if p_slot.reopened_until is not null and p_now >= p_slot.reopened_until then return 0; end if;
  select * into strict l from demand_listings where id = p_slot.listing_id;
  select * into strict buyer from users where id = l.buyer_id;
  select name into strict commodity from commodities where id = l.commodity_id;

  for farmer in
    select u.id, u.phone from commodity_follows f
    join users u on u.id = f.farmer_id
    where f.commodity_id = l.commodity_id and u.id <> p_booking.farmer_id
      and u.area is not distinct from buyer.area
    order by u.created_at
    limit money_rule('FREED_SMS_MAX_FARMERS')::int
  loop
    insert into sms_menus (phone, position, listing_id, created_at)
    values (farmer.phone, 1, l.id, p_now)
    on conflict (phone, position) do update set listing_id = excluded.listing_id, created_at = excluded.created_at;
    perform money_sms(farmer.phone, format('%s %s just freed up for %s on %s. Reply BOOK 1 %s %s',
      p_booking.qty, commodity, buyer.name, to_char(p_slot.date, 'FMDay'),
      p_booking.qty, upper(to_char(p_slot.date, 'DY'))));
    told := told + 1;
  end loop;
  return told;
end $$;

create or replace function money_confirm_booking(p_booking uuid, p_farmer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.farmer_id <> p_farmer then return money_fail('not_your_booking'); end if;
  if b.status = 'confirmed' then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  if b.status <> 'booked' then return money_fail('wrong_state', jsonb_build_object('status', b.status)); end if;
  if p_now >= b.confirm_deadline then return money_fail('confirm_deadline_passed'); end if;
  update bookings set status = 'confirmed' where id = p_booking;
  perform money_event('booking', p_booking, 'confirmed', p_farmer::text,
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'confirmed'));
  return jsonb_build_object('ok', true, 'code', b.code);
end $$;

-- Deadline default, and also what a farmer's cancellation after the cut-off counts as.
create or replace function money_apply_no_show(p_booking bookings, p_actor text, p_now timestamptz)
returns void language plpgsql as $$
declare
  hold bigint;
begin
  select amount_kobo into strict hold from money_holds where booking_id = p_booking.id;
  perform wallet_release(p_booking.id, hold, 'no_show');
  update bookings set status = 'no_show' where id = p_booking.id;
  perform money_add_strike('no_show', p_booking.id, p_booking.farmer_id, null, p_now);
  perform wallet_fee_from_next_payout(p_booking.farmer_id,
    money_round_kobo(p_booking.reserve_kobo * money_rule('NO_SHOW_FEE_PCT') / 100), 'no_show',
    p_booking.id, money_rule('NO_SHOW_FEE_BUYER_SHARE_PCT')::int);
  perform money_event('booking', p_booking.id, 'no_show', p_actor,
    jsonb_build_object('status', p_booking.status), jsonb_build_object('status', 'no_show'));
  perform money_sms((select phone from users where id = p_booking.buyer_id),
    format('Booking %s was a no-show. Your %s is back in your balance.', p_booking.code, money_naira(hold)));
  perform money_sms((select phone from users where id = p_booking.farmer_id),
    format('Booking %s is marked as a no-show. A fee comes off your next payout.', p_booking.code));
end $$;

create or replace function money_cancel_farmer(p_booking uuid, p_farmer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  s slots;
  hold bigint;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.farmer_id <> p_farmer then return money_fail('not_your_booking'); end if;
  if b.status not in ('booked', 'confirmed') or b.arrived_at is not null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  select * into strict s from slots where id = b.slot_id;

  if b.status = 'confirmed' and p_now >= s.cutoff_at then
    perform money_apply_no_show(b, p_farmer::text, p_now);
    perform money_reopen_capacity(b, p_now);
    return jsonb_build_object('ok', true, 'status', 'no_show');
  end if;

  select amount_kobo into strict hold from money_holds where booking_id = b.id;
  perform wallet_release(b.id, hold, 'farmer_cancel');
  update bookings set status = 'cancelled' where id = b.id;
  perform money_reopen_capacity(b, p_now);
  perform money_event('booking', b.id, 'cancelled', p_farmer::text,
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'cancelled'));
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end $$;

create or replace function money_create_settlement(
  p_booking bookings, p_gross bigint, p_fees bigint, p_net bigint, p_kind text
) returns uuid language plpgsql as $$
declare
  settlement_id uuid;
begin
  insert into money_settlements (booking_id, farmer_id, gross_kobo, fees_kobo, net_kobo, kind)
  values (p_booking.id, p_booking.farmer_id, p_gross, p_fees, p_net, p_kind)
  returning id into settlement_id;
  if p_net > 0 then
    insert into money_payouts (settlement_id, farmer_id, amount_kobo)
    values (settlement_id, p_booking.farmer_id, p_net);
  end if;
  return settlement_id;
end $$;

create or replace function money_cancel_buyer(p_booking uuid, p_buyer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  s slots;
  hold bigint;
  fee bigint := 0;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status not in ('booked', 'confirmed') or b.arrived_at is not null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  select * into strict s from slots where id = b.slot_id;
  select amount_kobo into strict hold from money_holds where booking_id = b.id;

  if p_now >= s.cutoff_at then
    fee := least(hold, money_round_kobo(b.reserve_kobo * money_rule('LATE_CANCEL_FEE_PCT') / 100));
    perform wallet_settle(b.id, b.farmer_id, fee, 'late_cancel');
    perform money_create_settlement(b, fee, 0, fee, 'late_cancel');
    perform money_add_strike('late_cancel', b.id, null, p_buyer, p_now);
    perform money_sms((select phone from users where id = b.farmer_id),
      format('The buyer cancelled %s late. You get a %s fee.', b.code, money_naira(fee)));
  end if;

  perform wallet_release(b.id, hold - fee, 'buyer_cancel');
  update bookings set status = 'cancelled' where id = b.id;
  perform money_reopen_capacity(b, p_now);
  perform money_event('booking', b.id, 'cancelled', p_buyer::text,
    jsonb_build_object('status', b.status),
    jsonb_build_object('status', 'cancelled', 'late_fee_kobo', fee));
  return jsonb_build_object('ok', true, 'status', 'cancelled', 'late_fee_kobo', fee);
end $$;

-- For a farmer who arrives and the buyer won't give the code. There's no SMS command for this.
create or replace function money_report_refused_code(p_booking uuid, p_actor uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  hold bigint;
begin
  select * into b from bookings where id = p_booking for update;
  if not found then return money_fail('booking_not_found'); end if;
  if b.status <> 'confirmed' then return money_fail('wrong_state'); end if;
  select amount_kobo into strict hold from money_holds where booking_id = b.id;
  perform wallet_release(b.id, hold, 'refused_code');
  update bookings set status = 'cancelled' where id = b.id;
  perform money_add_strike('refused_code', b.id, null, b.buyer_id, p_now);
  perform money_event('booking', b.id, 'refused_code', p_actor::text,
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'cancelled'));
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end $$;

create or replace function money_submit_code(
  p_booking uuid, p_farmer uuid, p_digits text, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  b bookings;
  attempts int;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.farmer_id <> p_farmer then return money_fail('not_your_booking'); end if;
  if b.arrived_at is not null then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  if b.status <> 'confirmed' then return money_fail('wrong_state', jsonb_build_object('status', b.status)); end if;
  if b.code_locked_at is not null then return money_fail('code_locked'); end if;

  if b.delivery_code_hash = extensions.crypt(p_digits, b.delivery_code_hash) then
    update bookings set arrived_at = p_now where id = b.id;
    perform money_event('booking', b.id, 'arrived', p_farmer::text, null,
      jsonb_build_object('arrived_at', p_now));
    return jsonb_build_object('ok', true, 'code', b.code, 'qty', b.qty);
  end if;

  attempts := b.code_attempts + 1;
  update bookings set code_attempts = attempts,
    code_locked_at = case when attempts >= money_rule('CODE_MAX_ATTEMPTS') then p_now end
  where id = b.id;
  perform money_event('booking', b.id, 'wrong_code', p_farmer::text, null,
    jsonb_build_object('attempts', attempts));
  if attempts >= money_rule('CODE_MAX_ATTEMPTS') then
    perform money_alert('code_locked', jsonb_build_object('booking_id', b.id, 'code', b.code));
    return money_fail('code_locked');
  end if;
  return money_fail('wrong_code',
    jsonb_build_object('attempts_left', money_rule('CODE_MAX_ATTEMPTS') - attempts));
end $$;

-- Ops can give a locked booking another chance. Stops a locked code becoming an unfair no-show.
create or replace function money_unlock_code(p_booking uuid, p_actor uuid) returns jsonb
language plpgsql as $$
begin
  update bookings set code_attempts = 0, code_locked_at = null where id = p_booking;
  perform money_event('booking', p_booking, 'code_unlocked', p_actor::text, null, null);
  return jsonb_build_object('ok', true);
end $$;

create or replace function money_record_delivery(
  p_booking uuid, p_buyer uuid, p_units_received int, p_units_declined int, p_decline_reasons jsonb,
  p_measured_kg numeric, p_scale_photos text[], p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  b bookings;
  gross bigint;
  capped bigint;
  price text;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status <> 'confirmed' or b.arrived_at is null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  if p_now >= b.arrived_at + make_interval(hours => money_rule('BUYER_RECORD_HOURS')::int) then
    return money_fail('record_deadline_passed');
  end if;
  if coalesce(cardinality(p_scale_photos), 0) < 1 then return money_fail('scale_photo_required'); end if;
  if p_units_received < 0 or p_units_declined < 0 or p_measured_kg < 0
     or p_units_received + p_units_declined > b.qty then
    return money_fail('invalid_quantities');
  end if;
  if jsonb_typeof(coalesce(p_decline_reasons, '[]')) <> 'array'
     or (p_units_declined > 0 and jsonb_array_length(coalesce(p_decline_reasons, '[]')) = 0) then
    return money_fail('decline_reason_required');
  end if;

  gross := money_round_kobo(p_measured_kg * b.unit_price_kobo);
  capped := least(gross, b.reserve_kobo);
  if capped < gross then
    perform money_event('booking', b.id, 'gross_capped_at_reserve', p_buyer::text,
      jsonb_build_object('gross_kobo', gross), jsonb_build_object('gross_kobo', capped));
  end if;

  insert into deliveries (booking_id, units_received, units_declined, decline_reasons, measured_kg,
    scale_photo_urls, recorded_by, recorded_at, gross_kobo, reply_deadline)
  values (b.id, p_units_received, p_units_declined, coalesce(p_decline_reasons, '[]'), p_measured_kg,
    p_scale_photos, p_buyer, p_now, capped,
    p_now + make_interval(hours => money_rule('FARMER_REPLY_HOURS')::int));

  update bookings set status = 'delivered' where id = b.id;
  perform money_event('booking', b.id, 'delivered', p_buyer::text,
    jsonb_build_object('status', b.status),
    jsonb_build_object('status', 'delivered', 'measured_kg', p_measured_kg, 'gross_kobo', capped));

  price := money_naira(b.unit_price_kobo);
  perform money_sms((select phone from users where id = b.farmer_id),
    format('%s: %s kg × %s = %s. Reply YES or DISPUTE.',
      b.code, trim_scale(p_measured_kg), price, money_naira(capped)));
  return jsonb_build_object('ok', true, 'gross_kobo', capped);
end $$;
