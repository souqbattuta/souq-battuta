alter table souq_shops add column if not exists publishable boolean not null default false;

update souq_shops s
set publishable = true
from souq_accounts a
where a.phone = s.owner_phone
  and coalesce(a.data->>'whatsappPhone', '') ~ '^\+9627[789][0-9]{7}$';
