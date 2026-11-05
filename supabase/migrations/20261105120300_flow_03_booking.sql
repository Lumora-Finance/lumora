-- Booking, approval, confirmation, cancellation, running late, backups, the delivery code,
-- code-not-given reports and recording. Replaces the earlier versions of these functions.
drop function if exists money_report_refused_code(uuid, uuid, timestamptz);

create or replace function money_add_strike(
  p_kind text, p_booking uuid, p_farmer uuid, p_buyer uuid, p_now timestamptz
) returns void language plpgsql as $$
declare
  recent int;
begin
  insert into strikes (kind, booking_id, farmer_id, buyer_id, created_at)
  values (p_kind, p_booking, p_farmer, p_buyer, p_now)
  on conflict (booking_id, kind) do nothing;
  perform money_event('strike', p_booking, p_kind, 'system', null,
    jsonb_build_object('farmer_id', p_farmer, 'buyer_id', p_buyer));

  if p_kind = 'refused_code' then
    select count(*) into recent from strikes
    where buyer_id = p_buyer and kind = 'refused_code'
      and created_at > p_now - make_interval(days => money_rule('REFUSED_CODE_WINDOW_DAYS')::int);
    if recent >= money_rule('REFUSED_CODE_PAUSE_COUNT') then
      update users set buyer_review_hold = true where id = p_buyer;
      update demand_listings set status = 'paused', paused_reason = 'review'
      where buyer_id = p_buyer and status = 'active';
      perform money_alert('buyer_review', jsonb_build_object('buyer_id', p_buyer));
      perform money_notify(p_buyer, 'listings_paused_review', null, '{}', p_now);
    end if;
  end if;
end $$;

create or replace function money_farmer_banned_until(p_farmer uuid, p_now timestamptz)
returns timestamptz language sql stable as $$
  select max(s.created_at) + make_interval(days => money_rule('NO_SHOW_PAUSE_DAYS')::int)
  from strikes s
  where s.farmer_id = p_farmer and s.kind = 'no_show'
    and s.created_at <= p_now
    and s.created_at + make_interval(days => money_rule('NO_SHOW_PAUSE_DAYS')::int) > p_now
    and (
      select count(*) from strikes e
      where e.farmer_id = p_farmer and e.kind = 'no_show'
        and e.created_at <= s.created_at
        and e.created_at > s.created_at - make_interval(days => money_rule('NO_SHOW_PAUSE_WINDOW_DAYS')::int)
    ) >= money_rule('NO_SHOW_PAUSE_COUNT');
$$;

create or replace function money_notify_booked(p_booking bookings, p_now timestamptz) returns void language plpgsql as $$
declare
  facts jsonb := money_booking_facts(p_booking);
begin
  perform money_notify(p_booking.farmer_id, 'booking_confirmed', p_booking.id, facts, p_now);
  perform money_notify(p_booking.buyer_id, 'booking_received', p_booking.id, facts, p_now);
end $$;

