-- Hold shops that already use the Souq Battuta name. Accounts stay.
-- The server sweep sets name_hold from the shared reserved-name check.
alter table souq_shops add column if not exists name_hold boolean not null default false;

-- One username per account, compared case-insensitively with the edges trimmed.
-- Skip the index when older rows already clash so this migration can still apply.
do $$
begin
  if not exists (
    select 1
    from (
      select lower(btrim(regexp_replace(coalesce(data->>'username', ''), '\s+', ' ', 'g'))) as key
      from souq_accounts
      where coalesce(btrim(data->>'username'), '') <> ''
      group by 1
      having count(*) > 1
    ) clashes
  ) then
    create unique index if not exists souq_accounts_username_key
      on souq_accounts (lower(btrim(regexp_replace(coalesce(data->>'username', ''), '\s+', ' ', 'g'))))
      where coalesce(btrim(data->>'username'), '') <> '';
  end if;
end $$;
