-- Saved buyer places. Private to the account. Deleted with the account.
create table if not exists souq_buyer_places (
  id text primary key,
  owner_phone text not null references souq_accounts(phone) on delete cascade,
  name text not null,
  label text not null default '',
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists souq_buyer_places_owner_idx on souq_buyer_places (owner_phone, updated_at desc);
