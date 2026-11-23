import { deleteStoredObject, isOwnedMedia } from "./object-store.ts";
import { usernameKey } from "./reserved-brand.ts";

/** One statement at a time. Callers that need a single commit wrap this themselves. */
export type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

const OTP_ATTEMPTS = 5;

export function usernamesMatch(stored: unknown, typed: unknown) {
  const left = usernameKey(stored);
  const right = usernameKey(typed);
  return Boolean(left) && left === right;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function pushUrl(bucket: string[], value: unknown) {
  if (typeof value !== "string" || !value || value.startsWith("data:")) return;
  bucket.push(value);
}

function pushMany(bucket: string[], value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) pushUrl(bucket, item);
    return;
  }
  if (typeof value === "string" && value.startsWith("[")) {
    try {
      pushMany(bucket, JSON.parse(value) as unknown);
    } catch {
      pushUrl(bucket, value);
    }
    return;
  }
  pushUrl(bucket, value);
}

type Refuse = "missing" | "password" | "username" | "otp" | "expired" | "attempts";

/**
 * Confirm password, username, and a WhatsApp code when this account has one.
 * A wrong password, username, or code returns before any account row is removed.
 * A wrong code spends one of five guesses. A wrong password does not.
 */
export async function deleteConfirmedAccount(
  sql: Sql,
  input: {
    phone: string;
    username: string;
    password: string;
    code?: string;
    whatsapp?: string;
    allowTestCode?: boolean;
    now?: number;
    passwordMatches: (password: string, hash: string) => Promise<boolean>;
    codeMatches: (code: string, salt: string, digest: string) => boolean;
    transact?: <T>(fn: (sql: Sql) => Promise<T>) => Promise<T>;
  },
): Promise<{ ok: true; urls: string[] } | { ok: false; error: Refuse }> {
  const rows = await sql.query<{ password_hash: string | null; data: unknown; shop_slug: string | null }>(
    `select password_hash, data, shop_slug from souq_accounts where phone = $1`,
    [input.phone],
  );
  const account = rows[0];
  if (!account) return { ok: false, error: "missing" };
  if (!account.password_hash) return { ok: false, error: "password" };
  let match = false;
  try {
    match = await input.passwordMatches(input.password, account.password_hash);
  } catch {
    match = false;
  }
  if (!match) return { ok: false, error: "password" };
  const data = asRecord(account.data);
  if (!usernamesMatch(data.username, input.username)) return { ok: false, error: "username" };
  const whatsapp = String(input.whatsapp ?? "").trim();
  if (whatsapp) {
    const code = await checkDeleteCode(sql, {
      phone: whatsapp,
      code: String(input.code ?? ""),
      allowTestCode: input.allowTestCode === true,
      now: input.now ?? Date.now(),
      codeMatches: input.codeMatches,
    });
    if (!code.ok) return code;
  }
  const run = input.transact ?? ((fn) => fn(sql));
  const urls = await run((trx) => eraseAccountData(trx, input.phone, whatsapp));
  return { ok: true, urls };
}

async function checkDeleteCode(
  sql: Sql,
  input: {
    phone: string;
    code: string;
    allowTestCode: boolean;
    now: number;
    codeMatches: (code: string, salt: string, digest: string) => boolean;
  },
): Promise<{ ok: true } | { ok: false; error: "otp" | "expired" | "attempts" }> {
  if (input.allowTestCode && input.code === "424242") return { ok: true };
  if (!/^\d{6}$/.test(input.code)) return { ok: false, error: "otp" };
  const rows = await sql.query<{ code_hash: string; salt: string; attempts: number; expires_at: string; purpose: string }>(
    `select code_hash, salt, attempts, expires_at, purpose from souq_otp where phone = $1`,
    [input.phone],
  );
  const otp = rows[0];
  if (!otp || otp.purpose !== "delete") return { ok: false, error: "otp" };
  if (new Date(otp.expires_at).getTime() <= input.now) {
    await sql.query(`delete from souq_otp where phone = $1`, [input.phone]);
    return { ok: false, error: "expired" };
  }
  if (Number(otp.attempts) >= OTP_ATTEMPTS) {
    await sql.query(`delete from souq_otp where phone = $1`, [input.phone]);
    return { ok: false, error: "attempts" };
  }
  if (!input.codeMatches(input.code, otp.salt, otp.code_hash)) {
    await sql.query(`update souq_otp set attempts = attempts + 1 where phone = $1`, [input.phone]);
    return { ok: false, error: "otp" };
  }
  return { ok: true };
}

