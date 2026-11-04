create table if not exists souq_accounts (
  phone text primary key,
  secret text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists souq_tokens (
  token text primary key,
  phone text not null,
  created_at timestamptz not null default now()
);

create index if not exists souq_tokens_phone_idx on souq_tokens (phone);
