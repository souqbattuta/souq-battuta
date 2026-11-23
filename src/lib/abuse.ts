/** Caps for reviews, photos, and reports. The handlers count them with hitRate. */

export const REVIEW_DAY_PHONE = 10;
export const REVIEW_DAY_IP = 20;
export const PHOTO_HOUR = 30;
export const PHOTO_DAY = 80;
export const REPORT_DAY_PHONE = 5;
export const REPORT_DAY_IP = 15;
export const DAY = 24 * 60 * 60;
export const HOUR = 60 * 60;

type Hit = (bucket: string, limit: number, windowSeconds: number) => Promise<boolean>;

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export function reviewAuthorName(data: { displayName?: unknown; username?: unknown } | null | undefined) {
  const name = String(data?.displayName || data?.username || "").trim().slice(0, 80);
  return name || "Buyer";
}

export async function allowReviewWrite(hit: Hit, ip: string, phone: string) {
  if (!(await hit(`ip:review:${ip}`, REVIEW_DAY_IP, DAY))) return false;
  return hit(`phone:review:${phone}`, REVIEW_DAY_PHONE, DAY);
}

export async function allowPhotoUpload(hit: Hit, phone: string) {
  if (!(await hit(`phone:photo:hour:${phone}`, PHOTO_HOUR, HOUR))) return false;
  return hit(`phone:photo:day:${phone}`, PHOTO_DAY, DAY);
}

export async function allowReport(hit: Hit, ip: string, phone: string) {
  if (!(await hit(`ip:report:${ip}`, REPORT_DAY_IP, DAY))) return false;
  return hit(`phone:report:${phone}`, REPORT_DAY_PHONE, DAY);
}

export function shopAcceptsReviews(plan: string | null | undefined) {
  return plan === "pro" || plan === "grow" || plan === "premium";
}

/** One review per buyer per shop. A later write updates that row and does not add another. */
export async function writeBuyerReview(
  sql: Sql,
  input: { phone: string; shopSlug: string; score: number; comment: string; authorName: string; area: string; id: string },
) {
  const done = await sql.query<{ id: string }>(
    `select id from souq_orders where shop_slug = $1 and buyer_phone = $2 and status = 'done' limit 1`,
    [input.shopSlug, input.phone],
  );
  if (!done[0]) return { ok: false as const, error: "order" as const };
  const existing = await sql.query<{ id: string }>(
    `select id from souq_reviews where shop_slug = $1 and author_phone = $2 limit 1`,
    [input.shopSlug, input.phone],
  );
  if (existing[0]) {
    await sql.query(
      `update souq_reviews
       set author_name = $2, area = $3, score = $4, comment = $5
       where id = $1 and author_phone = $6`,
      [existing[0].id, input.authorName, input.area, input.score, input.comment, input.phone],
    );
    return { ok: true as const, id: existing[0].id };
  }
  await sql.query(
    `insert into souq_reviews (id, shop_slug, author_phone, author_name, area, score, comment)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [input.id, input.shopSlug, input.phone, input.authorName, input.area, input.score, input.comment],
  );
  await sql.query(
    `insert into souq_views (shop_slug, review_count) values ($1, 1)
     on conflict (shop_slug) do update set review_count = souq_views.review_count + 1`,
    [input.shopSlug],
  );
  return { ok: true as const, id: input.id };
}

export async function deleteBuyerReview(sql: Sql, id: string, phone: string) {
  const rows = await sql.query<{ shop_slug: string }>(
    `delete from souq_reviews where id = $1 and author_phone = $2 returning shop_slug`,
    [id, phone],
  );
  const shop = rows[0]?.shop_slug;
  if (!shop) return { ok: false as const, error: "auth" as const };
  await sql.query(
    `update souq_views set review_count = review_count - 1 where shop_slug = $1 and review_count > 0`,
    [shop],
  );
  return { ok: true as const };
}

/** One open report per person per target. Three open reports hide the shop or the Hello post. */
export async function fileReport(
  sql: Sql,
  input: { id: string; targetType: "hello" | "shop"; targetId: string; phone: string; reason: string },
) {
  const prior = await sql.query<{ id: string }>(
    `select id from souq_reports where target_type = $1 and target_id = $2 and reporter_phone = $3 limit 1`,
    [input.targetType, input.targetId, input.phone],
  );
  if (!prior[0]) {
    await sql.query(
      `insert into souq_reports (id, target_type, target_id, reporter_phone, reason)
       values ($1, $2, $3, $4, $5)
       on conflict (target_type, target_id, reporter_phone) do nothing`,
      [input.id, input.targetType, input.targetId, input.phone, input.reason],
    );
  }
  const counts = await sql.query<{ n: number }>(
    `select count(distinct reporter_phone)::int as n from souq_reports
     where target_type = $1 and target_id = $2 and status = 'open'`,
    [input.targetType, input.targetId],
  );
  if (Number(counts[0]?.n ?? 0) >= 3) {
    if (input.targetType === "hello") {
      await sql.query(`update souq_hello_posts set status = 'hidden' where id = $1`, [input.targetId]);
    } else {
      await sql.query(`update souq_shops set hidden = true where slug = $1`, [input.targetId]);
    }
  }
  return { ok: true as const, inserted: !prior[0] };
}
