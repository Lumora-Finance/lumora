-- Fix wallet funding: allow card payments and update tx_ref on re-funding.

-- Allow money_save_funding_account to update tx_ref when a buyer re-funds.
-- The original had ON CONFLICT (buyer_id) DO NOTHING, so a second funding attempt
-- kept the old tx_ref and the webhook could never match the new reference.
create or replace function money_save_funding_account(
  p_buyer uuid, p_tx_ref text, p_account_number text, p_bank_name text, p_order_ref text
) returns jsonb language plpgsql as $$
begin
  insert into money_funding_accounts (buyer_id, tx_ref, account_number, bank_name, order_ref)
  values (p_buyer, p_tx_ref, p_account_number, p_bank_name, p_order_ref)
  on conflict (buyer_id) do update set tx_ref = excluded.tx_ref;
  return (select to_jsonb(a) from money_funding_accounts a where a.buyer_id = p_buyer);
end $$;

-- The original money_credit_deposit rejected any payment_type that didn't contain "bank".
-- Card funding via Paystack checkout reports channel "card", which was rejected.
-- Remove the bank-only restriction so card and other Paystack channels work too.
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

  return jsonb_build_object('ok', true, 'buyer_id', buyer, 'credited_kobo', credited, 'over_cap_kobo', over);
end $$;

-- Re-grant permissions on the changed functions.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('money_save_funding_account', 'money_credit_deposit')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
