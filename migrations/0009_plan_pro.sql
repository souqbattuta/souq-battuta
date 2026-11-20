update souq_accounts set plan = 'pro' where plan = 'grow';
update souq_shops set plan = 'pro' where plan = 'grow';
update souq_accounts
  set data = jsonb_set(data, '{sellerPlan}', '"pro"', false)
  where data->>'sellerPlan' = 'grow';
update souq_accounts
  set data = jsonb_set(data, '{pendingPlan}', '"pro"', false)
  where data->>'pendingPlan' = 'grow';
alter table souq_trial_phones add column if not exists kind text not null default 'login';
