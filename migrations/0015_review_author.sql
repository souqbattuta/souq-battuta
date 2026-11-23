-- One review per buyer per shop. Keep the newest row if a phone reviewed twice.
delete from souq_reviews older
using souq_reviews newer
where older.shop_slug = newer.shop_slug
  and older.author_phone = newer.author_phone
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.id < newer.id)
  );

create unique index if not exists souq_reviews_one_per_buyer
  on souq_reviews (shop_slug, author_phone);
