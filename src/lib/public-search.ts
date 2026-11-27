import { AMMAN_AREAS } from "./near.ts";
import { planTie } from "./plan-tie.ts";
import { categorySearchText, hasWord } from "./shelves.ts";
import { queryTokens } from "./synonyms.ts";

export const SEARCH_CAP = 50;

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type PublicShopCard = {
  slug: string;
  name: string;
  area: string;
  plan: string;
  category: string;
  keywords: string[];
  bio: string;
  bioAr: string;
  hasWhatsapp: true;
  stallOpens: string;
  stallCloses: string;
  stallDays: string;
  stallHours: string;
  stallForce: string;
  avatar: string;
  cover: string;
  createdAt: number;
  products: { id: string; name: string; price: number; image: string; full: string; images: string[] }[];
};

type Field = { text: string; weight: number };

type Hit = {
  slug: string;
  plan: string;
  fields: Field[];
  available: boolean;
  rating: number;
  card: PublicShopCard;
};

const LIVE_WHERE = `
  s.hidden = false
  and s.name_hold = false
  and s.demo = false
  and coalesce(a.data->>'demo', 'false') <> 'true'
  and s.publishable = true
  and a.data->>'whatsappPhone' ~ '^\\+9627[789][0-9]{7}$'
  and (
    coalesce(nullif(a.data->>'planEnds', '')::bigint, 0) = 0
    or (a.data->>'planEnds')::bigint > $1
    or (s.plan <> 'free' and (a.data->>'planEnds')::bigint + $2 > $1)
  )
`;

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

function asStrings(value: unknown) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return [];
          }
        })()
      : [];
  return (Array.isArray(list) ? list : []).filter((item): item is string => typeof item === "string");
}

function areaTexts(area: string) {
  const clean = area.trim();
  const hit = AMMAN_AREAS.find((item) => item.en.toLowerCase() === clean.toLowerCase() || item.ar === clean);
  return hit ? [hit.en, hit.ar] : clean ? [clean] : [];
}

function addField(fields: Field[], text: string, weight: number) {
  const clean = text.trim();
  if (clean) fields.push({ text: clean, weight });
}

/** Match quality, then buyer signals, then plan. Empty query matches nothing. */
export function rankSearchHits(hits: Hit[], input: { query: string; follows?: string[]; interestWords?: string[] }) {
  const tokens = queryTokens(input.query);
  if (!tokens.length) return [];
  const follows = new Set((input.follows ?? []).map((slug) => slug.trim()).filter(Boolean));
  const words = (input.interestWords ?? []).map((word) => word.trim()).filter((word) => word.length >= 2);
  const scored = hits
    .map((hit) => {
      const matched = new Set<string>();
      let quality = 0;
      for (const field of hit.fields) {
        let n = 0;
        for (const token of tokens) {
          if (hasWord(field.text, token)) {
            n += 1;
            matched.add(token);
          }
        }
        if (n) quality += field.weight * n;
      }
      if (matched.size !== tokens.length) return null;
      const blob = hit.fields.map((field) => field.text).join(" ");
      let buyer = follows.has(hit.slug) ? 1000 : 0;
      if (words.length) buyer += words.filter((word) => hasWord(blob, word)).length * 10;
      if (hit.available) buyer += 1;
      if (hit.rating > 0) buyer += hit.rating;
      return { hit, quality, buyer };
    })
    .filter((row): row is { hit: Hit; quality: number; buyer: number } => Boolean(row));
  scored.sort(
    (a, b) =>
      b.quality - a.quality ||
      b.buyer - a.buyer ||
      planTie(b.hit.plan) - planTie(a.hit.plan) ||
      a.hit.slug.localeCompare(b.hit.slug),
  );
  return scored.slice(0, SEARCH_CAP).map((row) => row.hit.card);
}

type ShopRow = {
  slug: string;
  name: string;
  area: string;
  plan: string;
  category: string;
  keywords: unknown;
  bio: string | null;
  bio_ar: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  thumb_url: string | null;
  created_at: string | Date;
  stall_opens: string | null;
  stall_closes: string | null;
  stall_days: string | null;
  stall_hours: string | null;
  stall_force: string | null;
};

type ListingRow = {
  id: string;
  shop_slug: string;
  name: string;
  price: string | number | null;
  image_url: string | null;
  thumb_url: string | null;
  images: unknown;
  body: unknown;
};

