/** One public address. Override with SITE_URL on the server when needed. */
const DEFAULT_SITE = "https://souqbattuta.com";

function fromEnv() {
  const raw = typeof process !== "undefined" ? process.env.SITE_URL : undefined;
  const text = String(raw ?? "").trim().replace(/\/$/, "");
  return /^https:\/\/[a-z0-9.-]+$/i.test(text) ? text : "";
}

export const SITE_URL = fromEnv() || DEFAULT_SITE;

/** The preview host Google must leave. Every path 301s to SITE_URL. */
export const LEGACY_HOST = "wave-sage-hill-pepper.grok.me";

export const TAGLINE_EN = "Amman first. Sellers keep the customer.";
export const TAGLINE_AR = "عمّان أولاً. البائع يحتفظ بالزبون.";
export const HOME_TITLE = `Souq Battuta | سوق بطوطة – ${TAGLINE_EN}`;
export const HOME_DESCRIPTION = `${TAGLINE_EN} ${TAGLINE_AR}`;

export const SOCIAL_URLS = ["https://www.instagram.com/souqbattuta", "https://x.com/souqbattuta"] as const;

export const DUCK_LOGO = "/brand/duck-mark.png";

/** Launch aisles. Same names as CATEGORIES. */
export const PUBLIC_CATEGORIES: { id: string; en: string; ar: string }[] = [
  { id: "food", en: "Food", ar: "طعام" },
  { id: "handicrafts", en: "Handicrafts", ar: "حرف يدوية" },
  { id: "jewelry", en: "Jewelry", ar: "مجوهرات" },
  { id: "farmers-market", en: "Farmers Market", ar: "سوق المزارعين" },
  { id: "misc", en: "Misc", ar: "متنوع" },
  { id: "beauty", en: "Beauty", ar: "جمال" },
  { id: "clothes", en: "Clothes", ar: "ملابس" },
];

const PRIVATE_EXACT = new Set([
  "/seller",
  "/desk",
  "/account",
  "/admin",
  "/inbox",
  "/checklist",
  "/otp",
  "/sign-in",
  "/forgot",
  "/join/seller/plan",
  "/welcome",
]);

export function isPrivatePath(path: string) {
  const clean = path.split("?")[0] || "/";
  if (PRIVATE_EXACT.has(clean)) return true;
  if (clean.startsWith("/api/")) return true;
  if (clean === "/buyer" || clean.startsWith("/buyer/")) return true;
  for (const prefix of ["/seller/", "/desk/", "/account/", "/admin/", "/inbox/", "/checklist/", "/otp/", "/sign-in/", "/forgot/", "/welcome/", "/join/seller/plan/"]) {
    if (clean.startsWith(prefix)) return true;
  }
  return false;
}

/** A phone-digit slug stays out of the sitemap and out of Google. */
export function slugHasPhone(slug: string) {
  return /^stall-\d+$/i.test(slug) || /\d{7,}/.test(slug);
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

export function shopPath(slug: string, itemId?: string) {
  const base = `/shop/${encodeURIComponent(slug)}`;
  return itemId ? `${base}/i/${encodeURIComponent(itemId)}` : base;
}

export function keepLang(search: Record<string, unknown>): { lang?: "en" | "ar" } {
  if (search.lang === "ar" || search.lang === "en") return { lang: search.lang };
  return {};
}

export function explicitLang(search: string | { lang?: unknown } | undefined): "en" | "ar" | undefined {
  if (!search) return undefined;
  if (typeof search === "string") {
    const lang = new URLSearchParams(search.replace(/^\?/, "")).get("lang");
    return lang === "ar" || lang === "en" ? lang : undefined;
  }
  return search.lang === "ar" || search.lang === "en" ? search.lang : undefined;
}

export function canonicalUrl(path: string, lang?: "en" | "ar") {
  const clean = absoluteUrl(path.split("?")[0] || "/");
  return lang === "ar" ? `${clean}?lang=ar` : clean;
}

export function languageLinks(path: string) {
  const clean = path.split("?")[0] || "/";
  const en = absoluteUrl(clean);
  return [
    { rel: "alternate" as const, hrefLang: "en", href: en },
    { rel: "alternate" as const, hrefLang: "ar", href: `${en}?lang=ar` },
    { rel: "alternate" as const, hrefLang: "x-default", href: en },
  ];
}

export function publicText(value: string) {
  return String(value ?? "")
    .replace(/\+?962[\s().-]*7[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d/g, "")
    .replace(/\b07\d{8}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function clip(value: string, max: number) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function pageLangOf(search: unknown): "en" | "ar" {
  return explicitLang(search as { lang?: unknown }) ?? "en";
}

export function shareMeta(title: string, description: string, url: string, image: string) {
  const img = absoluteUrl(image || DUCK_LOGO);
  return [
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: img },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Souq Battuta" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
  ];
}

export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Souq Battuta",
        alternateName: ["Sooq Battuta", "سوق بطوطة"],
        url: SITE_URL,
        logo: absoluteUrl(DUCK_LOGO),
        sameAs: [...SOCIAL_URLS],
      },
      {
        "@type": "WebSite",
        name: "Souq Battuta",
        alternateName: ["Sooq Battuta", "سوق بطوطة"],
        url: SITE_URL,
      },
    ],
  };
}

export function storeJsonLd(shop: { name: string; slug: string; area: string; image?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    url: absoluteUrl(shopPath(shop.slug)),
    image: absoluteUrl(shop.image || DUCK_LOGO),
    address: {
      "@type": "PostalAddress",
      addressLocality: shop.area,
    },
  };
}

export function productJsonLd(shop: { name: string; slug: string }, item: { id: string; name: string; description?: string; image?: string; price: number; outOfStock?: boolean }) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    image: item.image ? absoluteUrl(item.image) : undefined,
    description: item.description || undefined,
    brand: { "@type": "Brand", name: shop.name },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(shopPath(shop.slug, item.id)),
      priceCurrency: "JOD",
      price: item.price.toFixed(2),
      availability: item.outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };
}

export function hasFixedPrice(item: { price?: number | null; priceMode?: string | null }) {
  if (item.priceMode === "inquire" || item.priceMode === "na") return false;
  const price = Number(item.price);
  return Number.isFinite(price) && price > 0;
}

export function xmlEscape(value: string) {
  return String(value ?? "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026apos;");
}
