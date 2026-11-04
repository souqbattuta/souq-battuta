-- Passwords, sessions, OTP, and server-owned shop data.
-- Existing plaintext secrets are wiped. Those accounts must set a new password
-- after a WhatsApp code. Nothing here can be compared as a password.

alter table souq_accounts add column if not exists password_hash text;
alter table souq_accounts add column if not exists must_reset boolean not null default true;
alter table souq_accounts add column if not exists phone_verified boolean not null default false;
alter table souq_accounts add column if not exists failed_logins integer not null default 0;
alter table souq_accounts add column if not exists locked_until timestamptz;
alter table souq_accounts add column if not exists role text not null default 'buyer';
alter table souq_accounts add column if not exists shop_slug text;
alter table souq_accounts add column if not exists plan text;

update souq_accounts
set secret = '',
    password_hash = null,
    must_reset = true,
    phone_verified = false,
    failed_logins = 0,
    locked_until = null;

delete from souq_tokens;

alter table souq_tokens add column if not exists expires_at timestamptz;

create table if not exists souq_pending (
  phone text primary key,
  password_hash text not null,
  profile jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists souq_otp (
  phone text primary key,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now()
);

create table if not exists souq_rate (
  bucket text primary key,
  hits integer not null,
  window_start timestamptz not null default now()
);

create table if not exists souq_shops (
  slug text primary key,
  owner_phone text not null unique,
  name text not null,
  area text not null default '',
  plan text not null default 'free',
  updated_at timestamptz not null default now()
);

create table if not exists souq_listings (
  id text primary key,
  shop_slug text not null,
  owner_phone text not null,
  name text not null,
  price numeric,
  image_url text,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists souq_listings_shop_idx on souq_listings (shop_slug);

create table if not exists souq_orders (
  id text primary key,
  shop_slug text not null,
  buyer_phone text not null,
  status text not null,
  product_name text not null default '',
  address_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists souq_orders_shop_idx on souq_orders (shop_slug);
create index if not exists souq_orders_buyer_idx on souq_orders (buyer_phone);

create table if not exists souq_reviews (
  id text primary key,
  shop_slug text not null,
  author_phone text not null,
  author_name text not null,
  area text not null default '',
  score integer not null,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists souq_reviews_shop_idx on souq_reviews (shop_slug);

create table if not exists souq_views (
  shop_slug text primary key,
  views integer not null default 0,
  review_count integer not null default 0,
  order_count integer not null default 0
);

create table if not exists souq_promo_uses (
  code text not null,
  phone text not null,
  plan text not null,
  months integer not null,
  primary key (code, phone)
);