/** Live shops only, same gate as listPublicShops. The card has no phone. */
export async function searchLiveShops(
  sql: Sql,
  input: { query: string; follows?: string[]; interestWords?: string[] },
): Promise<PublicShopCard[]> {
  const query = input.query.trim();
  if (queryTokens(query).length === 0) return [];
  const nowMs = Date.now();
  const rows = await sql.query<ShopRow>(
    `select s.slug, s.name, s.area, s.plan, s.category, s.keywords, s.bio,
        a.data->>'stallBioAr' as bio_ar,
        s.avatar_url, s.cover_url, s.thumb_url, s.created_at,
        a.data->>'stallOpens' as stall_opens,
        a.data->>'stallCloses' as stall_closes,
        a.data->>'stallDays' as stall_days,
        a.data->>'stallHours' as stall_hours,
        a.data->>'stallForce' as stall_force
      from souq_shops s
      join souq_accounts a on a.phone = s.owner_phone
      where ${LIVE_WHERE}`,
    [nowMs, 5 * 86400000],
  );
  if (!rows.length) return [];
  const slugs = rows.map((row) => row.slug);
  const marks = slugs.map((_, index) => `$${index + 1}`).join(", ");
  const listings = await sql.query<ListingRow>(
    `select id, shop_slug, name, price, image_url, thumb_url, images, body
     from souq_listings
     where shop_slug in (${marks})
       and coalesce(body->>'hidden', 'false') <> 'true'
       and coalesce(body->>'demo', 'false') <> 'true'`,
    slugs,
  );
  const ratings = await sql.query<{ shop_slug: string; rating: number | string | null }>(
    `select shop_slug, avg(score)::float8 as rating
     from souq_reviews
     where shop_slug in (${marks})
     group by shop_slug`,
    slugs,
  );
  const ratingOf = new Map(ratings.map((row) => [row.shop_slug, Number(row.rating)]));
  const byShop = new Map<string, ListingRow[]>();
  for (const item of listings) {
    const list = byShop.get(item.shop_slug) ?? [];
    list.push(item);
    byShop.set(item.shop_slug, list);
  }
  const hits = rows.map((row) => {
    const words = asStrings(row.keywords);
    const items = byShop.get(row.slug) ?? [];
    const fields: Field[] = [];
    addField(fields, row.name, 8);
    for (const area of areaTexts(row.area || "")) addField(fields, area, 3);
    addField(fields, row.bio || "", 2);
    addField(fields, row.bio_ar || "", 2);
    addField(fields, words.join(" "), 5);
    addField(fields, categorySearchText(row.category || ""), 3);
    let available = false;
    const mapped = items.map((item) => {
      const body = asRecord(item.body);
      const nameAr = typeof body.nameAr === "string" ? body.nameAr : "";
      const desc = typeof body.desc === "string" ? body.desc : "";
      const descAr = typeof body.descAr === "string" ? body.descAr : "";
      const paused = body.paused === true || body.paused === "true";
      if (!paused) available = true;
      addField(fields, item.name, 6);
      if (nameAr && nameAr !== item.name) addField(fields, nameAr, 6);
      addField(fields, desc, 1);
      if (descAr && descAr !== desc) addField(fields, descAr, 1);
      const gallery = asStrings(item.images).filter((src) => src.length > 0);
      const full = item.image_url || gallery[0] || item.thumb_url || "";
      return {
        id: item.id,
        name: item.name,
        price: item.price == null ? 0 : Number(item.price),
        image: item.thumb_url || gallery[0] || full,
        full,
        images: gallery.length ? gallery : [full].filter(Boolean),
      };
    });
    const products = mapped.slice(0, 12);
    const photo = row.thumb_url || row.avatar_url || row.cover_url || products[0]?.image || "";
    const card: PublicShopCard = {
      slug: row.slug,
      name: row.name,
      area: row.area,
      plan: row.plan,
      category: row.category || "misc",
      keywords: words,
      bio: row.bio || "",
      bioAr: row.bio_ar || row.bio || "",
      hasWhatsapp: true,
      stallOpens: row.stall_opens || "",
      stallCloses: row.stall_closes || "",
      stallDays: row.stall_days || "",
      stallHours: row.stall_hours || "",
      stallForce: row.stall_force || "",
      avatar: photo,
      cover: row.cover_url || photo,
      createdAt: new Date(row.created_at).getTime(),
      products,
    };
    return {
      slug: row.slug,
      plan: row.plan,
      fields,
      available,
      rating: Number.isFinite(ratingOf.get(row.slug)) ? (ratingOf.get(row.slug) as number) : 0,
      card,
    };
  });
  return rankSearchHits(hits, input);
}