/** Remove one person's rows. Returns photo URLs to queue after the transaction commits. */
export async function eraseAccountData(sql: Sql, phone: string, whatsapp = ""): Promise<string[]> {
  const accounts = await sql.query<{ shop_slug: string | null; data: unknown }>(
    `select shop_slug, data from souq_accounts where phone = $1`,
    [phone],
  );
  const account = accounts[0];
  if (!account) return [];
  const shops = await sql.query<{ slug: string; avatar_url: string | null; cover_url: string | null; thumb_url: string | null }>(
    `select slug, avatar_url, cover_url, thumb_url from souq_shops where owner_phone = $1`,
    [phone],
  );
  const slug = shops[0]?.slug || account.shop_slug || null;
  const listings = await sql.query<{ image_url: string | null; thumb_url: string | null; images: unknown; body: unknown }>(
    `select image_url, thumb_url, images, body from souq_listings
     where owner_phone = $1 or ($2::text is not null and shop_slug = $2)`,
    [phone, slug],
  );
  const posts = await sql.query<{ image_url: string | null; thumb_url: string | null }>(
    `select image_url, thumb_url from souq_hello_posts
     where owner_phone = $1 or ($2::text is not null and shop_slug = $2)`,
    [phone, slug],
  );
  const raw: string[] = [];
  const blob = asRecord(account.data);
  pushUrl(raw, blob.stallAvatar);
  pushUrl(raw, blob.stallCover);
  for (const shop of shops) {
    pushUrl(raw, shop.avatar_url);
    pushUrl(raw, shop.cover_url);
    pushUrl(raw, shop.thumb_url);
  }
  for (const row of listings) {
    pushUrl(raw, row.image_url);
    pushUrl(raw, row.thumb_url);
    pushMany(raw, row.images);
    const body = asRecord(row.body);
    pushMany(raw, body.images);
    pushUrl(raw, body.video);
    pushUrl(raw, body.image);
  }
  for (const post of posts) {
    pushUrl(raw, post.image_url);
    pushUrl(raw, post.thumb_url);
  }
  const urls = [...new Set(raw.filter((url) => isOwnedMedia(url)))];

  if (slug) {
    await sql.query(`update souq_shops set hidden = true, updated_at = now() where owner_phone = $1`, [phone]);
  }
  await sql.query(
    `delete from souq_hello_posts where owner_phone = $1 or ($2::text is not null and shop_slug = $2)`,
    [phone, slug],
  );
  await sql.query(
    `delete from souq_listings where owner_phone = $1 or ($2::text is not null and shop_slug = $2)`,
    [phone, slug],
  );
  await sql.query(
    `update souq_views v
     set review_count = greatest(v.review_count - c.n, 0)
     from (
       select shop_slug, count(*)::int as n
       from souq_reviews
       where author_phone = $1 and ($2::text is null or shop_slug is distinct from $2)
       group by shop_slug
     ) c
     where v.shop_slug = c.shop_slug and v.review_count > 0`,
    [phone, slug],
  );
  await sql.query(
    `delete from souq_reviews where author_phone = $1 or ($2::text is not null and shop_slug = $2)`,
    [phone, slug],
  );
  await sql.query(`delete from souq_reports where reporter_phone = $1`, [phone]);
  await sql.query(`delete from souq_buyer_places where owner_phone = $1`, [phone]);
  await sql.query(`delete from souq_promo_uses where phone = $1`, [phone]);
  await sql.query(`delete from souq_pending where phone = $1`, [phone]);
  await sql.query(`delete from souq_otp where phone = $1 or phone = $2`, [phone, whatsapp || phone]);
  await sql.query(`delete from souq_tokens where phone = $1`, [phone]);
  await sql.query(
    `update souq_orders set buyer_phone = '', address_name = '' where buyer_phone = $1`,
    [phone],
  );
  if (slug) {
    await sql.query(`delete from souq_slug_redirects where slug = $1 or old_slug = $1`, [slug]);
    await sql.query(`delete from souq_views where shop_slug = $1`, [slug]);
    await sql.query(`delete from souq_shops where owner_phone = $1`, [phone]);
  }
  await sql.query(`delete from souq_accounts where phone = $1`, [phone]);
  return urls;
}

/** Delete queued files that no listing or Hello post still shows. Missing files count as done. */
export async function releaseOwnedMedia(sql: Sql, urls: string[]) {
  const owned = [...new Set(urls.filter((url) => isOwnedMedia(url)))];
  for (const url of owned) {
    const hit = await sql.query<{ hit: number }>(
      `select 1 as hit from souq_listings
       where image_url = $1 or thumb_url = $1 or images @> $2::jsonb
       union all
       select 1 from souq_hello_posts
       where image_url = $1 or thumb_url = $1
       limit 1`,
      [url, JSON.stringify([url])],
    );
    if (hit[0]) continue;
    const result = await deleteStoredObject(url);
    if (result === "skipped" && !url.startsWith("/media/") && isOwnedMedia(url)) continue;
    await sql.query(`delete from souq_media_gc where url = $1`, [url]);
  }
}
