-- The money schema. Additive only.
do $$ begin
  create type booking_status as enum
    ('booked', 'confirmed', 'released', 'cancelled', 'no_show', 'delivered', 'disputed', 'settled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type money_bucket as enum
    ('buyer_available', 'buyer_reserved', 'buyer_over_cap', 'farmer_pending', 'farmer_paid',
     'lumora_revenue', 'external');
exception when duplicate_object then null; end $$;

alter table demand_listings
  add column if not exists min_unit_weight_kg numeric(10, 3),
  add column if not exists max_unit_weight_kg numeric(10, 3);

alter table bookings
  add column if not exists status booking_status not null default 'booked',
  add column if not exists reserve_kobo bigint not null default 0 check (reserve_kobo >= 0),
  add column if not exists unit_price_kobo bigint not null default 0,
  add column if not exists delivery_code_hash text,
  add column if not exists code_attempts int not null default 0,
  add column if not exists code_locked_at timestamptz,
  add column if not exists arrived_at timestamptz,
  add column if not exists confirm_by timestamptz,
  add column if not exists confirm_deadline timestamptz,
  add column if not exists confirm_sms_at timestamptz,
  add column if not exists window_end timestamptz;

alter table deliveries
  add column if not exists units_received int not null default 0 check (units_received >= 0),
  add column if not exists units_declined int not null default 0 check (units_declined >= 0),
  add column if not exists decline_reasons jsonb not null default '[]',
  add column if not exists measured_kg numeric(10, 3) not null default 0 check (measured_kg >= 0),
  add column if not exists scale_photo_urls text[] not null default '{}'
    check (cardinality(scale_photo_urls) >= 1),
  add column if not exists recorded_by uuid references users (id),
  add column if not exists recorded_at timestamptz,
  add column if not exists gross_kobo bigint not null default 0,
  add column if not exists reply_deadline timestamptz,
  add column if not exists farmer_reply text not null default 'none'
    check (farmer_reply in ('yes', 'dispute', 'none')),
  add column if not exists farmer_reply_at timestamptz,
  add column if not exists auto_confirmed boolean not null default false;

create table if not exists producer_stock (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references users (id),
  commodity_id uuid not null references commodities (id),
  date date not null,
  qty_declared int not null check (qty_declared >= 0),
  unique (farmer_id, commodity_id, date)
);

create table if not exists commodity_follows (
  farmer_id uuid not null references users (id),
  commodity_id uuid not null references commodities (id),
  primary key (farmer_id, commodity_id)
);

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings (id),
  opened_by uuid references users (id),
  undisputed_kobo bigint not null check (undisputed_kobo >= 0),
  disputed_kobo bigint not null check (disputed_kobo >= 0),
  evidence jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved')),
  decision text,
  decided_by uuid references users (id),
  decided_at timestamptz,
  deadline_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists strikes (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid references users (id),
  buyer_id uuid references users (id),
  booking_id uuid references bookings (id),
  kind text not null check (kind in ('no_show', 'late_cancel', 'refused_code', 'no_record')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(farmer_id, buyer_id) = 1),
  unique (booking_id, kind)
);

create table if not exists payout_accounts (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid unique not null references users (id),
  bank_code text not null,
  account_number text not null,
  resolved_name text,
  name_match boolean not null default false,
  verified_at timestamptz,
  unique (bank_code, account_number)
);

create table if not exists money_events (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id uuid,
  action text not null,
  actor text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create table if not exists money_ledger (
  id bigint generated always as identity primary key,
  idem_key text unique not null,
  from_bucket money_bucket not null,
  from_owner uuid,
  to_bucket money_bucket not null,
  to_owner uuid,
  amount_kobo bigint not null check (amount_kobo > 0),
  booking_id uuid references bookings (id),
  reason text not null,
  created_at timestamptz not null default now(),
  check (from_bucket <> to_bucket or from_owner is distinct from to_owner)
);

create table if not exists money_balances (
  bucket money_bucket not null,
  owner_id uuid not null default '00000000-0000-0000-0000-000000000000',
  balance_kobo bigint not null default 0,
  primary key (bucket, owner_id),
  check (balance_kobo >= 0 or bucket in ('external', 'lumora_revenue'))
);

create table if not exists money_holds (
  booking_id uuid primary key references bookings (id),
  buyer_id uuid not null references users (id),
  amount_kobo bigint not null default 0 check (amount_kobo >= 0)
);

create table if not exists money_pending_fees (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references users (id),
  booking_id uuid references bookings (id),
  amount_kobo bigint not null check (amount_kobo > 0),
  collected_kobo bigint not null default 0,
  buyer_share_pct int not null default 0,
  reason text not null,
  created_at timestamptz not null default now(),
  check (collected_kobo between 0 and amount_kobo),
  unique (booking_id, reason)
);

create table if not exists money_receivables (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references users (id),
  booking_id uuid references bookings (id),
  amount_kobo bigint not null check (amount_kobo > 0),
  collected_kobo bigint not null default 0,
  reason text not null,
  created_at timestamptz not null default now(),
  check (collected_kobo between 0 and amount_kobo)
);

create table if not exists money_settlements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id),
  farmer_id uuid not null references users (id),
  gross_kobo bigint not null check (gross_kobo >= 0),
  fees_kobo bigint not null default 0,
  net_kobo bigint not null check (net_kobo >= 0),
  kind text not null,
  created_at timestamptz not null default now(),
  unique (booking_id, kind)
);

