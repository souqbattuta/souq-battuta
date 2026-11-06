-- Public shop fields so feeds can page shops without reading account JSON.

alter table souq_shops add column if not exists category text not null default '';
alter table souq_shops add column if not exists keywords jsonb not null default '[]'::jsonb;
alter table souq_shops add column if not exists bio text not null default '';
alter table souq_shops add column if not exists cover_url text;

alter table souq_listings add column if not exists thumb_url text;
