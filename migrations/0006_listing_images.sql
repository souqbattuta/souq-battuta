-- Keep every product image, and speed up the rolling Hello World quota.
-- Existing created_at values are left as stored. Nothing is invented from a month label.

alter table souq_listings add column if not exists images jsonb not null default '[]'::jsonb;

update souq_listings
set images = jsonb_build_array(image_url)
where image_url is not null
  and image_url <> ''
  and images = '[]'::jsonb;

create index if not exists souq_hello_owner_recent_idx on souq_hello_posts (owner_phone, created_at desc);
