-- Stored Free sellers become Basic. planEnds is left as it is.
update souq_accounts set plan = 'basic' where plan = 'free';
update souq_shops set plan = 'basic' where plan = 'free';
update souq_accounts
  set data = jsonb_set(data, '{sellerPlan}', '"basic"', true)
  where data->>'sellerPlan' = 'free';
