import { isSellerCategory, normalizePlan, type CategoryId, type Product, type Review, type Shop } from "@/lib/data";
import { hasFixedPrice, publicText, shopPath, SITE_URL, slugHasPhone, xmlEscape, PUBLIC_CATEGORIES } from "@/lib/site";

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

const GRACE_MS = 5 * 86400000;

const LIVE_SQL = `
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

async function sqlClient(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function isTrue(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
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

function asStrings(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  return list.filter((item): item is string => typeof item === "string" && item.length > 0 && !item.startsWith("data:"));
}

function gallery(row: { image_url?: string | null; thumb_url?: string | null; images?: unknown; body?: unknown }) {
  const body = asRecord(row.body);
  const urls = [...asStrings(row.images), ...asStrings(body.images)];
  if (row.image_url && !row.image_url.startsWith("data:")) urls.push(row.image_url);
  if (row.thumb_url && !row.thumb_url.startsWith("data:")) urls.push(row.thumb_url);
  return [...new Set(urls)].slice(0, 6);
}

function hoursLabel(row: { stall_opens?: string | null; stall_closes?: string | null; stall_days?: string | null; stall_hours?: string | null }) {
  if (row.stall_opens && row.stall_closes) {
    const days = (row.stall_days || "").split(",").filter(Boolean);
    const names = days.map((day) => day.slice(0, 1).toUpperCase() + day.slice(1, 3)).join(" ");
    return `${names ? `${names} · ` : ""}${row.stall_opens}–${row.stall_closes}`;
  }
  return row.stall_hours || "";
}

function toProduct(row: { id: string; name: string; price: string | number | null; image_url?: string | null; thumb_url?: string | null; images?: unknown; body?: unknown }): Product {
  const body = asRecord(row.body);
  const mode = body.priceMode === "na" || body.priceMode === "inquire" ? body.priceMode : body.priceMode === "price" ? "price" : undefined;
  const price = row.price == null || row.price === "" ? 0 : Number(row.price);
  const name = String(row.name || "");
  const nameAr = typeof body.nameAr === "string" && body.nameAr.trim() ? body.nameAr : name;
  return {
    id: row.id,
    name,
    nameAr,
    price: Number.isFinite(price) ? price : 0,
    priceMode: mode,
    desc: typeof body.desc === "string" ? body.desc : "",
    descAr: typeof body.descAr === "string" ? body.descAr : "",
    images: gallery(row),
    group: typeof body.group === "string" ? body.group : undefined,
    groupAr: typeof body.groupAr === "string" ? body.groupAr : undefined,
    paused: body.paused === true,
    hideReason: body.hideReason === "unavailable" || body.hideReason === "stock" || body.hideReason === "sold" ? body.hideReason : undefined,
  };
}

type ShopRow = {
  slug: string;
  name: string;
  area: string;
  plan: string;
  category: string;
  bio: string;
  bio_ar: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  stall_opens: string | null;
  stall_closes: string | null;
  stall_days: string | null;
  stall_hours: string | null;
  stall_force: string | null;
  contact_when_closed: string | null;
  has_wa: boolean;
  live: boolean;
  owner_phone: string;
  name_hold: boolean | string | null;
};

function toShop(row: ShopRow, products: Product[], reviews: Review[]): Shop {
  const category = isSellerCategory(row.category) ? (row.category as CategoryId) : "misc";
  const area = row.area || "Amman";
  const plan = normalizePlan(row.plan);
  return {
    slug: row.slug,
    name: row.name,
    nameAr: row.name,
    area,
    areaAr: area === "Amman" || !row.area ? "عمّان" : area,
    category,
    offAisle: !isSellerCategory(row.category),
    plan,
    phone: "",
    hasWhatsapp: isTrue(row.has_wa),
    avatar: row.avatar_url || (plan === "free" ? "/brand/avatars/seller-duck.jpg?v=2" : "/brand/avatars/default-duck.jpg"),
    cover: row.cover_url || undefined,
    bio: row.bio || "",
    bioAr: row.bio_ar || row.bio || "",
    hours: hoursLabel(row),
    isOpen: row.stall_force === "open" ? true : row.stall_force === "closed" ? false : null,
    contactWhenClosed: row.contact_when_closed !== "false",
    products,
    reviews,
    mode: "inquire",
    km: 0,
  };
}

const SHOP_SELECT = `
  select s.slug, s.name, s.area, s.plan, s.category, s.bio, s.owner_phone,
    a.data->>'stallBioAr' as bio_ar,
    s.avatar_url, s.cover_url,
    a.data->>'stallOpens' as stall_opens,
    a.data->>'stallCloses' as stall_closes,
    a.data->>'stallDays' as stall_days,
    a.data->>'stallHours' as stall_hours,
    a.data->>'stallForce' as stall_force,
    a.data->>'contactWhenClosed' as contact_when_closed,
    (a.data->>'whatsappPhone' ~ '^\\+9627[789][0-9]{7}$') as has_wa,
    (${LIVE_SQL}) as live,
    s.name_hold
  from souq_shops s
  join souq_accounts a on a.phone = s.owner_phone
