-- Settlement with the farmer's fee, the deadline sweep, and messages for everything that used to
-- send an SMS. Replaces the earlier versions of these functions.

-- Pays the farmer out of the hold: Lumora's fee first (free within their first deliveries), then
-- fees they owe, then the rest.
create or replace function money_pay_farmer(p_booking bookings, p_amount bigint, p_kind text)
returns bigint language plpgsql as $$
declare
  owed record;
  left_to_pay bigint := p_amount;
  take bigint;
  buyer_part bigint;
  fee_buyer uuid;
  fees bigint := 0;
  farmer_fee bigint := 0;
  settlement uuid;
begin
  if p_amount <= 0 then return 0; end if;

  if (select count(*) from bookings where farmer_id = p_booking.farmer_id and status = 'settled')
      >= money_rule('FREE_FARMER_DELIVERIES') then
    farmer_fee := money_round_kobo(p_amount * money_rule('FARMER_FEE_PCT') / 100);
    perform money_post('farmer_fee:' || p_booking.id || ':' || p_kind, 'buyer_reserved', p_booking.buyer_id,
      'lumora_revenue', null, farmer_fee, p_booking.id, 'farmer fee');
    left_to_pay := left_to_pay - farmer_fee;
    fees := farmer_fee;
  end if;

  for owed in
    select * from money_pending_fees
    where farmer_id = p_booking.farmer_id and collected_kobo < amount_kobo
    order by created_at for update
  loop
    exit when left_to_pay = 0;
    take := least(left_to_pay, owed.amount_kobo - owed.collected_kobo);
    buyer_part := floor(take * owed.buyer_share_pct / 100.0)::bigint;
    select buyer_id into fee_buyer from bookings where id = owed.booking_id;

    perform money_post('fee:' || owed.id || ':' || p_booking.id || ':' || p_kind || ':buyer',
      'buyer_reserved', p_booking.buyer_id, 'buyer_available', fee_buyer, buyer_part,
      p_booking.id, 'no-show fee, buyer share');
    perform money_post('fee:' || owed.id || ':' || p_booking.id || ':' || p_kind || ':lumora',
      'buyer_reserved', p_booking.buyer_id, 'lumora_revenue', null, take - buyer_part,
      p_booking.id, owed.reason || ' fee');

    update money_pending_fees set collected_kobo = collected_kobo + take where id = owed.id;
    left_to_pay := left_to_pay - take;
    fees := fees + take;
  end loop;

  perform wallet_settle(p_booking.id, p_booking.farmer_id, left_to_pay, p_kind);
  settlement := money_create_settlement(p_booking, p_amount, fees, left_to_pay, p_kind);
  update money_settlements set farmer_fee_kobo = farmer_fee where id = settlement;
  return left_to_pay;
end $$;