create or replace function book_slot(
  p_slot uuid, p_farmer uuid, p_qty int, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  s slots;
  l demand_listings;
  buyer users;
  origin_id uuid;
  origin bookings;
  req backup_requests;
  new_booking uuid;
  new_row bookings;
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
  needs_approval boolean;
  origin_hold bigint;
  borrow bigint;
begin
  if p_qty is null or p_qty <= 0 then return money_fail('invalid_quantity'); end if;

  -- A backup can take from the original booking's hold, so that booking is locked first, in the same
  -- order as the delivery code does.
  select l2.backup_of_booking into origin_id
  from slots s2 join demand_listings l2 on l2.id = s2.listing_id where s2.id = p_slot;
  if origin_id is not null then
    select * into strict origin from bookings where id = origin_id for update;
    if origin.farmer_id = p_farmer then return money_fail('own_backup'); end if;
  end if;

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
      and b.status in ('pending_approval', 'booked', 'confirmed', 'contested', 'delivered', 'disputed', 'settled');
    if p_qty > declared - already then
      return money_fail('over_declared_stock', jsonb_build_object('remaining', declared - already));
    end if;
  end if;

  select count(*) into completed from bookings where farmer_id = p_farmer and status = 'settled';
  if completed = 0 then
    select coalesce(sum(qty), 0) into already from bookings
    where farmer_id = p_farmer and status in ('pending_approval', 'booked', 'confirmed', 'contested', 'delivered', 'disputed');
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

  -- A backup replaces a missing farmer, so it can use what's held for them. It goes back if they turn up.
  if available < reserve and origin_id is not null and origin.status = 'confirmed' and origin.arrived_at is null then
    select amount_kobo into strict origin_hold from money_holds where booking_id = origin_id;
    borrow := reserve - available;
    if borrow <= origin_hold then
      perform wallet_release(origin_id, borrow, 'backup_borrow:' || gen_random_uuid());
      update backup_requests set borrowed_kobo = borrowed_kobo + borrow where booking_id = origin_id;
      available := available + borrow;
    end if;
  end if;

  if available < reserve then
    if origin_id is null then
      update demand_listings set status = 'paused', paused_reason = 'insufficient_funds' where id = l.id;
      perform money_event('listing', l.id, 'paused', 'system',
        jsonb_build_object('status', l.status),
        jsonb_build_object('status', 'paused', 'available_kobo', available, 'needed_kobo', reserve));
      perform money_notify(l.buyer_id, 'listing_paused_funds', null, '{}', p_now);
    end if;
    return money_fail('insufficient_funds');
  end if;

  confirm_at := s.cutoff_at - make_interval(hours => money_rule('CONFIRM_REQUEST_HOURS_BEFORE_CUTOFF')::int);
  needs_approval := origin_id is null and buyer.approve_first_time_farmers and not exists (
    select 1 from bookings done
    where done.farmer_id = p_farmer and done.buyer_id = l.buyer_id and done.status = 'settled');
  new_status := case
    when needs_approval then 'pending_approval'
    when origin_id is not null or p_now >= confirm_at then 'confirmed'
    else 'booked' end;
  booking_code := money_new_booking_code();

  select * into req from backup_requests where booking_id = origin_id;

  insert into bookings (slot_id, farmer_id, buyer_id, qty, code, status, reserve_kobo, unit_price_kobo,
    delivery_code_hash, confirm_by, confirm_deadline, window_end, approval_deadline, backup_request_id, created_at)
  values (p_slot, p_farmer, l.buyer_id, p_qty, booking_code, new_status, reserve, l.unit_price_kobo,
    code_hash, confirm_at, s.cutoff_at,
    -- Booked after the window closed, when a missed delivery reopened the quantity: they still need time.
    greatest(s.window_end, p_now + make_interval(hours => money_rule('NO_SHOW_GRACE_HOURS')::int)),
    case when needs_approval then least(p_now + make_interval(hours => money_rule('FIRST_TIME_APPROVAL_HOURS')::int), s.window_start) end,
    req.id, p_now)
  returning * into new_row;
  new_booking := new_row.id;

  insert into booking_codes (booking_id, code) values (new_booking, plain_code);
  update slots set capacity_remaining = capacity_remaining - p_qty where id = p_slot;
  perform wallet_reserve(new_booking, l.buyer_id, reserve);

  perform money_event('booking', new_booking, 'booked', p_farmer::text, null, jsonb_build_object(
    'status', new_status, 'qty', p_qty, 'reserve_kobo', reserve));

  if needs_approval then
    perform money_notify(p_farmer, 'booking_pending', new_booking, money_booking_facts(new_row), p_now);
    perform money_notify(l.buyer_id, 'approval_request', new_booking, money_booking_facts(new_row), p_now,
      array['approve', 'decline'], new_row.approval_deadline);
  else
    perform money_notify_booked(new_row, p_now);
  end if;

  if req.id is not null and s.capacity_remaining - p_qty = 0 then
    update backup_requests set status = 'filled' where id = req.id and status = 'open';
    perform money_event('backup', req.id, 'filled', 'system', null, null);
    perform money_notify(l.buyer_id, 'backup_closed', origin_id,
      money_booking_facts(origin) || jsonb_build_object('reason', 'filled'), p_now);
  end if;

  -- delivery_code is for the server. It must never reach the farmer.
  return jsonb_build_object('ok', true, 'booking_id', new_booking, 'code', booking_code,
    'status', new_status, 'reserve_kobo', reserve,
    'capacity_remaining', s.capacity_remaining - p_qty,
    'delivery_code', plain_code, 'buyer_phone', buyer.phone);
end $$;

create or replace function money_regenerate_code(p_booking uuid, p_buyer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  plain_code text := money_new_delivery_code();
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status not in ('booked', 'confirmed', 'contested') or b.arrived_at is not null then
    return money_fail('wrong_state');
  end if;
  update bookings set delivery_code_hash = extensions.crypt(plain_code, extensions.gen_salt('bf', 6)),
    code_attempts = 0, code_locked_at = null where id = p_booking;
  insert into booking_codes (booking_id, code) values (p_booking, plain_code)
  on conflict (booking_id) do update set code = excluded.code;
  perform money_event('booking', p_booking, 'code_regenerated', p_buyer::text, null, null);
  return jsonb_build_object('ok', true, 'delivery_code', plain_code);
end $$;

-- Puts quantity back. After the cut-off it stays bookable until 4 hours before the window, and once
-- that has passed, until the delivery day ends.
create or replace function money_reopen_capacity(p_booking bookings, p_now timestamptz)
returns slots language plpgsql as $$
declare
  s slots;
  lead_end timestamptz;
  day_end timestamptz;
begin
  select * into strict s from slots where id = p_booking.slot_id for update;
  lead_end := s.window_start - make_interval(hours => money_rule('REOPEN_LEAD_HOURS')::int);
  day_end := (s.date + 1)::timestamp at time zone 'Africa/Lagos';
  update slots set capacity_remaining = capacity_remaining + p_booking.qty,
    reopened_until = case
      when p_now < cutoff_at then reopened_until
      when p_now < lead_end then lead_end
      when p_now < day_end then day_end
      else reopened_until end
  where id = p_booking.slot_id
  returning * into s;
  return s;
end $$;

-- Tells nearby farmers who follow this produce that quantity came free.
create or replace function money_offer_freed(p_booking bookings, p_slot slots, p_now timestamptz)
returns int language plpgsql as $$
declare
  facts jsonb := money_booking_facts(p_booking);
  farmer record;
  told int := 0;
begin
  if p_slot.reopened_until is not null and p_now >= p_slot.reopened_until then return 0; end if;
  for farmer in
    select * from money_nearby_farmers(p_slot.listing_id, money_rule('FREED_NOTIFY_MAX')::int, null, p_booking.farmer_id)
  loop
    perform money_notify(farmer.farmer_id, 'capacity_freed', null, jsonb_build_object(
      'buyer', facts ->> 'buyer', 'qty', p_booking.qty, 'goods', facts ->> 'goods', 'window_start', facts ->> 'window_start',
      'price_kobo', p_booking.unit_price_kobo, 'price_unit', facts ->> 'price_unit'), p_now);
    told := told + 1;
  end loop;
  return told;
end $$;

-- Approves a first-time farmer's booking, by the buyer or by the timeout.
create or replace function money_apply_approval(p_booking bookings, p_actor text, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  next_status booking_status := case
    when p_booking.backup_request_id is not null or p_now >= p_booking.confirm_by then 'confirmed' else 'booked' end;
  fresh bookings;
begin
  update bookings set status = next_status where id = p_booking.id returning * into fresh;
  perform money_event('booking', p_booking.id, 'approved', p_actor,
    jsonb_build_object('status', p_booking.status), jsonb_build_object('status', next_status));
  perform money_notify_booked(fresh, p_now);
  return jsonb_build_object('ok', true, 'status', next_status);
end $$;

create or replace function money_answer_approval(p_booking uuid, p_buyer uuid, p_decision text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  hold_kobo bigint;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status <> 'pending_approval' then return money_fail('wrong_state', jsonb_build_object('status', b.status)); end if;
  if p_decision = 'approve' then return money_apply_approval(b, p_buyer::text, p_now); end if;
  if p_decision <> 'decline' then return money_fail('invalid_decision'); end if;

  select amount_kobo into strict hold_kobo from money_holds where booking_id = b.id;
  perform wallet_release(b.id, hold_kobo, 'declined');
  update bookings set status = 'declined', closed_reason = 'buyer_declined' where id = b.id;
  perform money_reopen_capacity(b, p_now);
  perform money_event('booking', b.id, 'declined', p_buyer::text,
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'declined'));
  perform money_notify(b.farmer_id, 'booking_declined', b.id, money_booking_facts(b), p_now);
  return jsonb_build_object('ok', true, 'status', 'declined');
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

-- Closes a backup request. If the original farmer arrived, or the buyer cancelled, backup bookings
-- whose farmer hasn't arrived go back with an apology and no penalty, and anything borrowed from the
-- original hold returns to it.
create or replace function money_close_backup(p_origin uuid, p_reason text, p_now timestamptz)
returns void language plpgsql as $$
declare
  req backup_requests;
  origin bookings;
  bb bookings;
  hold_kobo bigint;
  available bigint;
  repay bigint;
  n_released int := 0;
begin
  select * into req from backup_requests where booking_id = p_origin and status <> 'closed' for update;
  if not found then return; end if;
  select * into strict origin from bookings where id = p_origin;

  update backup_requests set status = 'closed', closed_reason = p_reason, closed_at = p_now where id = req.id;
  update slots set status = 'closed' where id = req.slot_id;
  update demand_listings set status = 'closed' where id = req.listing_id;

  if p_reason in ('original_arrived', 'buyer_cancelled') then
    for bb in
      select * from bookings where backup_request_id = req.id
        and status in ('pending_approval', 'booked', 'confirmed') and arrived_at is null
      order by created_at for update
    loop
      select amount_kobo into strict hold_kobo from money_holds where booking_id = bb.id;
      perform wallet_release(bb.id, hold_kobo, 'backup_not_needed');
      update bookings set status = 'released', closed_reason = 'backup_not_needed' where id = bb.id;
      update slots set capacity_remaining = capacity_remaining + bb.qty where id = bb.slot_id;
      perform money_event('booking', bb.id, 'released', 'system',
        jsonb_build_object('status', bb.status),
        jsonb_build_object('status', 'released', 'reason', 'backup_not_needed'));
      perform money_notify(bb.farmer_id, 'backup_released', bb.id, money_booking_facts(bb), p_now);
      n_released := n_released + 1;
    end loop;
  end if;

  if p_reason = 'original_arrived' and req.borrowed_kobo > 0 then
    perform 1 from money_balances where bucket = 'buyer_available' and owner_id = req.buyer_id for update;
    available := wallet_get_available(req.buyer_id);
    repay := least(req.borrowed_kobo, available);
    perform money_post('backup_repay:' || req.id, 'buyer_available', req.buyer_id,
      'buyer_reserved', req.buyer_id, repay, p_origin, 'backup borrow returned');
    if repay < req.borrowed_kobo then
      perform money_alert('backup_hold_short', jsonb_build_object(
        'booking_id', p_origin, 'short_kobo', req.borrowed_kobo - repay));
    end if;
  end if;

  perform money_event('backup', req.id, 'closed', 'system', jsonb_build_object('status', req.status),
    jsonb_build_object('status', 'closed', 'reason', p_reason, 'released', n_released));
  if p_reason <> 'no_show' then
    perform money_notify(req.buyer_id, 'backup_closed', p_origin,
      money_booking_facts(origin) || jsonb_build_object('reason', p_reason, 'released', n_released), p_now);
  end if;
end $$;

-- Deadline default, and also what a farmer's cancellation after the cut-off counts as.
create or replace function money_apply_no_show(p_booking bookings, p_actor text, p_now timestamptz)
returns void language plpgsql as $$
declare
  hold_kobo bigint;
  fee bigint := 0;
  prior int;
  req_status text;
  banned timestamptz;
  facts jsonb;
begin
  select amount_kobo into strict hold_kobo from money_holds where booking_id = p_booking.id;
  perform wallet_release(p_booking.id, hold_kobo, 'no_show');
  update bookings set status = 'no_show', closed_reason = 'no_show' where id = p_booking.id;

  select count(*) into prior from strikes where farmer_id = p_booking.farmer_id and kind = 'no_show';
  perform money_add_strike('no_show', p_booking.id, p_booking.farmer_id, null, p_now);
  if prior > 0 or money_rule('FIRST_NO_SHOW_IS_WARNING') = 0 then
    fee := money_round_kobo(money_booking_minimum(p_booking) * money_rule('NO_SHOW_FEE_PCT') / 100);
    -- All of it goes to the buyer who was let down, when it's collected.
    perform wallet_fee_from_next_payout(p_booking.farmer_id, fee, 'no_show', p_booking.id, 100);
  end if;

  -- A backup request has taken over this quantity, so it isn't offered a second time.
  select status into req_status from backup_requests where booking_id = p_booking.id;
  if req_status is null then
    perform money_reopen_capacity(p_booking, p_now);
  elsif req_status = 'filled' then
    perform money_close_backup(p_booking.id, 'no_show', p_now);
  end if;

  perform money_event('booking', p_booking.id, 'no_show', p_actor,
    jsonb_build_object('status', p_booking.status),
    jsonb_build_object('status', 'no_show', 'fee_kobo', fee, 'released_kobo', hold_kobo));

  facts := money_booking_facts(p_booking);
  perform money_notify(p_booking.buyer_id, 'no_show_buyer', p_booking.id,
    facts || jsonb_build_object('released_kobo', hold_kobo), p_now);
  perform money_notify(p_booking.farmer_id, 'no_show_farmer', p_booking.id,
    facts || jsonb_build_object('fee_kobo', fee), p_now);

  banned := money_farmer_banned_until(p_booking.farmer_id, p_now);
  if banned is not null then
    perform money_notify(p_booking.farmer_id, 'farmer_paused', p_booking.id,
      facts || jsonb_build_object('until', banned), p_now);
  end if;
end $$;

create or replace function money_cancel_farmer(p_booking uuid, p_farmer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  s slots;
  hold_kobo bigint;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.farmer_id <> p_farmer then return money_fail('not_your_booking'); end if;
  if b.status not in ('pending_approval', 'booked', 'confirmed') or b.arrived_at is not null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  select * into strict s from slots where id = b.slot_id;

  if b.status = 'confirmed' and p_now >= s.cutoff_at then
    perform money_apply_no_show(b, p_farmer::text, p_now);
    return jsonb_build_object('ok', true, 'status', 'no_show');
  end if;

  select amount_kobo into strict hold_kobo from money_holds where booking_id = b.id;
  perform wallet_release(b.id, hold_kobo, 'farmer_cancel');
  update bookings set status = 'cancelled', closed_reason = 'farmer_cancelled' where id = b.id;
  perform money_reopen_capacity(b, p_now);
  perform money_event('booking', b.id, 'cancelled', p_farmer::text,
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'cancelled'));
  perform money_notify(b.buyer_id, 'farmer_cancelled', b.id, money_booking_facts(b), p_now);
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end $$;

create or replace function money_cancel_buyer(p_booking uuid, p_buyer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  s slots;
  hold_kobo bigint;
  fee bigint := 0;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status not in ('booked', 'confirmed') or b.arrived_at is not null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  select * into strict s from slots where id = b.slot_id;
  select amount_kobo into strict hold_kobo from money_holds where booking_id = b.id;

  if p_now >= s.cutoff_at then
    fee := least(hold_kobo, money_round_kobo(money_booking_minimum(b) * money_rule('LATE_CANCEL_FEE_PCT') / 100));
    perform wallet_settle(b.id, b.farmer_id, fee, 'late_cancel');
    perform money_create_settlement(b, fee, 0, fee, 'late_cancel');
    perform money_add_strike('late_cancel', b.id, null, p_buyer, p_now);
  end if;

  perform wallet_release(b.id, hold_kobo - fee, 'buyer_cancel');
  update bookings set status = 'cancelled', closed_reason = 'buyer_cancelled' where id = b.id;
  perform money_reopen_capacity(b, p_now);
  perform money_close_backup(b.id, 'buyer_cancelled', p_now);
  perform money_event('booking', b.id, 'cancelled', p_buyer::text,
    jsonb_build_object('status', b.status),
    jsonb_build_object('status', 'cancelled', 'late_fee_kobo', fee));
  perform money_notify(b.farmer_id, 'buyer_cancelled', b.id,
    money_booking_facts(b) || jsonb_build_object('fee_kobo', fee), p_now);
  return jsonb_build_object('ok', true, 'status', 'cancelled', 'late_fee_kobo', fee);
end $$;

-- "I'm running late". Changes no deadline.
create or replace function money_running_late(p_booking uuid, p_farmer uuid, p_expected timestamptz default null, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.farmer_id <> p_farmer then return money_fail('not_your_booking'); end if;
  if b.status <> 'confirmed' or b.arrived_at is not null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  update bookings set late_notice_at = p_now, late_expected_at = p_expected where id = b.id;
  perform money_event('booking', b.id, 'running_late', p_farmer::text, null,
    jsonb_build_object('expected_at', p_expected));
  perform money_notify(b.buyer_id, 'running_late', b.id,
    money_booking_facts(b) || jsonb_build_object('expected_at', p_expected), p_now, '{}', null, false);
  return jsonb_build_object('ok', true);
end $$;

create or replace function money_keep_waiting(p_booking uuid, p_buyer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status <> 'confirmed' or b.arrived_at is not null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  update bookings set keep_waiting_at = p_now where id = b.id;
  perform money_event('booking', b.id, 'keep_waiting', p_buyer::text, null, null);
  return jsonb_build_object('ok', true);
end $$;

-- "Find backup farmers". A new listing and day, linked to the booking, so booking it runs book_slot's
-- rules unchanged. Funds: what's free now plus what's held for the missing farmer must cover it.
create or replace function money_request_backup(
  p_booking uuid, p_buyer uuid, p_deadline timestamptz default null, p_price_kobo bigint default null,
  p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  b bookings;
  s slots;
  l demand_listings;
  deadline timestamptz;
  price bigint;
  needed bigint;
  covered bigint;
  child uuid;
  child_slot uuid;
  req_id uuid;
  farmer record;
  told int := 0;
  buyer_name text;
  facts jsonb;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status <> 'confirmed' or b.arrived_at is not null or b.backup_request_id is not null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  if exists (select 1 from backup_requests where booking_id = b.id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  select * into strict s from slots where id = b.slot_id;
  select * into strict l from demand_listings where id = s.listing_id;
  if p_now < s.window_start then return money_fail('too_early'); end if;

  deadline := coalesce(p_deadline, b.window_end + make_interval(hours => money_rule('NO_SHOW_GRACE_HOURS')::int));
  if deadline <= p_now or deadline > (s.date + 1)::timestamp at time zone 'Africa/Lagos' then
    return money_fail('invalid_deadline');
  end if;
  price := coalesce(p_price_kobo, b.unit_price_kobo);
  if price < b.unit_price_kobo then return money_fail('price_too_low'); end if;

  needed := ceil(b.qty * l.max_unit_weight_kg * price)::bigint;
  covered := wallet_get_available(p_buyer) + (select amount_kobo from money_holds where booking_id = b.id);
  if covered < needed then
    return money_fail('needs_more_funds', jsonb_build_object('short_kobo', needed - covered));
  end if;

  insert into demand_listings (buyer_id, commodity_id, spec, unit_price_kobo, capacity_per_day, cutoff_hours, min_qty,
    min_unit_weight_kg, max_unit_weight_kg, delivery_mode, area_id, backup_of_booking, created_at)
  values (p_buyer, l.commodity_id, l.spec, price, b.qty, 0, 1, l.min_unit_weight_kg, l.max_unit_weight_kg,
    l.delivery_mode, l.area_id, b.id, p_now)
  returning id into child;
  insert into listing_private (listing_id, delivery_address)
  select child, delivery_address from listing_private where listing_id = l.id;
  insert into slots (listing_id, date, window_start, window_end, cutoff_at, capacity_total, capacity_remaining)
  values (child, s.date, p_now, deadline, deadline, b.qty, b.qty)
  returning id into child_slot;

  insert into backup_requests (booking_id, buyer_id, listing_id, slot_id, qty, price_kobo, deadline_at, created_at)
  values (b.id, p_buyer, child, child_slot, b.qty, price, deadline, p_now)
  returning id into req_id;

  perform money_event('backup', req_id, 'created', p_buyer::text, null, jsonb_build_object(
    'booking_id', b.id, 'qty', b.qty, 'price_kobo', price, 'deadline_at', deadline));

  facts := money_booking_facts(b);
  buyer_name := facts ->> 'buyer';
  for farmer in
    select * from money_nearby_farmers(child, money_rule('BACKUP_NOTIFY_MAX')::int, s.date, b.farmer_id)
  loop
    insert into backup_notified (request_id, farmer_id) values (req_id, farmer.farmer_id);
    perform money_notify(farmer.farmer_id, 'backup_request', null, jsonb_build_object(
      'buyer', buyer_name, 'qty', b.qty, 'goods', facts ->> 'goods', 'area', facts ->> 'area',
      'deadline_at', deadline, 'distance_km', farmer.distance_km,
      'price_kobo', price, 'price_unit', facts ->> 'price_unit'), p_now);
    told := told + 1;
  end loop;

  return jsonb_build_object('ok', true, 'request_id', req_id, 'slot_id', child_slot, 'told', told,
    'deadline_at', deadline, 'price_kobo', price);
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
  if b.status not in ('confirmed', 'contested') then return money_fail('wrong_state', jsonb_build_object('status', b.status)); end if;
  if b.code_locked_at is not null then return money_fail('code_locked'); end if;

  if b.delivery_code_hash = extensions.crypt(p_digits, b.delivery_code_hash) then
    -- The buyer gave the code after all, so a report ends here.
    update bookings set arrived_at = p_now, status = 'confirmed' where id = b.id;
    if b.status = 'contested' then
      update code_reports set status = 'resolved', decision = 'code_given', decided_at = p_now where booking_id = b.id;
    end if;
    perform money_event('booking', b.id, 'arrived', p_farmer::text,
      jsonb_build_object('status', b.status), jsonb_build_object('arrived_at', p_now, 'status', 'confirmed'));
    perform money_close_backup(b.id, 'original_arrived', p_now);
    perform money_notify(b.buyer_id, 'farmer_arrived', b.id, money_booking_facts(b) || jsonb_build_object(
      'record_by', p_now + make_interval(hours => money_rule('BUYER_RECORD_HOURS')::int)), p_now);
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

-- "They won't give me the code". While this is open, no no-show can be recorded.
create or replace function money_report_no_code(p_booking uuid, p_farmer uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  b bookings;
  s slots;
  deadline timestamptz := p_now + make_interval(mins => money_rule('NOCODE_BUYER_RESPONSE_MINUTES')::int);
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.farmer_id <> p_farmer then return money_fail('not_your_booking'); end if;
  if b.status <> 'confirmed' or b.arrived_at is not null then
    return money_fail('wrong_state', jsonb_build_object('status', b.status));
  end if;
  select * into strict s from slots where id = b.slot_id;
  if p_now < s.window_start or p_now >= b.window_end + make_interval(hours => money_rule('NOCODE_GRACE_HOURS')::int) then
    return money_fail('report_window_closed');
  end if;

  insert into code_reports (booking_id, buyer_deadline_at, created_at) values (b.id, deadline, p_now);
  update bookings set status = 'contested' where id = b.id;
  perform money_event('booking', b.id, 'contested', p_farmer::text,
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'contested', 'buyer_deadline_at', deadline));
  perform money_notify(b.buyer_id, 'nocode_buyer', b.id,
    money_booking_facts(b) || jsonb_build_object('respond_by', deadline), p_now);
  return jsonb_build_object('ok', true, 'status', 'contested', 'buyer_deadline_at', deadline);
end $$;

-- A decline with a reason and a photo is a normal quality rejection: reserve released, no penalty.
create or replace function money_nocode_decline(
  p_booking uuid, p_buyer uuid, p_reason text, p_photo_url text, p_note text default null, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  b bookings;
  hold_kobo bigint;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.buyer_id <> p_buyer then return money_fail('not_your_booking'); end if;
  if b.status <> 'contested' then return money_fail('wrong_state', jsonb_build_object('status', b.status)); end if;
  if coalesce(p_reason, '') not in ('dead_on_arrival', 'underweight', 'sick_or_injured', 'outside_spec', 'other') then
    return money_fail('invalid_reason');
  end if;
  if coalesce(btrim(p_photo_url), '') = '' then return money_fail('photo_required'); end if;

  select amount_kobo into strict hold_kobo from money_holds where booking_id = b.id;
  perform wallet_release(b.id, hold_kobo, 'nocode_declined');
  update bookings set status = 'cancelled', closed_reason = 'buyer_declined_delivery' where id = b.id;
  update code_reports set status = 'resolved', decision = 'buyer_declined', decline_reason = p_reason,
    decline_photo_url = p_photo_url, decline_note = p_note, decided_by = p_buyer, decided_at = p_now
  where booking_id = b.id;
  perform money_reopen_capacity(b, p_now);
  perform money_event('booking', b.id, 'delivery_declined', p_buyer::text,
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'cancelled', 'reason', p_reason));
  perform money_notify(b.farmer_id, 'nocode_declined', b.id,
    money_booking_facts(b) || jsonb_build_object('reason', p_reason), p_now);
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end $$;

-- Ops' three outcomes, plus the 24-hour default of no fault.
create or replace function money_resolve_code_report(
  p_report uuid, p_decision text, p_actor uuid, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  r code_reports;
  b bookings;
  hold_kobo bigint;
  fee bigint := 0;
  actor text := coalesce(p_actor::text, 'system');
  facts jsonb;
begin
  select * into r from code_reports where id = p_report for update;
  if not found then return money_fail('report_not_found'); end if;
  if r.status = 'resolved' then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  if r.status <> 'ops' then return money_fail('wrong_state'); end if;
  if p_decision not in ('buyer_fault', 'farmer_fault', 'no_fault') then return money_fail('invalid_decision'); end if;
  select * into strict b from bookings where id = r.booking_id for update;
  if b.status <> 'contested' then return money_fail('wrong_state', jsonb_build_object('status', b.status)); end if;

  update code_reports set status = 'resolved', decision = p_decision, decided_by = p_actor, decided_at = p_now where id = r.id;

  if p_decision = 'farmer_fault' then
    perform money_apply_no_show(b, actor, p_now);
  else
    select amount_kobo into strict hold_kobo from money_holds where booking_id = b.id;
    if p_decision = 'buyer_fault' then
      fee := least(hold_kobo, money_round_kobo(money_booking_minimum(b) * money_rule('LATE_CANCEL_FEE_PCT') / 100));
      perform wallet_settle(b.id, b.farmer_id, fee, 'nocode_buyer_fault');
      perform money_create_settlement(b, fee, 0, fee, 'late_cancel');
      perform money_add_strike('refused_code', b.id, null, b.buyer_id, p_now);
    end if;
    perform wallet_release(b.id, hold_kobo - fee, 'nocode_' || p_decision);
    update bookings set status = 'cancelled', closed_reason = p_decision where id = b.id;
    perform money_reopen_capacity(b, p_now);
  end if;

  perform money_event('code_report', r.id, 'resolved', actor,
    jsonb_build_object('status', r.status), jsonb_build_object('decision', p_decision, 'fee_kobo', fee));
  facts := money_booking_facts(b) || jsonb_build_object('decision', p_decision, 'fee_kobo', fee);
  perform money_notify(b.farmer_id, 'nocode_outcome', b.id, facts || jsonb_build_object('side', 'farmer'), p_now);
  perform money_notify(b.buyer_id, 'nocode_outcome', b.id, facts || jsonb_build_object('side', 'buyer'), p_now);
  return jsonb_build_object('ok', true, 'decision', p_decision, 'fee_kobo', fee);
end $$;

create or replace function money_record_delivery(
  p_booking uuid, p_buyer uuid, p_units_received int, p_units_declined int, p_decline_reasons jsonb,
  p_measured_kg numeric, p_scale_photos text[], p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  b bookings;
  gross bigint;
  capped bigint;
  hold_kobo bigint;
  reply_by timestamptz := p_now + make_interval(hours => money_rule('FARMER_REPLY_HOURS')::int);
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

  select amount_kobo into strict hold_kobo from money_holds where booking_id = b.id;
  gross := money_round_kobo(p_measured_kg * b.unit_price_kobo);
  -- The hold can be short only if backups used it and the money couldn't be returned.
  capped := least(gross, b.reserve_kobo, hold_kobo);
  if capped < gross then
    perform money_event('booking', b.id, 'gross_capped_at_reserve', p_buyer::text,
      jsonb_build_object('gross_kobo', gross), jsonb_build_object('gross_kobo', capped));
  end if;

  insert into deliveries (booking_id, units_received, units_declined, decline_reasons, measured_kg,
    scale_photo_urls, recorded_by, recorded_at, gross_kobo, reply_deadline)
  values (b.id, p_units_received, p_units_declined, coalesce(p_decline_reasons, '[]'), p_measured_kg,
    p_scale_photos, p_buyer, p_now, capped, reply_by);

  update bookings set status = 'delivered' where id = b.id;
  perform money_event('booking', b.id, 'delivered', p_buyer::text,
    jsonb_build_object('status', b.status),
    jsonb_build_object('status', 'delivered', 'measured_kg', p_measured_kg, 'gross_kobo', capped));

  perform money_notify(b.farmer_id, 'weigh_in', b.id, money_booking_facts(b) || jsonb_build_object(
    'measured_kg', p_measured_kg, 'gross_kobo', capped, 'scale_photo', p_scale_photos[1],
    'units_received', p_units_received, 'units_declined', p_units_declined, 'reply_by', reply_by),
    p_now, array['confirm_weight', 'dispute'], reply_by);
  return jsonb_build_object('ok', true, 'gross_kobo', capped);
end $$;
