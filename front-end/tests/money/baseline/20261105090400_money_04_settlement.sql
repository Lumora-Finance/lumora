-- Settlement, disputes, deposits, payouts, the deadline sweep and reconciliation.

-- Pays the farmer out of the hold, with any fees they owe taken off first.
create or replace function money_pay_farmer(p_booking bookings, p_amount bigint, p_kind text)
returns bigint language plpgsql as $$
declare
  fee record;
  left_to_pay bigint := p_amount;
  take bigint;
  buyer_part bigint;
  fee_buyer uuid;
  fees bigint := 0;
begin
  if p_amount <= 0 then return 0; end if;

  for fee in
    select * from money_pending_fees
    where farmer_id = p_booking.farmer_id and collected_kobo < amount_kobo
    order by created_at for update
  loop
    exit when left_to_pay = 0;
    take := least(left_to_pay, fee.amount_kobo - fee.collected_kobo);
    buyer_part := floor(take * fee.buyer_share_pct / 100.0)::bigint;
    select buyer_id into fee_buyer from bookings where id = fee.booking_id;

    perform money_post('fee:' || fee.id || ':' || p_booking.id || ':' || p_kind || ':buyer',
      'buyer_reserved', p_booking.buyer_id, 'buyer_available', fee_buyer, buyer_part,
      p_booking.id, 'no-show fee, buyer share');
    perform money_post('fee:' || fee.id || ':' || p_booking.id || ':' || p_kind || ':lumora',
      'buyer_reserved', p_booking.buyer_id, 'lumora_revenue', null, take - buyer_part,
      p_booking.id, fee.reason || ' fee');

    update money_pending_fees set collected_kobo = collected_kobo + take where id = fee.id;
    left_to_pay := left_to_pay - take;
    fees := fees + take;
  end loop;

  perform wallet_settle(p_booking.id, p_booking.farmer_id, left_to_pay, p_kind);
  perform money_create_settlement(p_booking, p_amount, fees, left_to_pay, p_kind);
  return left_to_pay;
end $$;

-- Ends a booking: returns what's left of the hold, charges the buyer fee once, marks it settled.
create or replace function money_finish(p_booking bookings, p_actor text, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  hold bigint;
  total bigint;
  fee bigint;
  available bigint;
  charged bigint;
begin
  select amount_kobo into strict hold from money_holds where booking_id = p_booking.id;
  perform wallet_release(p_booking.id, hold, 'settlement_remainder');

  select coalesce(sum(gross_kobo), 0) into total from money_settlements where booking_id = p_booking.id;
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
    jsonb_build_object('status', 'settled', 'gross_kobo', total, 'buyer_fee_kobo', fee,
      'released_kobo', hold));
  perform money_sms((select phone from users where id = p_booking.farmer_id),
    format('%s settled: %s. Your payout is on its way.', p_booking.code, money_naira(total)));
  return jsonb_build_object('ok', true, 'status', 'settled', 'gross_kobo', total,
    'buyer_fee_kobo', fee, 'released_kobo', hold);
end $$;

create or replace function money_open_dispute(
  p_booking bookings, p_delivery deliveries, p_claim_kg numeric, p_now timestamptz
) returns jsonb language plpgsql as $$
declare
  gross bigint := p_delivery.gross_kobo;
  claim bigint;
  difference bigint;
  hold bigint;
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
  select amount_kobo into strict hold from money_holds where booking_id = p_booking.id;
  perform wallet_release(p_booking.id, hold - difference, 'dispute_excess');

  insert into disputes (booking_id, opened_by, undisputed_kobo, disputed_kobo, deadline_at, evidence, created_at)
  values (p_booking.id, p_booking.farmer_id, gross, difference,
    p_now + make_interval(hours => money_rule('DISPUTE_DECISION_HOURS')::int),
    jsonb_build_object('claim_kg', p_claim_kg, 'recorded_kg', p_delivery.measured_kg), p_now);

  update bookings set status = 'disputed' where id = p_booking.id;
  perform money_event('booking', p_booking.id, 'disputed', p_booking.farmer_id::text,
    jsonb_build_object('status', p_booking.status),
    jsonb_build_object('status', 'disputed', 'undisputed_kobo', gross, 'disputed_kobo', difference));
  perform money_sms((select phone from users where id = p_booking.farmer_id),
    format('%s paid now. %s is under review. We decide within %s hours.',
      money_naira(gross), money_naira(difference), money_rule('DISPUTE_DECISION_HOURS')));
  perform money_sms((select phone from users where id = p_booking.buyer_id),
    format('The farmer disputed booking %s. %s is on hold while we review it.',
      p_booking.code, money_naira(difference)));
  return jsonb_build_object('ok', true, 'status', 'disputed', 'undisputed_kobo', gross, 'disputed_kobo', difference);