-- Ends a booking: returns what's left of the hold, charges the buyer fee once, marks it settled.
create or replace function money_finish(p_booking bookings, p_actor text, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  hold_kobo bigint;
  total bigint;
  farmer_fee bigint;
  all_fees bigint;
  net bigint;
  fee bigint;
  available bigint;
  charged bigint;
  kg numeric;
  facts jsonb;
begin
  select amount_kobo into strict hold_kobo from money_holds where booking_id = p_booking.id;
  perform wallet_release(p_booking.id, hold_kobo, 'settlement_remainder');

  select coalesce(sum(gross_kobo), 0), coalesce(sum(farmer_fee_kobo), 0), coalesce(sum(fees_kobo), 0), coalesce(sum(net_kobo), 0)
  into total, farmer_fee, all_fees, net
  from money_settlements where booking_id = p_booking.id;
  fee := money_round_kobo(total * money_rule('BUYER_FEE_PCT') / 100);

  perform 1 from money_balances
  where bucket = 'buyer_available' and owner_id = p_booking.buyer_id for update;
  available := wallet_get_available(p_booking.buyer_id);
  charged := least(fee, available);
  perform money_post('buyer_fee:' || p_booking.id, 'buyer_available', p_booking.buyer_id,
    'lumora_revenue', null, charged, p_booking.id, 'buyer fee');
  if fee > charged then
    insert into money_receivables (buyer_id, booking_id, amount_kobo, reason)
    values (p_booking.buyer_id, p_booking.id, fee - charged, 'buyer_fee');
  end if;

  update bookings set status = 'settled' where id = p_booking.id;
  perform money_event('booking', p_booking.id, 'settled', p_actor,
    jsonb_build_object('status', p_booking.status),
    jsonb_build_object('status', 'settled', 'gross_kobo', total, 'farmer_fee_kobo', farmer_fee,
      'buyer_fee_kobo', fee, 'released_kobo', hold_kobo));

  select measured_kg into kg from deliveries where booking_id = p_booking.id;
  facts := money_booking_facts(p_booking) || jsonb_build_object('gross_kobo', total, 'measured_kg', kg);
  perform money_notify(p_booking.farmer_id, 'payout_breakdown', p_booking.id, facts || jsonb_build_object(
    'farmer_fee_kobo', farmer_fee, 'fees_owed_kobo', all_fees - farmer_fee, 'net_kobo', net), p_now);
  perform money_notify(p_booking.buyer_id, 'receipt', p_booking.id, facts || jsonb_build_object(
    'buyer_fee_kobo', fee, 'released_kobo', hold_kobo), p_now);

  return jsonb_build_object('ok', true, 'status', 'settled', 'gross_kobo', total,
    'farmer_fee_kobo', farmer_fee, 'buyer_fee_kobo', fee, 'released_kobo', hold_kobo);
end $$;

create or replace function money_open_dispute(
  p_booking bookings, p_delivery deliveries, p_claim_kg numeric, p_now timestamptz
) returns jsonb language plpgsql as $$
declare
  gross bigint := p_delivery.gross_kobo;
  claim bigint;
  difference bigint;
  hold_kobo bigint;
  facts jsonb;
begin
  if p_claim_kg is null then
    difference := p_booking.reserve_kobo - gross;
  else
    claim := least(money_round_kobo(p_claim_kg * p_booking.unit_price_kobo), p_booking.reserve_kobo);
    difference := greatest(claim - gross, 0);
  end if;

  update deliveries set farmer_reply = 'dispute', farmer_reply_at = p_now where id = p_delivery.id;
  perform money_pay_farmer(p_booking, gross, 'undisputed');

  -- Within tolerance, so it isn't worth anyone's time. The farmer gets the difference.
  if difference <= gross * money_rule('WEIGHT_TOLERANCE') then
    perform money_pay_farmer(p_booking, difference, 'dispute_top_up');
    perform money_event('booking', p_booking.id, 'dispute_auto_resolved', 'system', null,
      jsonb_build_object('difference_kobo', difference));
    return money_finish(p_booking, 'system', p_now) || jsonb_build_object('auto_resolved', true);
  end if;

  -- Only the difference stays held.
  select amount_kobo into strict hold_kobo from money_holds where booking_id = p_booking.id;
  perform wallet_release(p_booking.id, hold_kobo - difference, 'dispute_excess');

  insert into disputes (booking_id, opened_by, undisputed_kobo, disputed_kobo, deadline_at, evidence, created_at)
  values (p_booking.id, p_booking.farmer_id, gross, difference,
    p_now + make_interval(hours => money_rule('DISPUTE_DECISION_HOURS')::int),
    jsonb_build_object('claim_kg', p_claim_kg, 'recorded_kg', p_delivery.measured_kg), p_now);

  update bookings set status = 'disputed' where id = p_booking.id;
  perform money_event('booking', p_booking.id, 'disputed', p_booking.farmer_id::text,
    jsonb_build_object('status', p_booking.status),
    jsonb_build_object('status', 'disputed', 'undisputed_kobo', gross, 'disputed_kobo', difference));
  facts := money_booking_facts(p_booking) || jsonb_build_object('undisputed_kobo', gross, 'disputed_kobo', difference);
  perform money_notify(p_booking.farmer_id, 'dispute_opened', p_booking.id, facts || jsonb_build_object('side', 'farmer'), p_now);
  perform money_notify(p_booking.buyer_id, 'dispute_opened', p_booking.id, facts || jsonb_build_object('side', 'buyer'), p_now);
  return jsonb_build_object('ok', true, 'status', 'disputed', 'undisputed_kobo', gross, 'disputed_kobo', difference);
end $$;

create or replace function money_resolve_dispute(
  p_dispute uuid, p_decision text, p_custom_kobo bigint, p_actor uuid, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  d disputes;
  b bookings;
  held_total bigint;
  minimum bigint;
  final_total bigint;
  actor text := coalesce(p_actor::text, 'system');
  facts jsonb;
begin
  select * into d from disputes where id = p_dispute for update;
  if not found then return money_fail('dispute_not_found'); end if;
  if d.status = 'resolved' then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  select * into strict b from bookings where id = d.booking_id for update;

  held_total := d.undisputed_kobo + d.disputed_kobo;

  if p_decision in ('pay_recorded', 'deadline_default') then
    final_total := d.undisputed_kobo;
  elsif p_decision = 'pay_booked_minimum' then
    minimum := money_booking_minimum(b);
    final_total := least(greatest(minimum, d.undisputed_kobo), held_total);
  elsif p_decision = 'custom' then
    if p_custom_kobo is null or p_custom_kobo < d.undisputed_kobo or p_custom_kobo > b.reserve_kobo then
      return money_fail('custom_out_of_range',
        jsonb_build_object('min_kobo', d.undisputed_kobo, 'max_kobo', b.reserve_kobo));
    end if;
    -- The rest of the reserve went back to the buyer when the dispute opened.
    if p_custom_kobo > held_total then
      return money_fail('above_amount_held', jsonb_build_object('max_kobo', held_total));
    end if;
    final_total := p_custom_kobo;
  else
    return money_fail('invalid_decision');
  end if;

  perform money_pay_farmer(b, final_total - d.undisputed_kobo, 'dispute_top_up');

  update disputes set status = 'resolved', decision = p_decision, decided_by = p_actor, decided_at = p_now
  where id = d.id;
  perform money_event('dispute', d.id, 'resolved', actor,
    jsonb_build_object('status', d.status),
    jsonb_build_object('status', 'resolved', 'decision', p_decision, 'final_kobo', final_total));

  if p_decision = 'deadline_default' then
    perform money_alert('dispute_deadline_missed', jsonb_build_object('dispute_id', d.id, 'booking_id', b.id));
  end if;
  facts := money_booking_facts(b) || jsonb_build_object('final_kobo', final_total);
  perform money_notify(b.farmer_id, 'dispute_decided', b.id, facts, p_now);
  perform money_notify(b.buyer_id, 'dispute_decided', b.id, facts, p_now);
  return money_finish(b, actor, p_now) || jsonb_build_object('final_kobo', final_total);
end $$;

create or replace function money_mark_paid(
  p_payout uuid, p_transfer_id bigint, p_fee_kobo bigint default 0, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  p money_payouts;
begin
  select * into p from money_payouts where id = p_payout for update;
  if not found then return money_fail('payout_not_found'); end if;
  if p.status = 'paid' then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  perform wallet_mark_paid(p_payout);
  perform money_post('transfer_fee:' || p_payout, 'lumora_revenue', null, 'external', null,
    coalesce(nullif(p_fee_kobo, 0), p.fee_kobo), null, 'provider fee on transfer');
  update money_payouts set status = 'paid', paid_at = p_now, flw_transfer_id = p_transfer_id, last_error = null
  where id = p_payout;
  perform money_event('payout', p_payout, 'paid', 'flutterwave',
    jsonb_build_object('status', p.status), jsonb_build_object('status', 'paid', 'transfer_id', p_transfer_id));
  perform money_notify(p.farmer_id, 'payout_sent', null, jsonb_build_object('amount_kobo', p.amount_kobo), p_now);
  return jsonb_build_object('ok', true);
end $$;

create or replace function money_payout_failed(p_payout uuid, p_error text, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  p money_payouts;
begin
  select * into p from money_payouts where id = p_payout for update;
  if not found then return money_fail('payout_not_found'); end if;
  if p.status in ('paid', 'failed') then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  update money_payouts set status = 'failed', last_error = p_error, next_attempt_at = p_now + interval '1 day'
  where id = p_payout;
  perform money_event('payout', p_payout, 'failed', 'flutterwave',
    jsonb_build_object('status', p.status), jsonb_build_object('status', 'failed', 'error', p_error));
  perform money_notify(p.farmer_id, 'payout_failed', null, jsonb_build_object('amount_kobo', p.amount_kobo), p_now);
  if p.attempts >= money_rule('PAYOUT_ALERT_ATTEMPTS') then
    perform money_alert('payout_keeps_failing', jsonb_build_object('payout_id', p_payout, 'attempts', p.attempts));
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- The deadline defaults. Runs every 5 minutes. Every branch re-checks state under a row lock, so
-- running it twice, or alongside someone's answer, can't apply a default twice.
create or replace function money_sweep(p_now timestamptz default now()) returns jsonb language plpgsql as $$
declare
  b bookings;
  d deliveries;
  s slots;
  dispute_row disputes;
  report code_reports;
  req backup_requests;
  hold_kobo bigint;
  gross bigint;
  n_approved int := 0; n_prompted int := 0; n_reminded int := 0; n_released int := 0; n_late_checks int := 0;
  n_no_code int := 0; n_no_code_default int := 0; n_no_show int := 0; n_backups int := 0; n_min_settled int := 0;
  n_auto int := 0; n_disputes int := 0; n_payout_nudges int := 0;
  payout record;
begin
  -- First-time farmers the buyer didn't answer about.
  for b in
    select * from bookings where status = 'pending_approval' and p_now >= approval_deadline for update skip locked
  loop
    perform money_apply_approval(b, 'system', p_now);
    n_approved := n_approved + 1;
  end loop;

  -- Ask farmers to confirm. The column's name is older than email; it records that they were asked.
  for b in
    select * from bookings where status = 'booked' and confirm_sms_at is null
      and p_now >= confirm_by and p_now < confirm_deadline
    for update skip locked
  loop
    update bookings set confirm_sms_at = p_now where id = b.id;
    perform money_notify(b.farmer_id, 'confirm_request', b.id, money_booking_facts(b), p_now,
      array['confirm', 'cancel_farmer'], b.confirm_deadline);
    n_prompted := n_prompted + 1;
  end loop;

  for b in
    select * from bookings where status = 'booked' and confirm_reminded_at is null and p_now < confirm_deadline
      and p_now >= confirm_deadline - make_interval(hours => money_rule('CONFIRM_REMINDER_HOURS_BEFORE_CUTOFF')::int)
      and confirm_sms_at < confirm_deadline - make_interval(hours => money_rule('CONFIRM_REMINDER_HOURS_BEFORE_CUTOFF')::int)
    for update skip locked
  loop
    update bookings set confirm_reminded_at = p_now where id = b.id;
    perform money_notify(b.farmer_id, 'confirm_reminder', b.id, money_booking_facts(b), p_now,
      array['confirm', 'cancel_farmer'], b.confirm_deadline);
    n_reminded := n_reminded + 1;
  end loop;

  -- Not confirmed by the cut-off.
  for b in
    select * from bookings where status = 'booked' and p_now >= confirm_deadline for update skip locked
  loop
    select amount_kobo into strict hold_kobo from money_holds where booking_id = b.id;
    perform wallet_release(b.id, hold_kobo, 'not_confirmed');
    update bookings set status = 'released', closed_reason = 'not_confirmed' where id = b.id;
    s := money_reopen_capacity(b, p_now);
    perform money_offer_freed(b, s, p_now);
    perform money_event('booking', b.id, 'released', 'system',
      jsonb_build_object('status', b.status), jsonb_build_object('status', 'released'));
    perform money_notify(b.farmer_id, 'booking_released', b.id, money_booking_facts(b), p_now);
    n_released := n_released + 1;
  end loop;

  -- Halfway through the window: no code, and no word from the farmer. Not for backups, which are the
  -- answer to this question, or for bookings made after that moment.
  for b in
    select bk.* from bookings bk join slots sl on sl.id = bk.slot_id
    where bk.status = 'confirmed' and bk.arrived_at is null and bk.late_notice_at is null and bk.late_check_at is null
      and bk.backup_request_id is null
      and p_now < bk.window_end + make_interval(hours => money_rule('NO_SHOW_GRACE_HOURS')::int)
      and p_now >= sl.window_start + (bk.window_end - sl.window_start) * money_rule('LATE_CHECK_AT_WINDOW_FRACTION')
      and bk.created_at < sl.window_start + (bk.window_end - sl.window_start) * money_rule('LATE_CHECK_AT_WINDOW_FRACTION')
    for update of bk skip locked
  loop
    update bookings set late_check_at = p_now where id = b.id;
    perform money_event('booking', b.id, 'late_check', 'system', null, null);
    perform money_notify(b.buyer_id, 'not_arrived', b.id, money_booking_facts(b), p_now,
      array['find_backup', 'keep_waiting'],
      b.window_end + make_interval(hours => money_rule('NO_SHOW_GRACE_HOURS')::int));
    n_late_checks := n_late_checks + 1;
  end loop;

  -- The buyer didn't answer a code-not-given report in time. It goes to ops.
  for report in
    select * from code_reports where status = 'open' and p_now >= buyer_deadline_at for update skip locked
  loop
    update code_reports set status = 'ops',
      ops_deadline_at = p_now + make_interval(hours => money_rule('NOCODE_OPS_DECISION_HOURS')::int)
    where id = report.id;
    perform money_event('code_report', report.id, 'sent_to_ops', 'system', jsonb_build_object('status', 'open'), jsonb_build_object('status', 'ops'));
    perform money_alert('code_report_needs_ops', jsonb_build_object('report_id', report.id, 'booking_id', report.booking_id));
    select * into strict b from bookings where id = report.booking_id;
    perform money_notify(b.farmer_id, 'nocode_with_ops', b.id, money_booking_facts(b), p_now);
    n_no_code := n_no_code + 1;
  end loop;

  -- Ops didn't decide in time: no fault.
  for report in
    select * from code_reports where status = 'ops' and p_now >= ops_deadline_at for update skip locked
  loop
    perform money_resolve_code_report(report.id, 'no_fault', null, p_now);
    perform money_alert('code_report_deadline_missed', jsonb_build_object('report_id', report.id, 'booking_id', report.booking_id));
    n_no_code_default := n_no_code_default + 1;
  end loop;

  -- No valid code by the end of the window plus grace. A contested booking isn't 'confirmed', so an
  -- open report can't reach here.
  for b in
    select * from bookings where status = 'confirmed' and arrived_at is null
      and p_now >= window_end + make_interval(hours => money_rule('NO_SHOW_GRACE_HOURS')::int)
    for update skip locked
  loop
    perform money_apply_no_show(b, 'system', p_now);
    n_no_show := n_no_show + 1;
  end loop;

  -- A backup's deadline ends it, and whoever already booked stays booked.
  for req in
    select * from backup_requests where status <> 'closed' and p_now >= deadline_at for update skip locked
  loop
    perform money_close_backup(req.booking_id, 'deadline', p_now);
    n_backups := n_backups + 1;
  end loop;

  -- Valid code, but the buyer never recorded.
  for b in
    select * from bookings where status = 'confirmed' and arrived_at is not null
      and p_now >= arrived_at + make_interval(hours => money_rule('BUYER_RECORD_HOURS')::int)
    for update skip locked
  loop
    gross := money_booking_minimum(b);
    select amount_kobo into strict hold_kobo from money_holds where booking_id = b.id;
    perform money_add_strike('no_record', b.id, null, b.buyer_id, p_now);
    perform money_pay_farmer(b, least(gross, b.reserve_kobo, hold_kobo), 'final');
    perform money_notify(b.buyer_id, 'no_record_buyer', b.id, money_booking_facts(b) || jsonb_build_object('paid_kobo', least(gross, b.reserve_kobo, hold_kobo)), p_now);
    perform money_finish(b, 'system', p_now);
    n_min_settled := n_min_settled + 1;
  end loop;

  -- Silence from the farmer counts as yes.
  for b in
    select bk.* from bookings bk join deliveries dl on dl.booking_id = bk.id
    where bk.status = 'delivered' and dl.farmer_reply = 'none' and p_now >= dl.reply_deadline
    for update of bk skip locked
  loop
    select * into strict d from deliveries where booking_id = b.id;
    update deliveries set auto_confirmed = true where id = d.id;
    perform money_pay_farmer(b, d.gross_kobo, 'final');
    perform money_finish(b, 'system', p_now);
    n_auto := n_auto + 1;
  end loop;

  -- Ops didn't decide a weight dispute in time.
  for dispute_row in
    select * from disputes where status = 'open' and p_now >= deadline_at for update skip locked
  loop
    perform money_resolve_dispute(dispute_row.id, 'deadline_default', null, null, p_now);
    n_disputes := n_disputes + 1;
  end loop;

  -- Farmers whose money is waiting on a usable bank account. Reminded once a day.
  for payout in
    select p.id, p.farmer_id, p.amount_kobo from money_payouts p
    left join payout_accounts a on a.farmer_id = p.farmer_id and a.name_match
    where p.status = 'queued' and a.id is null and p.next_attempt_at <= p_now
    for update of p skip locked
  loop
    update money_payouts set next_attempt_at = p_now + interval '1 day', attempts = attempts + 1 where id = payout.id;
    perform money_notify(payout.farmer_id, 'payout_needs_account', null, jsonb_build_object('amount_kobo', payout.amount_kobo), p_now);
    n_payout_nudges := n_payout_nudges + 1;
  end loop;

  perform money_flag_pairs();

  return jsonb_build_object('ok', true, 'auto_approved', n_approved, 'prompted', n_prompted, 'reminded', n_reminded,
    'released', n_released, 'late_checks', n_late_checks, 'no_code_to_ops', n_no_code,
    'no_code_defaulted', n_no_code_default, 'no_show', n_no_show, 'backups_closed', n_backups,
    'min_settled', n_min_settled, 'auto_confirmed', n_auto, 'disputes_defaulted', n_disputes,
    'payout_nudges', n_payout_nudges);
end $$;

-- As live, with card funding allowed, plus what a top-up has to do for a listing paused for low funds.
create or replace function money_credit_deposit(
  p_tx_id bigint, p_tx_ref text, p_amount bigint, p_provider_fee bigint, p_payment_type text,
  p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  buyer uuid;
  completed int;
  funded bigint;
  room bigint;
  credited bigint;
  over bigint;
  inserted int;
  debt record;
  available bigint;
  take bigint;
begin
  if exists (select 1 from money_deposits where flw_tx_id = p_tx_id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  select buyer_id into buyer from money_funding_accounts where tx_ref = p_tx_ref;
  if not found then
    perform money_alert('deposit_unknown_reference', jsonb_build_object('tx_id', p_tx_id, 'tx_ref', p_tx_ref));
    return money_fail('unknown_reference');
  end if;

  -- One buyer's deposits run one at a time, so the funding cap can't be raced.
  perform pg_advisory_xact_lock(hashtext('deposit:' || buyer));

  select count(*) into completed from bookings where buyer_id = buyer and status = 'settled';
  if completed < money_rule('NEW_BUYER_COMPLETED_DELIVERIES') then
    select coalesce(sum(amount_kobo - over_cap_kobo), 0) into funded from money_deposits where buyer_id = buyer;
    room := greatest(money_rule('NEW_BUYER_FUNDING_CAP_KOBO')::bigint - funded, 0);
    credited := least(p_amount, room);
  else
    credited := p_amount;
  end if;
  over := p_amount - credited;

  insert into money_deposits (flw_tx_id, buyer_id, tx_ref, amount_kobo, provider_fee_kobo, over_cap_kobo,
    refund_due_at, refund_status, created_at)
  values (p_tx_id, buyer, p_tx_ref, p_amount, p_provider_fee, over,
    case when over > 0 then p_now + make_interval(hours => money_rule('OVER_CAP_REFUND_HOURS')::int) end,
    case when over > 0 then 'due' end, p_now)
  on conflict (flw_tx_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  perform money_post('deposit:' || p_tx_id, 'external', null, 'buyer_available', buyer, credited, null, 'deposit');
  perform money_post('deposit_over_cap:' || p_tx_id, 'external', null, 'buyer_over_cap', buyer, over, null, 'deposit over cap');
  perform money_post('deposit_fee:' || p_tx_id, 'lumora_revenue', null, 'external', null,
    coalesce(p_provider_fee, 0), null, 'provider fee on deposit');

  perform money_event('deposit', null, 'credited', 'paystack', null, jsonb_build_object(
    'tx_id', p_tx_id, 'buyer_id', buyer, 'credited_kobo', credited, 'over_cap_kobo', over));
  if over > 0 then
    perform money_alert('deposit_over_cap', jsonb_build_object('tx_id', p_tx_id, 'buyer_id', buyer, 'over_cap_kobo', over));
  end if;

  -- Fees the buyer couldn't cover earlier come off first.
  for debt in
    select * from money_receivables where buyer_id = buyer and collected_kobo < amount_kobo
    order by created_at for update
  loop
    available := wallet_get_available(buyer);
    exit when available = 0;
    take := least(available, debt.amount_kobo - debt.collected_kobo);
    perform money_post('receivable:' || debt.id || ':' || p_tx_id, 'buyer_available', buyer,
      'lumora_revenue', null, take, debt.booking_id, debt.reason);
    update money_receivables set collected_kobo = collected_kobo + take where id = debt.id;
  end loop;

  update demand_listings set status = 'active', paused_reason = null
  where buyer_id = buyer and status = 'paused' and paused_reason = 'insufficient_funds';

  return jsonb_build_object('ok', true, 'buyer_id', buyer, 'credited_kobo', credited, 'over_cap_kobo', over);
end $$;
