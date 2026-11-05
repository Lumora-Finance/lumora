-- Base tables from the README's data model. The migrations folder was empty when this was written,
-- so these use `if not exists` and stay out of the way of anyone else's version.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique,
  phone text unique not null,
  name text not null,
  role text not null check (role in ('farmer', 'buyer', 'agent', 'admin')),
  area text,
  buyer_review_hold boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists commodities (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  unit text not null default 'kg'
);

create table if not exists demand_listings (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references users (id),
  commodity_id uuid not null references commodities (id),
  spec text,
  unit_price_kobo bigint not null check (unit_price_kobo > 0),
  capacity_per_day int not null check (capacity_per_day > 0),
  cutoff_hours int not null default 24,
  min_qty int not null default 1,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  paused_reason text,
  created_at timestamptz not null default now()
);

create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references demand_listings (id),
  date date not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  cutoff_at timestamptz not null,
  capacity_total int not null check (capacity_total >= 0),
  capacity_remaining int not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  reopened_until timestamptz,
  unique (listing_id, date),
  check (capacity_remaining >= 0 and capacity_remaining <= capacity_total)
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references slots (id),
  farmer_id uuid not null references users (id),
  buyer_id uuid not null references users (id),
  qty int not null check (qty > 0),
  code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings (id)
);