create table if not exists money_payouts (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid unique not null references money_settlements (id),
  farmer_id uuid not null references users (id),
  amount_kobo bigint not null check (amount_kobo > 0),
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'in_flight', 'failed', 'paid')),
  flw_transfer_id bigint unique,
  fee_kobo bigint not null default 0,
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  paid_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists money_funding_accounts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid unique not null references users (id),
  tx_ref text unique not null,
  account_number text,
  bank_name text,
  order_ref text,
  created_at timestamptz not null default now()
);

create table if not exists money_deposits (
  flw_tx_id bigint primary key,
  buyer_id uuid not null references users (id),
  tx_ref text not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  provider_fee_kobo bigint not null default 0,
  over_cap_kobo bigint not null default 0,
  refund_due_at timestamptz,
  refund_status text check (refund_status in ('due', 'sent')),
  created_at timestamptz not null default now()
);

create table if not exists money_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  detail jsonb not null default '{}',
  resolved_at timestamptz,
  resolved_by uuid references users (id),
  created_at timestamptz not null default now()
);

create table if not exists money_flags (
  key text primary key,
  value boolean not null,
  updated_at timestamptz not null default now()
);
insert into money_flags (key, value) values ('payouts_paused', false) on conflict do nothing;

create table if not exists sms_outbox (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists sms_inbound (
  id bigint generated always as identity primary key,
  phone text not null,
  body text not null,
  booking_id uuid references bookings (id),
  received_at timestamptz not null default now()
);

create table if not exists sms_menus (
  phone text not null,
  position int not null,
  listing_id uuid not null references demand_listings (id),
  created_at timestamptz not null default now(),
  primary key (phone, position)
);

create index if not exists bookings_status_idx on bookings (status);
create index if not exists bookings_farmer_idx on bookings (farmer_id);
create index if not exists bookings_buyer_idx on bookings (buyer_id);
create index if not exists strikes_farmer_idx on strikes (farmer_id, created_at);
create index if not exists sms_inbound_phone_idx on sms_inbound (phone, received_at);
create index if not exists sms_outbox_status_idx on sms_outbox (status);
create index if not exists payouts_status_idx on money_payouts (status, next_attempt_at);

-- Append-only records.
create or replace function money_forbid_change() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

drop trigger if exists money_ledger_append_only on money_ledger;
create trigger money_ledger_append_only before update or delete on money_ledger
  for each row execute function money_forbid_change();
drop trigger if exists money_events_append_only on money_events;
create trigger money_events_append_only before update or delete on money_events
  for each row execute function money_forbid_change();

-- Balances and holds only ever change from the ledger trigger below.
create or replace function money_forbid_direct_write() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() < 2 then
    raise exception '% only changes through money_ledger', tg_table_name;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists money_balances_guard on money_balances;
create trigger money_balances_guard before insert or update or delete on money_balances
  for each row execute function money_forbid_direct_write();
drop trigger if exists money_holds_guard on money_holds;
create trigger money_holds_guard before insert or update or delete on money_holds
  for each row execute function money_forbid_direct_write();

create or replace function money_apply_ledger() returns trigger language plpgsql as $$
declare
  no_owner constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  insert into money_balances (bucket, owner_id, balance_kobo)
  values (new.to_bucket, coalesce(new.to_owner, no_owner), new.amount_kobo)
  on conflict (bucket, owner_id)
  do update set balance_kobo = money_balances.balance_kobo + excluded.balance_kobo;

  -- Update first. A negative insert would fail the check before ON CONFLICT is considered.
  update money_balances set balance_kobo = balance_kobo - new.amount_kobo
  where bucket = new.from_bucket and owner_id = coalesce(new.from_owner, no_owner);
  if not found then
    insert into money_balances (bucket, owner_id, balance_kobo)
    values (new.from_bucket, coalesce(new.from_owner, no_owner), -new.amount_kobo)
    on conflict (bucket, owner_id)
    do update set balance_kobo = money_balances.balance_kobo + excluded.balance_kobo;
  end if;

  if new.to_bucket = 'buyer_reserved' then
    insert into money_holds (booking_id, buyer_id, amount_kobo)
    values (new.booking_id, new.to_owner, new.amount_kobo)
    on conflict (booking_id)
    do update set amount_kobo = money_holds.amount_kobo + excluded.amount_kobo;
  end if;
  if new.from_bucket = 'buyer_reserved' then
    update money_holds set amount_kobo = amount_kobo - new.amount_kobo
    where booking_id = new.booking_id;
  end if;
  return new;
end $$;

drop trigger if exists money_ledger_apply on money_ledger;
create trigger money_ledger_apply after insert on money_ledger
  for each row execute function money_apply_ledger();
