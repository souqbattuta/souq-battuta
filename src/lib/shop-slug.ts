import { isReservedBrand } from "./reserved-brand.ts";
import { slugHasPhone } from "./site.ts";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

type Queryable = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

/** Slug stored on the shop, or empty when it still contains a phone. */
export function usableShopSlug(slug: unknown) {
  const text = String(slug ?? "").trim();
  if (!text || slugHasPhone(text)) return "";
  return text;
}

/**
 * Public shop address from a name. Lower case, Arabic kept, spaces become one dash.
 * Empty when the name is too short, only digits, a phone, or the Souq Battuta brand.
 */
export function shopSlugCandidate(name: unknown) {
  let text = String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\u0640/g, "");
  if (!text) return "";
  text = text.replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, "");
  text = text.replace(/\d{7,}/g, "");
  text = text.replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (text.length > 40) text = text.slice(0, 40).replace(/-+$/g, "");
  if (text.length < 3) return "";
  if (/^\d+$/.test(text) || /^stall-\d+$/i.test(text) || slugHasPhone(text)) return "";
  if (isReservedBrand(text) || isReservedBrand(name)) return "";
  return text;
}

/** First usable slug from shop name, display name, then username. */
export function shopSlugSeed(...names: unknown[]) {
  for (const name of names) {
    const slug = shopSlugCandidate(name);
    if (slug) return slug;
  }
  return "";
}

function randomLetters(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += LETTERS[byte % LETTERS.length];
  return out;
}

export function shopSlugWithSuffix(base: string, suffix: string) {
  const extra = `-${suffix}`;
  const room = Math.max(3, 40 - extra.length);
  let stem = (base || "shop").slice(0, room).replace(/-+$/g, "");
  if (stem.length < 3) stem = "shop";
  const slug = `${stem}${extra}`.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-+$/g, "");
  return slugHasPhone(slug) ? "" : slug;
}

function asData(value: unknown) {
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

async function slugTaken(sql: Queryable, slug: string) {
  const rows = await sql.query<{ hit: number }>(
    `select 1 as hit from souq_shops where slug = $1
     union all
     select 1 from souq_accounts where shop_slug = $1
     union all
     select 1 from souq_slug_redirects where old_slug = $1
     limit 1`,
    [slug],
  );
  return Boolean(rows[0]);
}

/** Pick a free name slug. Call inside a transaction. The suffix is letters, never a phone. */
export async function assignShopSlug(sql: Queryable, names: unknown[]) {
  const base = shopSlugSeed(...names) || "shop";
  await sql.query(`select pg_advisory_xact_lock(hashtext($1))`, [`souq-slug:${base}`]);
  const first = shopSlugCandidate(base);
  if (first && !(await slugTaken(sql, first))) return first;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = shopSlugWithSuffix(first || "shop", randomLetters(attempt < 6 ? 4 : 8));
    if (!slug || slugHasPhone(slug)) continue;
    if (!(await slugTaken(sql, slug))) return slug;
  }
  const slug = shopSlugWithSuffix("shop", randomLetters(10));
  if (!slug || slugHasPhone(slug)) throw new Error("unsafe shop slug");
  return slug;
}

/** Point every row that used the old slug at the new one, and remember the old address. */
export async function renameShopSlug(sql: Queryable, from: string, to: string, ownerPhone = "") {
  if (!from || from === to || slugHasPhone(to) || !to) throw new Error("unsafe shop slug");
  await sql.query(`update souq_listings set shop_slug = $2 where shop_slug = $1`, [from, to]);
  await sql.query(`update souq_orders set shop_slug = $2 where shop_slug = $1`, [from, to]);
  await sql.query(`update souq_reviews set shop_slug = $2 where shop_slug = $1`, [from, to]);
  await sql.query(`update souq_views set shop_slug = $2 where shop_slug = $1`, [from, to]);
  await sql.query(`update souq_hello_posts set shop_slug = $2 where shop_slug = $1`, [from, to]);
  await sql.query(
    `delete from souq_reports gone
     using souq_reports keep
     where gone.target_type = 'shop' and gone.target_id = $1
       and keep.target_type = 'shop' and keep.target_id = $2
       and keep.reporter_phone = gone.reporter_phone`,
    [from, to],
  );
  await sql.query(`update souq_reports set target_id = $2 where target_type = 'shop' and target_id = $1`, [from, to]);
  await sql.query(`update souq_accounts set shop_slug = $2 where shop_slug = $1 or ($3 <> '' and phone = $3)`, [from, to, ownerPhone]);
  await sql.query(`update souq_shops set slug = $2 where slug = $1`, [from, to]);
  await sql.query(`update souq_slug_redirects set slug = $2 where slug = $1`, [from, to]);
  await sql.query(
    `insert into souq_slug_redirects (old_slug, slug) values ($1, $2)
     on conflict (old_slug) do update set slug = excluded.slug`,
    [from, to],
  );
}

export async function lookupSlugRedirect(sql: Queryable, slug: string) {
  let key = String(slug ?? "").trim();
  try {
    key = decodeURIComponent(key);
  } catch {
    /* already decoded */
  }
  key = key.toLowerCase();
  if (!slugHasPhone(key)) return "";
  const rows = await sql.query<{ slug: string }>(`select slug from souq_slug_redirects where old_slug = $1`, [key]);
  const next = rows[0]?.slug ?? "";
  return next && !slugHasPhone(next) ? next : "";
}

/**
 * Give every stall-<digits> (or other phone-digit) shop a name slug.
 * Does not delete the shop or clear a reserved-name hold.
 */
export async function sweepPhoneSlugs(sql: Queryable) {
  const rows = await sql.query<{ slug: string; name: string | null; owner_phone: string | null; data: unknown }>(
    `select s.slug, s.name, s.owner_phone, a.data
     from souq_shops s
     left join souq_accounts a on a.phone = s.owner_phone
     where s.slug ~* '^stall-[0-9]+$' or s.slug ~ '[0-9]{7}'`,
  );
  let moved = 0;
  for (const row of rows) {
    if (!slugHasPhone(row.slug)) continue;
    const data = asData(row.data);
    await sql.query("BEGIN");
    try {
      const next = await assignShopSlug(sql, [row.name, data.shopName, data.displayName, data.username]);
      await renameShopSlug(sql, row.slug, next, row.owner_phone ?? "");
      await sql.query("COMMIT");
      moved += 1;
    } catch (error) {
      try {
        await sql.query("ROLLBACK");
      } catch {
        /* the connection may already be aborted */
      }
      throw error;
    }
  }
  return { checked: rows.length, moved };
}
