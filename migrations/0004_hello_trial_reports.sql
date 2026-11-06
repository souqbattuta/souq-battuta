-- Hello World posts, one free trial per phone, and moderation reports.
-- Trial rows stay even if the shop account is deleted.

alter table souq_shops add column if not exists created_at timestamptz not null default now();
alter table souq_shops add column if not exists hidden boolean not null default false;
alter table souq_shops add column if not exists avatar_url text;
alter table souq_shops add column if not exists thumb_url text;

create table if not exists souq_hello_posts (
  id text primary key,
  shop_slug text not null,
  owner_phone text not null,
  text text not null,
  lang text not null default 'en',
  image_url text,
  thumb_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  edit_until timestamptz not null,
  status text not null default 'live',
  views integer not null default 0,
  hearts integer not null default 0
);

create index if not exists souq_hello_shop_idx on souq_hello_posts (shop_slug, created_at desc);
create index if not exists souq_hello_live_idx on souq_hello_posts (status, expires_at);

create table if not exists souq_trial_phones (
  phone text primary key,
  trial_start timestamptz not null,
  trial_end timestamptz not null
);

create table if not exists souq_reports (
  id text primary key,
  target_type text not null,
  target_id text not null,
  reporter_phone text not null,
  reason text not null default '',
  status text not null default 'open',
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_phone)
);

create index if not exists souq_reports_status_idx on souq_reports (status, created_at desc);