`;

export async function loadShopPage(slug: string, viewerPhone: string | null) {
  const sql = await sqlClient();
  const now = Date.now();
  const rows = await sql.query<ShopRow>(
    `${SHOP_SELECT}
     where s.slug = $3
       and s.demo = false
       and coalesce(a.data->>'demo', 'false') <> 'true'
     limit 1`,
    [now, GRACE_MS, slug],
  );
  const row = rows[0];
  if (!row || isTrue(row.name_hold)) return { shop: null as Shop | null, indexable: false };
  const live = isTrue(row.live);
  const owner = Boolean(viewerPhone && row.owner_phone === viewerPhone);
  if (!live && !owner) return { shop: null as Shop | null, indexable: false };
  const listings = await sql.query<{ id: string; name: string; price: string | number | null; image_url: string | null; thumb_url: string | null; images: unknown; body: unknown }>(
    `select id, name, price, image_url, thumb_url, images, body
     from souq_listings
     where shop_slug = $1
       and coalesce(body->>'hidden', 'false') <> 'true'
       and coalesce(body->>'demo', 'false') <> 'true'
       and coalesce(body->>'paused', 'false') <> 'true'
     order by created_at asc`,
    [slug],
  );
  const reviews = await sql.query<{ id: string; author_phone: string; author_name: string; area: string; score: number; comment: string }>(
    `select id, author_phone, author_name, area, score, comment from souq_reviews where shop_slug = $1 order by created_at asc limit 30`,
    [slug],
  );
  const shop = toShop(
    row,
    listings.map(toProduct).filter((item) => !item.paused && !item.hideReason),
    reviews.map((review) => ({
      id: review.id,
      mine: Boolean(viewerPhone && review.author_phone === viewerPhone),
      user: review.author_name || "Buyer",
      area: review.area || "",
      score: Number(review.score) || 0,
      comment: review.comment || "",
    })),
  );
  return { shop, indexable: live && !slugHasPhone(slug) };
}

export async function slugForHandle(handle: string) {
  const key = handle.trim().toLowerCase();
  if (!key || key.length > 80 || slugHasPhone(key)) return null;
  const sql = await sqlClient();
  const now = Date.now();
  const rows = await sql.query<{ slug: string }>(
    `select s.slug
     from souq_shops s
     join souq_accounts a on a.phone = s.owner_phone
     where ${LIVE_SQL}
       and s.slug !~ '^stall-[0-9]+$'
       and s.slug !~ '[0-9]{7}'
       and (
         lower(a.data->>'username') = $3
         or lower(s.slug) = $3
       )
     limit 1`,
    [now, GRACE_MS, key],
  );
  const slug = rows[0]?.slug;
  return slug && !slugHasPhone(slug) ? slug : null;
}

type IndexShop = { slug: string; updated_at: string | Date };
type IndexItem = {
  id: string;
  shop_slug: string;
  created_at: string | Date;
  name: string;
  price: string | number | null;
  image_url: string | null;
  thumb_url: string | null;
  images: unknown;
  body: unknown;
  shop_name: string;
  shopping: string | null;
};

function stamp(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

async function indexRows() {
  const sql = await sqlClient();
  const now = Date.now();
  const shops = await sql.query<IndexShop>(
    `select s.slug, s.updated_at
     from souq_shops s
     join souq_accounts a on a.phone = s.owner_phone
     where ${LIVE_SQL}
       and s.slug !~ '^stall-[0-9]+$'
       and s.slug !~ '[0-9]{7}'
     order by s.updated_at desc`,
    [now, GRACE_MS],
  );
  const items = await sql.query<IndexItem>(
    `select l.id, l.shop_slug, l.created_at, l.name, l.price, l.image_url, l.thumb_url, l.images, l.body,
            s.name as shop_name, a.data->>'googleShopping' as shopping
     from souq_listings l
     join souq_shops s on s.slug = l.shop_slug
     join souq_accounts a on a.phone = s.owner_phone
     where ${LIVE_SQL}
       and s.slug !~ '^stall-[0-9]+$'
       and s.slug !~ '[0-9]{7}'
       and coalesce(l.body->>'hidden', 'false') <> 'true'
       and coalesce(l.body->>'demo', 'false') <> 'true'
       and coalesce(l.body->>'paused', 'false') <> 'true'
       and coalesce(l.body->>'hideReason', '') = ''
     order by l.created_at desc`,
    [now, GRACE_MS],
  );
  return {
    shops: shops.filter((shop) => !slugHasPhone(shop.slug)),
    items: items.filter((item) => !slugHasPhone(item.shop_slug)),
  };
}

const STATIC_PATHS = ["/", "/home", "/join", "/sell", "/discover", "/hello", "/privacy"];

function sitemapUrls(shops: IndexShop[], items: IndexItem[]) {
  const urls: { loc: string; lastmod?: string }[] = [
    ...STATIC_PATHS.map((path) => ({ loc: `${SITE_URL}${path === "/" ? "/" : path}` })),
    ...PUBLIC_CATEGORIES.map((category) => ({ loc: `${SITE_URL}/category/${category.id}` })),
    ...shops.map((shop) => ({ loc: `${SITE_URL}${shopPath(shop.slug)}`, lastmod: stamp(shop.updated_at) })),
    ...items.map((item) => ({ loc: `${SITE_URL}${shopPath(item.shop_slug, item.id)}`, lastmod: stamp(item.created_at) })),
  ];
  return urls;
}

function urlset(urls: { loc: string; lastmod?: string }[]) {
  const body = urls
    .map((url) => `  <url><loc>${xmlEscape(url.loc)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export async function renderSitemap(request: Request) {
  const { shops, items } = await indexRows();
  const urls = sitemapUrls(shops, items);
  const partSize = 50000;
  const url = new URL(request.url);
  const part = Number(url.searchParams.get("part") || "0");
  if (urls.length > partSize) {
    const parts = Math.ceil(urls.length / partSize);
    if (part >= 1 && part <= parts) {
      return xml(urlset(urls.slice((part - 1) * partSize, part * partSize)));
    }
    const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from({ length: parts }, (_, i) => `  <sitemap><loc>${xmlEscape(`${SITE_URL}/sitemap.xml?part=${i + 1}`)}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`;
    return xml(index);
  }
  return xml(urlset(urls));
}

function feedItem(row: IndexItem) {
  const product = toProduct(row);
  if (!hasFixedPrice(product)) return "";
  const image = product.images[0];
  if (!image) return "";
  if (row.shopping === "false") return "";
  const body = asRecord(row.body);
  const out = body.availability === "out_of_stock";
  const title = publicText(product.name) || product.name;
  const description = publicText(product.desc || product.nameAr || title) || title;
  const link = `${SITE_URL}${shopPath(row.shop_slug, row.id)}`;
  const brand = publicText(row.shop_name) || row.shop_name;
  return `    <item>
      <g:id>${xmlEscape(row.id)}</g:id>
      <title>${xmlEscape(title)}</title>
      <description>${xmlEscape(description)}</description>
      <link>${xmlEscape(link)}</link>
      <g:image_link>${xmlEscape(image.startsWith("http") ? image : `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`)}</g:image_link>
      <g:price>${product.price.toFixed(2)} JOD</g:price>
      <g:availability>${out ? "out_of_stock" : "in_stock"}</g:availability>
      <g:brand>${xmlEscape(brand)}</g:brand>
      <g:condition>new</g:condition>
    </item>`;
}

export async function renderMerchantFeed() {
  const { items } = await indexRows();
  const body = items.map(feedItem).filter(Boolean).join("\n");
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Souq Battuta</title>
    <link>${SITE_URL}</link>
    <description>Amman first. Sellers keep the customer.</description>
${body}
  </channel>
</rss>
`;
  return xml(xmlBody);
}

export function renderRobots() {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /seller",
    "Disallow: /desk",
    "Disallow: /account",
    "Disallow: /admin",
    "Disallow: /inbox",
    "Disallow: /checklist",
    "Disallow: /otp",
    "Disallow: /sign-in",
    "Disallow: /forgot",
    "Disallow: /join/seller/plan",
    "Disallow: /welcome",
    "Disallow: /api/",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function xml(body: string) {
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
