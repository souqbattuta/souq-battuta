-- Hello archives, password-reset codes, and files waiting to leave storage.
-- Safe to re-run. Existing signup codes stay signup codes.
-- purpose is signup or reset.


alter table souq_otp add column if not exists purpose text not null default 'signup';

create table if not exists souq_media_gc (
  url text primary key,
  owner_phone text not null,
  created_at timestamptz not null default now()
);


