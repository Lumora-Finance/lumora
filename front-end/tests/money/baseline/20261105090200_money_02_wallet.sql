-- The wallet boundary. Booking and settlement need these inside their own transactions, so they
-- live in SQL, and lib/money/wallet-adapter.ts calls the same functions from the app. If the wallet
-- owner brings their own ledger, these are the functions to replace.

create or replace function money_rule(p_name text) returns numeric language sql immutable as $$
  select case p_name
    when 'CONFIRM_LEAD_HOURS' then 24
    when 'CONFIRM_REPLY_HOURS' then 6
    when 'REOPEN_LEAD_HOURS' then 4
    when 'NO_SHOW_GRACE_HOURS' then 2
    when 'BUYER_RECORD_HOURS' then 2
    when 'FARMER_REPLY_HOURS' then 2
    when 'DISPUTE_DECISION_HOURS' then 48
    when 'OVER_CAP_REFUND_HOURS' then 48
    when 'WEIGHT_TOLERANCE' then 0.01
    when 'NO_SHOW_FEE_PCT' then 5
    when 'NO_SHOW_FEE_BUYER_SHARE_PCT' then 50
    when 'LATE_CANCEL_FEE_PCT' then 5
    when 'BUYER_FEE_PCT' then 1.5
    when 'NEW_FARMER_FIRST_BOOKING_CAP' then 20
    when 'CODE_MAX_ATTEMPTS' then 5
    when 'NO_SHOW_BAN_COUNT' then 2
    when 'NO_SHOW_BAN_WINDOW_DAYS' then 30
    when 'NO_SHOW_BAN_DAYS' then 14
    when 'REFUSED_CODE_PAUSE_COUNT' then 2
    when 'FREED_SMS_MAX_FARMERS' then 10
    when 'NEW_BUYER_FUNDING_CAP_KOBO' then 50000000
    when 'NEW_BUYER_COMPLETED_DELIVERIES' then 5
    when 'PAIR_MIN_TRADES' then 5
    when 'PAIR_SHARE' then 0.8
    when 'PAYOUT_ALERT_ATTEMPTS' then 3
    when 'SMS_RATE_LIMIT' then 10
    when 'SMS_RATE_WINDOW_MINUTES' then 10
  end;
$$;

create or replace function money_event(
  p_entity text, p_id uuid, p_action text, p_actor text, p_before jsonb, p_after jsonb
) returns void language sql as $$
  insert into money_events (entity, entity_id, action, actor, before, after)
  values (p_entity, p_id, p_action, p_actor, p_before, p_after);
$$;

create or replace function money_alert(p_kind text, p_detail jsonb) returns void language sql as $$
  insert into money_alerts (kind, detail) values (p_kind, p_detail);
$$;

create or replace function money_sms(p_phone text, p_body text) returns void language sql as $$
  insert into sms_outbox (phone, body) select p_phone, p_body where p_phone is not null;
$$;

create or replace function money_naira(p_kobo bigint) returns text language sql immutable as $$
  select '₦' || to_char(p_kobo / 100, 'FM999,999,999,990') ||
    case when p_kobo % 100 <> 0 then '.' || lpad((p_kobo % 100)::text, 2, '0') else '' end;
$$;

create or replace function money_round_kobo(p_value numeric) returns bigint language sql immutable as $$
  select round(p_value)::bigint;
$$;

-- The only way money moves. A repeated key does nothing, so retries can't move money twice.
create or replace function money_post(
  p_key text, p_from money_bucket, p_from_owner uuid, p_to money_bucket, p_to_owner uuid,
  p_amount bigint, p_booking uuid, p_reason text
) returns boolean language plpgsql as $$
declare
  inserted int;
begin
  if p_amount = 0 then return false; end if;
  insert into money_ledger
    (idem_key, from_bucket, from_owner, to_bucket, to_owner, amount_kobo, booking_id, reason)
  values (p_key, p_from, p_from_owner, p_to, p_to_owner, p_amount, p_booking, p_reason)
  on conflict (idem_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end $$;

create or replace function wallet_get_available(p_buyer uuid) returns bigint language sql stable as $$
  select coalesce(
    (select balance_kobo from money_balances where bucket = 'buyer_available' and owner_id = p_buyer),
    0
  );
$$;

create or replace function wallet_reserve(p_booking uuid, p_buyer uuid, p_amount bigint)
returns void language plpgsql as $$
begin
  perform money_post('reserve:' || p_booking, 'buyer_available', p_buyer, 'buyer_reserved', p_buyer,
    p_amount, p_booking, 'reserve');
end $$;

create or replace function wallet_release(p_booking uuid, p_amount bigint, p_reason text)
returns void language plpgsql as $$
declare
  owner uuid;
begin
  select buyer_id into strict owner from money_holds where booking_id = p_booking;
  perform money_post('release:' || p_booking || ':' || p_reason, 'buyer_reserved', owner,
    'buyer_available', owner, p_amount, p_booking, p_reason);
end $$;

create or replace function wallet_settle(p_booking uuid, p_farmer uuid, p_amount bigint, p_key text default 'final')
returns void language plpgsql as $$
declare
  owner uuid;
begin
  select buyer_id into strict owner from money_holds where booking_id = p_booking;
  perform money_post('settle:' || p_booking || ':' || p_key, 'buyer_reserved', owner,
    'farmer_pending', p_farmer, p_amount, p_booking, 'settle');
end $$;

create or replace function wallet_mark_paid(p_payout uuid) returns boolean language plpgsql as $$
declare
  p money_payouts;
begin
  select * into strict p from money_payouts where id = p_payout;
  return money_post('paid:' || p_payout, 'farmer_pending', p.farmer_id, 'farmer_paid', p.farmer_id,
    p.amount_kobo, null, 'payout confirmed');
end $$;

create or replace function wallet_fee_from_next_payout(
  p_farmer uuid, p_amount bigint, p_reason text, p_booking uuid default null, p_buyer_share_pct int default 0
) returns void language plpgsql as $$
begin
  if p_amount <= 0 then return; end if;
  insert into money_pending_fees (farmer_id, booking_id, amount_kobo, reason, buyer_share_pct)
  values (p_farmer, p_booking, p_amount, p_reason, p_buyer_share_pct)
  on conflict (booking_id, reason) do nothing;
end $$;