end $$;

create or replace function money_farmer_reply(
  p_booking uuid, p_farmer uuid, p_reply text, p_claim_kg numeric default null, p_now timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  b bookings;
  d deliveries;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.farmer_id <> p_farmer then return money_fail('not_your_booking'); end if;
  if b.status in ('settled', 'disputed') then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  if b.status <> 'delivered' then return money_fail('wrong_state', jsonb_build_object('status', b.status)); end if;
  select * into strict d from deliveries where booking_id = b.id;

  if p_reply = 'yes' then
    update deliveries set farmer_reply = 'yes', farmer_reply_at = p_now where id = d.id;
    perform money_pay_farmer(b, d.gross_kobo, 'final');
    return money_finish(b, p_farmer::text, p_now);
  elsif p_reply = 'dispute' then
    return money_open_dispute(b, d, p_claim_kg, p_now);
  end if;
  return money_fail('invalid_reply');
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
begin
  select * into d from disputes where id = p_dispute for update;
  if not found then return money_fail('dispute_not_found'); end if;
  if d.status = 'resolved' then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  select * into strict b from bookings where id = d.booking_id for update;

  held_total := d.undisputed_kobo + d.disputed_kobo;

  if p_decision in ('pay_recorded', 'deadline_default') then
    final_total := d.undisputed_kobo;
  elsif p_decision = 'pay_booked_minimum' then
    select money_round_kobo(b.qty * l.min_unit_weight_kg * b.unit_price_kobo) into strict minimum
    from slots s join demand_listings l on l.id = s.listing_id where s.id = b.slot_id;
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
  return money_finish(b, actor, p_now) || jsonb_build_object('final_kobo', final_total);
end $$;

-- Deposits. Only ever called after the webhook is verified and the transaction re-verified.
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
  if lower(coalesce(p_payment_type, '')) not like '%bank%' then
    perform money_alert('deposit_not_bank_transfer',
      jsonb_build_object('tx_id', p_tx_id, 'buyer_id', buyer, 'payment_type', p_payment_type));
    return money_fail('not_bank_transfer');
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

  perform money_event('deposit', null, 'credited', 'flutterwave', null, jsonb_build_object(
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

  return jsonb_build_object('ok', true, 'credited_kobo', credited, 'over_cap_kobo', over);
end $$;

create or replace function money_refunds_due(p_now timestamptz default now()) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('tx_id', flw_tx_id, 'amount_kobo', over_cap_kobo)), '[]')
  from money_deposits where refund_status = 'due' and refund_due_at <= p_now;
$$;

create or replace function money_refund_sent(p_tx_id bigint) returns jsonb language plpgsql as $$
declare
  d money_deposits;
begin
  select * into d from money_deposits where flw_tx_id = p_tx_id for update;
  if not found or d.refund_status is distinct from 'due' then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  perform money_post('refund:' || p_tx_id, 'buyer_over_cap', d.buyer_id, 'external', null, d.over_cap_kobo, null, 'over-cap refund');
  update money_deposits set refund_status = 'sent' where flw_tx_id = p_tx_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function money_save_funding_account(
  p_buyer uuid, p_tx_ref text, p_account_number text, p_bank_name text, p_order_ref text
) returns jsonb language plpgsql as $$
begin
  insert into money_funding_accounts (buyer_id, tx_ref, account_number, bank_name, order_ref)
  values (p_buyer, p_tx_ref, p_account_number, p_bank_name, p_order_ref)
  on conflict (buyer_id) do nothing;
  return (select to_jsonb(a) from money_funding_accounts a where a.buyer_id = p_buyer);
end $$;

create or replace function money_get_funding_account(p_buyer uuid) returns jsonb language sql stable as $$
  select to_jsonb(a) from money_funding_accounts a where a.buyer_id = p_buyer;
$$;

-- Outbound SMS. Two runs of the job can't pick up the same message.
create or replace function money_outbox_claim(p_limit int default 50) returns jsonb language plpgsql as $$
declare
  claimed jsonb;
begin
  with next_up as (
    select id from sms_outbox where status = 'queued' order by created_at limit p_limit for update skip locked
  ), updated as (
    update sms_outbox o set status = 'sent', sent_at = now(), attempts = attempts + 1
    from next_up where o.id = next_up.id returning o.id, o.phone, o.body
  )
  select coalesce(jsonb_agg(to_jsonb(updated)), '[]') into claimed from updated;
  return claimed;
end $$;

-- A send that failed goes back in the queue, up to five tries.
create or replace function money_outbox_failed(p_id uuid) returns void language sql as $$
  update sms_outbox set sent_at = null, status = case when attempts >= 5 then 'failed' else 'queued' end
  where id = p_id;
$$;

-- Hands out payouts to send. A claimed row can't be claimed again, unless the sender died part way.
create or replace function money_claim_payouts(p_now timestamptz default now(), p_limit int default 20)
returns jsonb language plpgsql as $$
declare
  claimed jsonb;
begin
  if (select value from money_flags where key = 'payouts_paused') then
    return '[]'::jsonb;
  end if;

  with next_up as (
    select p.id from money_payouts p
    join payout_accounts a on a.farmer_id = p.farmer_id and a.name_match
    where (p.status in ('queued', 'failed') and p.next_attempt_at <= p_now)
       or (p.status = 'sending' and p.claimed_at < p_now - interval '15 minutes')
    order by p.created_at
    limit p_limit
    for update of p skip locked
  ), updated as (
    update money_payouts p
    set status = 'sending', claimed_at = p_now, attempts = attempts + 1
    from next_up where p.id = next_up.id
    returning p.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'payout_id', u.id, 'reference', u.settlement_id, 'amount_kobo', u.amount_kobo,
    'attempts', u.attempts, 'transfer_id', u.flw_transfer_id, 'bank_code', a.bank_code,
    'account_number', a.account_number, 'account_name', a.resolved_name
  )), '[]') into claimed
  from updated u join payout_accounts a on a.farmer_id = u.farmer_id;
  return claimed;
