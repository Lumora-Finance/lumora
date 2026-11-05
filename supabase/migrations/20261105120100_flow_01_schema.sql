-- The booking to payout flow: approvals, backups, code-not-given reports, email and in-app
-- notifications. See docs/money-flow.md.

alter table users
  add column if not exists email text,
  -- Already on the live database, which was changed directly. Here so a fresh one matches it.
  add column if not exists display_name text,
  add column if not exists photo_url text,
  add column if not exists is_admin boolean not null default false,
  add column if not exists verified boolean not null default false,
  add column if not exists approve_first_time_farmers boolean not null default false;

-- "20 birds" and "20 broilers" in emails. The board keeps its own plain words.
alter table commodities
  add column if not exists unit_plural text,
  add column if not exists goods_plural text;
update commodities set unit_plural = 'birds', goods_plural = 'broilers' where name = 'Live broilers';
update commodities set unit_plural = 'birds', goods_plural = 'turkeys' where name = 'Turkey';
update commodities set unit_plural = 'baskets', goods_plural = 'baskets of tomatoes' where name = 'Tomatoes';
update commodities set unit_plural = 'crates', goods_plural = 'crates of eggs' where name = 'Eggs';

alter table demand_listings add column if not exists backup_of_booking uuid references bookings (id);

alter table bookings
  add column if not exists approval_deadline timestamptz,
  add column if not exists confirm_reminded_at timestamptz,
  add column if not exists late_notice_at timestamptz,
  add column if not exists late_expected_at timestamptz,
  add column if not exists late_check_at timestamptz,
  add column if not exists keep_waiting_at timestamptz,
  add column if not exists closed_reason text;

alter table money_settlements add column if not exists farmer_fee_kobo bigint not null default 0;

-- The code the buyer's staff read out. Clients can't read this table; only the buyer's booking page
-- gets it, through the server.
create table if not exists booking_codes (
  booking_id uuid primary key references bookings (id),
  code text not null
);

create table if not exists backup_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings (id),
  buyer_id uuid not null references users (id),
  listing_id uuid not null references demand_listings (id),
  slot_id uuid not null references slots (id),
  qty int not null check (qty > 0),
  price_kobo bigint not null check (price_kobo > 0),
  deadline_at timestamptz not null,
  -- What backup bookings have taken from the original booking's hold, while that farmer is missing.
  borrowed_kobo bigint not null default 0 check (borrowed_kobo >= 0),
  status text not null default 'open' check (status in ('open', 'filled', 'closed')),
  closed_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table bookings add column if not exists backup_request_id uuid references backup_requests (id);

-- Who was told, so the request is pinned on their board and no one else's.
create table if not exists backup_notified (
  request_id uuid not null references backup_requests (id),
  farmer_id uuid not null references users (id),
  primary key (request_id, farmer_id)
);

create table if not exists code_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings (id),
  status text not null default 'open' check (status in ('open', 'ops', 'resolved')),
  buyer_deadline_at timestamptz not null,
  ops_deadline_at timestamptz,
  decision text check (decision in ('code_given', 'buyer_declined', 'buyer_fault', 'farmer_fault', 'no_fault')),
  decline_reason text,
  decline_photo_url text,
  decline_note text,
  decided_by uuid references users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  kind text not null,
  booking_id uuid references bookings (id),
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Queued, and sent by the job with retries, so a failed email can never block a money step.
create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications (id),
  to_email text not null,
  action_tokens jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

-- One row per button in one email. The link is signed, and this row is what makes it single-use.
create table if not exists action_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  booking_id uuid not null references bookings (id),
  action text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists email_outbox_status_idx on email_outbox (status, next_attempt_at);
create index if not exists bookings_backup_idx on bookings (backup_request_id);

do $$
declare
  t text;
begin
  foreach t in array array['booking_codes', 'backup_requests', 'backup_notified', 'code_reports',
    'notifications', 'email_outbox', 'action_tokens'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

create or replace function money_rule(p_name text) returns numeric language sql immutable as $$
  select case p_name
    when 'CONFIRM_REQUEST_HOURS_BEFORE_CUTOFF' then 12
    when 'CONFIRM_REMINDER_HOURS_BEFORE_CUTOFF' then 2
    when 'FIRST_TIME_APPROVAL_HOURS' then 2
    when 'LATE_CHECK_AT_WINDOW_FRACTION' then 0.5
    when 'BACKUP_NOTIFY_MAX' then 15
    when 'FREED_NOTIFY_MAX' then 10
    when 'NEARBY_KM' then 50
    when 'REOPEN_LEAD_HOURS' then 4
    when 'NO_SHOW_GRACE_HOURS' then 2
    when 'NOCODE_GRACE_HOURS' then 1
    when 'NOCODE_BUYER_RESPONSE_MINUTES' then 30
    when 'NOCODE_OPS_DECISION_HOURS' then 24
    when 'BUYER_RECORD_HOURS' then 2
    when 'FARMER_REPLY_HOURS' then 2
    when 'DISPUTE_DECISION_HOURS' then 48
    when 'OVER_CAP_REFUND_HOURS' then 48
    when 'WEIGHT_TOLERANCE' then 0.01
    when 'NO_SHOW_FEE_PCT' then 5
    when 'LATE_CANCEL_FEE_PCT' then 5
    when 'FIRST_NO_SHOW_IS_WARNING' then 1
    when 'NO_SHOW_PAUSE_COUNT' then 2
    when 'NO_SHOW_PAUSE_WINDOW_DAYS' then 30
    when 'NO_SHOW_PAUSE_DAYS' then 14
    when 'BUYER_FEE_PCT' then 1
    when 'FARMER_FEE_PCT' then 1
    when 'FREE_FARMER_DELIVERIES' then 3
    when 'NEW_FARMER_FIRST_BOOKING_CAP' then 20
    when 'CODE_MAX_ATTEMPTS' then 5
    when 'REFUSED_CODE_PAUSE_COUNT' then 2
    when 'REFUSED_CODE_WINDOW_DAYS' then 30
    when 'NEW_BUYER_FUNDING_CAP_KOBO' then 50000000
    when 'NEW_BUYER_COMPLETED_DELIVERIES' then 5
    when 'PAIR_MIN_TRADES' then 5
    when 'PAIR_SHARE' then 0.8
    when 'PAYOUT_ALERT_ATTEMPTS' then 3
    when 'EMAIL_MAX_ATTEMPTS' then 6
    when 'EMAIL_RETRY_MINUTES' then 5
    when 'SMS_RATE_LIMIT' then 10
    when 'SMS_RATE_WINDOW_MINUTES' then 10
  end;
$$;

-- Bookings already waiting move to the new deadlines: asked 12 hours before the cut-off, due at it.
update bookings b set confirm_by = s.cutoff_at - interval '12 hours', confirm_deadline = s.cutoff_at
from slots s where s.id = b.slot_id and b.status = 'booked';
