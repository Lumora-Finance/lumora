-- Row-level security. The app signs in with Firebase, so Supabase has to be set up to trust Firebase
-- tokens (third-party auth), and the caller is identified from the token's `sub`.
create or replace function money_current_user() returns uuid
language sql stable security definer set search_path = public as $$
  select id from users where firebase_uid = (auth.jwt() ->> 'sub');
$$;

do $$
declare
  t text;
begin
  foreach t in array array['users', 'commodities', 'demand_listings', 'slots', 'bookings', 'deliveries',
    'producer_stock', 'commodity_follows', 'disputes', 'strikes', 'payout_accounts', 'money_events',
    'money_ledger', 'money_balances', 'money_holds', 'money_pending_fees', 'money_receivables',
    'money_settlements', 'money_payouts', 'money_funding_accounts', 'money_deposits',
    'money_alerts', 'money_flags', 'sms_outbox', 'sms_inbound', 'sms_menus']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

-- All writes go through server code using the service role. Clients only read.
grant select on commodities, demand_listings, slots to anon, authenticated;
grant select on users, deliveries, producer_stock, disputes, strikes, payout_accounts,
  money_balances, money_holds, money_settlements, money_payouts to authenticated;

-- Every bookings column except the code hash. A farmer holding the hash could try all 10,000 codes.
grant select (id, slot_id, farmer_id, buyer_id, qty, code, status, reserve_kobo, unit_price_kobo,
  code_attempts, code_locked_at, arrived_at, confirm_by, confirm_deadline, window_end, created_at)
  on bookings to authenticated;

drop policy if exists read_board on commodities;
create policy read_board on commodities for select using (true);
drop policy if exists read_board on demand_listings;
create policy read_board on demand_listings for select using (true);
drop policy if exists read_board on slots;
create policy read_board on slots for select using (true);

drop policy if exists own_row on users;
create policy own_row on users for select to authenticated using (id = money_current_user());

drop policy if exists own_bookings on bookings;
create policy own_bookings on bookings for select to authenticated
  using (farmer_id = money_current_user() or buyer_id = money_current_user());

drop policy if exists own_deliveries on deliveries;
create policy own_deliveries on deliveries for select to authenticated using (exists (
  select 1 from bookings b where b.id = booking_id
    and (b.farmer_id = money_current_user() or b.buyer_id = money_current_user())));

drop policy if exists own_disputes on disputes;
create policy own_disputes on disputes for select to authenticated using (exists (
  select 1 from bookings b where b.id = booking_id
    and (b.farmer_id = money_current_user() or b.buyer_id = money_current_user())));

drop policy if exists own_strikes on strikes;
create policy own_strikes on strikes for select to authenticated
  using (farmer_id = money_current_user() or buyer_id = money_current_user());

drop policy if exists own_stock on producer_stock;
create policy own_stock on producer_stock for select to authenticated using (farmer_id = money_current_user());

drop policy if exists own_account on payout_accounts;
create policy own_account on payout_accounts for select to authenticated using (farmer_id = money_current_user());

drop policy if exists own_balance on money_balances;
create policy own_balance on money_balances for select to authenticated using (owner_id = money_current_user());

drop policy if exists own_hold on money_holds;
create policy own_hold on money_holds for select to authenticated using (buyer_id = money_current_user());

drop policy if exists own_settlements on money_settlements;
create policy own_settlements on money_settlements for select to authenticated using (farmer_id = money_current_user());

drop policy if exists own_payouts on money_payouts;
create policy own_payouts on money_payouts for select to authenticated using (farmer_id = money_current_user());

-- Money functions are for the server only.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'money\_%' or p.proname like 'wallet\_%' or p.proname = 'book_slot')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

grant execute on function money_current_user() to authenticated;

-- Deadline defaults keep running in the database even if the app is down. Sending SMS and payouts
-- needs the app, through /api/cron/money. If pg_cron isn't available, that route runs the sweep too.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('money-sweep', '*/5 * * * *', 'select money_sweep()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %. The /api/cron/money route runs the sweep instead.', sqlerrm;
end $$;