end $$;

create or replace function money_transfer_sent(p_payout uuid, p_transfer_id bigint, p_fee_kobo bigint default 0)
returns jsonb language plpgsql as $$
begin
  update money_payouts set status = 'in_flight', flw_transfer_id = p_transfer_id, fee_kobo = coalesce(p_fee_kobo, 0)
  where id = p_payout and status <> 'paid';
  perform money_event('payout', p_payout, 'in_flight', 'system', null, jsonb_build_object('transfer_id', p_transfer_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function money_payout_by_reference(p_reference uuid) returns jsonb language sql stable as $$
  select to_jsonb(p) from money_payouts p where p.settlement_id = p_reference;
$$;

-- Called only after the transfer webhook is verified and the transfer fetched again.
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
  perform money_sms((select phone from users where id = p.farmer_id),
    format('%s has been sent to your bank account.', money_naira(p.amount_kobo)));
  return jsonb_build_object('ok', true);
end $$;

-- The money stays in farmer_pending and is tried again tomorrow.
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
  perform money_sms((select phone from users where id = p.farmer_id),
    'We could not send your Lumora payout. Please check your account details. We will try again tomorrow.');
  if p.attempts >= money_rule('PAYOUT_ALERT_ATTEMPTS') then
    perform money_alert('payout_keeps_failing', jsonb_build_object('payout_id', p_payout, 'attempts', p.attempts));
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- A rule of one account per bank account is enforced by the unique index on payout_accounts.
create or replace function money_save_payout_account(
  p_farmer uuid, p_bank_code text, p_account_number text, p_resolved_name text, p_name_match boolean,
  p_now timestamptz default now()
) returns jsonb language plpgsql as $$
begin
  if exists (select 1 from payout_accounts where bank_code = p_bank_code and account_number = p_account_number and farmer_id <> p_farmer) then
    perform money_alert('bank_account_reused', jsonb_build_object('farmer_id', p_farmer, 'account_number_last4', right(p_account_number, 4)));
    return money_fail('bank_account_in_use');
  end if;
  insert into payout_accounts (farmer_id, bank_code, account_number, resolved_name, name_match, verified_at)
  values (p_farmer, p_bank_code, p_account_number, p_resolved_name, p_name_match, case when p_name_match then p_now end)
  on conflict (farmer_id) do update set bank_code = excluded.bank_code, account_number = excluded.account_number,
    resolved_name = excluded.resolved_name, name_match = excluded.name_match, verified_at = excluded.verified_at;
  perform money_event('payout_account', p_farmer, 'saved', p_farmer::text, null,
    jsonb_build_object('name_match', p_name_match, 'resolved_name', p_resolved_name));
  return jsonb_build_object('ok', true, 'name_match', p_name_match);
end $$;

create or replace function money_get_user(p_user uuid) returns jsonb language sql stable as $$
  select to_jsonb(u) from users u where u.id = p_user;
$$;

create or replace function money_user_by_firebase(p_uid text) returns jsonb language sql stable as $$
  select to_jsonb(u) from users u where u.firebase_uid = p_uid;
$$;

create or replace function money_flag_pairs() returns int language plpgsql as $$
declare
  pair record;
  flagged int := 0;
begin
  for pair in
    with trades as (
      select farmer_id, buyer_id, count(*) as n from bookings where status = 'settled' group by 1, 2
    ), totals as (
      select t.*, sum(n) over (partition by farmer_id) as farmer_total,
        sum(n) over (partition by buyer_id) as buyer_total from trades t
    )
    select * from totals
    where n >= money_rule('PAIR_MIN_TRADES')
      and (n::numeric / farmer_total > money_rule('PAIR_SHARE') or n::numeric / buyer_total > money_rule('PAIR_SHARE'))
  loop
    if not exists (
      select 1 from money_alerts where kind = 'pair_concentration' and resolved_at is null
        and detail ->> 'farmer_id' = pair.farmer_id::text and detail ->> 'buyer_id' = pair.buyer_id::text
    ) then
      perform money_alert('pair_concentration', jsonb_build_object(
        'farmer_id', pair.farmer_id, 'buyer_id', pair.buyer_id, 'trades', pair.n));
      flagged := flagged + 1;
    end if;
  end loop;
  return flagged;
end $$;

-- The deadline defaults. Runs every 5 minutes. Every branch re-checks state under a row lock, so
-- running it twice, or alongside a farmer's reply, can't apply a default twice.
create or replace function money_sweep(p_now timestamptz default now()) returns jsonb language plpgsql as $$
declare
  b bookings;
  d deliveries;
  s slots;
  dispute_row disputes;
  hold bigint;
  gross bigint;
  n_prompted int := 0; n_released int := 0; n_no_show int := 0; n_min_settled int := 0;
  n_auto int := 0; n_disputes int := 0; n_payout_nudges int := 0;
  payout record;
begin
  -- Ask farmers to confirm.
  for b in
    select * from bookings where status = 'booked' and confirm_sms_at is null and p_now >= confirm_by
    for update skip locked
  loop
    update bookings set confirm_sms_at = p_now where id = b.id;
    perform money_sms((select phone from users where id = b.farmer_id),
      format('Reply YES to confirm %s %s for %s tomorrow. Code %s.', b.qty,
        (select c.name from slots sl join demand_listings l on l.id = sl.listing_id
           join commodities c on c.id = l.commodity_id where sl.id = b.slot_id),
        (select name from users where id = b.buyer_id), b.code));
    n_prompted := n_prompted + 1;
  end loop;

  -- No YES in time.
  for b in
    select * from bookings where status = 'booked' and p_now >= confirm_deadline for update skip locked
  loop
    select amount_kobo into strict hold from money_holds where booking_id = b.id;
    perform wallet_release(b.id, hold, 'not_confirmed');
    update bookings set status = 'released' where id = b.id;
    s := money_reopen_capacity(b, p_now);
    perform money_offer_freed(b, s, p_now);
    perform money_event('booking', b.id, 'released', 'system',
      jsonb_build_object('status', b.status), jsonb_build_object('status', 'released'));
    perform money_sms((select phone from users where id = b.farmer_id),
      format('Booking %s was released because it was not confirmed in time.', b.code));
    n_released := n_released + 1;
  end loop;

  -- No valid code by the end of the window plus grace.
  for b in
    select * from bookings where status = 'confirmed' and arrived_at is null
      and p_now >= window_end + make_interval(hours => money_rule('NO_SHOW_GRACE_HOURS')::int)
    for update skip locked
  loop
    perform money_apply_no_show(b, 'system', p_now);
    n_no_show := n_no_show + 1;
  end loop;

  -- Valid code, but the buyer never recorded.
  for b in
    select * from bookings where status = 'confirmed' and arrived_at is not null
      and p_now >= arrived_at + make_interval(hours => money_rule('BUYER_RECORD_HOURS')::int)
    for update skip locked
  loop
    select money_round_kobo(b.qty * l.min_unit_weight_kg * b.unit_price_kobo) into strict gross
    from slots sl join demand_listings l on l.id = sl.listing_id where sl.id = b.slot_id;
    perform money_add_strike('no_record', b.id, null, b.buyer_id, p_now);
    perform money_pay_farmer(b, least(gross, b.reserve_kobo), 'final');
    perform money_finish(b, 'system', p_now);
    perform money_sms((select phone from users where id = b.buyer_id),
      format('You did not record booking %s in time. We paid the minimum weight and added a strike.', b.code));
    n_min_settled := n_min_settled + 1;
  end loop;

  -- Silence from the farmer counts as YES.
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

  -- Ops didn't decide in time.
  for dispute_row in
    select * from disputes where status = 'open' and p_now >= deadline_at for update skip locked
  loop
    perform money_resolve_dispute(dispute_row.id, 'deadline_default', null, null, p_now);
    n_disputes := n_disputes + 1;
  end loop;

  -- Farmers whose money is waiting on a usable bank account. Reminded once a day.
  for payout in
    select p.id, p.farmer_id from money_payouts p
    left join payout_accounts a on a.farmer_id = p.farmer_id and a.name_match
    where p.status = 'queued' and a.id is null and p.next_attempt_at <= p_now
    for update of p skip locked
  loop
    update money_payouts set next_attempt_at = p_now + interval '1 day', attempts = attempts + 1 where id = payout.id;
    perform money_sms((select phone from users where id = payout.farmer_id),
      'Your Lumora payout is ready. Add a bank account in your name so we can send it.');
    n_payout_nudges := n_payout_nudges + 1;
  end loop;

  perform money_flag_pairs();

  return jsonb_build_object('ok', true, 'prompted', n_prompted, 'released', n_released, 'no_show', n_no_show,
    'min_settled', n_min_settled, 'auto_confirmed', n_auto, 'disputes_defaulted', n_disputes,
    'payout_nudges', n_payout_nudges);
end $$;

create or replace function money_liabilities() returns bigint language sql stable as $$
  select coalesce(sum(balance_kobo), 0)::bigint from money_balances
  where bucket in ('buyer_available', 'buyer_reserved', 'buyer_over_cap', 'farmer_pending', 'lumora_revenue');
$$;

-- What we owe has to match what Flutterwave holds, plus what's on its way out.
create or replace function money_reconcile(p_flw_balance_kobo bigint, p_now timestamptz default now())
returns jsonb language plpgsql as $$
declare
  owed bigint := money_liabilities();
  in_flight bigint;
  difference bigint;
begin
  select coalesce(sum(amount_kobo + fee_kobo), 0) into in_flight from money_payouts where status = 'in_flight';
  difference := owed - (p_flw_balance_kobo + in_flight);

  if difference = 0 then
    return jsonb_build_object('ok', true, 'matched', true, 'owed_kobo', owed);
  end if;

  perform money_alert('reconciliation_mismatch', jsonb_build_object('owed_kobo', owed,
    'flutterwave_kobo', p_flw_balance_kobo, 'in_flight_kobo', in_flight, 'difference_kobo', difference, 'at', p_now));
  update money_flags set value = true, updated_at = p_now where key = 'payouts_paused';
  perform money_event('reconciliation', null, 'mismatch', 'system', null,
    jsonb_build_object('difference_kobo', difference));
  return jsonb_build_object('ok', true, 'matched', false, 'difference_kobo', difference);
end $$;

-- Payouts restart only when no reconciliation alert is left open.
create or replace function money_resolve_alert(p_alert uuid, p_actor uuid, p_now timestamptz default now())
returns jsonb language plpgsql as $$
begin
  update money_alerts set resolved_at = p_now, resolved_by = p_actor where id = p_alert and resolved_at is null;
  if not exists (select 1 from money_alerts where kind = 'reconciliation_mismatch' and resolved_at is null) then
    update money_flags set value = false, updated_at = p_now where key = 'payouts_paused';
  end if;
  perform money_event('alert', p_alert, 'resolved', p_actor::text, null, null);
  return jsonb_build_object('ok', true);
end $$;

-- The admin queue. Everything the page shows, in one call.
create or replace function money_admin_disputes() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(row order by (row ->> 'deadline_at')), '[]') from (
    select jsonb_build_object(
      'id', d.id, 'deadline_at', d.deadline_at, 'undisputed_kobo', d.undisputed_kobo,
      'disputed_kobo', d.disputed_kobo, 'evidence', d.evidence, 'created_at', d.created_at,
      'booking', jsonb_build_object('id', b.id, 'code', b.code, 'qty', b.qty,
        'unit_price_kobo', b.unit_price_kobo, 'reserve_kobo', b.reserve_kobo),
      'farmer', jsonb_build_object('name', f.name, 'phone', f.phone),
      'buyer', jsonb_build_object('name', u.name, 'phone', u.phone),
      'delivery', jsonb_build_object('measured_kg', dl.measured_kg, 'units_received', dl.units_received,
        'units_declined', dl.units_declined, 'decline_reasons', dl.decline_reasons,
        'scale_photo_urls', dl.scale_photo_urls, 'recorded_at', dl.recorded_at),
      'minimum_kobo', money_round_kobo(b.qty * l.min_unit_weight_kg * b.unit_price_kobo),
      'messages', (select coalesce(jsonb_agg(jsonb_build_object('from', i.phone, 'body', i.body, 'at', i.received_at)
        order by i.received_at), '[]') from sms_inbound i where i.booking_id = b.id)
    ) as row
    from disputes d
    join bookings b on b.id = d.booking_id
    join users f on f.id = b.farmer_id
    join users u on u.id = b.buyer_id
    join deliveries dl on dl.booking_id = b.id
    join slots s on s.id = b.slot_id
    join demand_listings l on l.id = s.listing_id
    where d.status = 'open'
  ) q;
$$;
