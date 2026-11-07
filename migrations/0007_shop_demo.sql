-- Private marker. Customer-facing queries skip demo shops. Names are not used.
alter table souq_shops add column if not exists demo boolean not null default false;
