-- Remember a phone-digit shop address after it moves to a name slug.
-- The sweep fills the rows. Old /shop/stall-… links 301 to the new slug.
create table if not exists souq_slug_redirects (
  old_slug text primary key,
  slug text not null
);

create index if not exists souq_slug_redirects_slug_idx on souq_slug_redirects (slug);
