import type { Product, Shop } from "@/lib/data";
import {
  DUCK_LOGO,
  TAGLINE_AR,
  TAGLINE_EN,
  canonicalUrl,
  clip,
  hasFixedPrice,
  productJsonLd,
  publicText,
  shareMeta,
  shopPath,
  storeJsonLd,
} from "@/lib/site";

export function shopHead(shop: Shop, lang: "en" | "ar", indexable: boolean, item?: Product) {
  const ar = lang === "ar";
  const shopName = ar ? shop.nameAr || shop.name : shop.name;
  const area = ar ? shop.areaAr || shop.area : shop.area;
  const itemName = item ? (ar ? item.nameAr || item.name : item.name) : "";
  const title = item ? `${itemName} – ${shopName} | Souq Battuta` : `${shopName} – ${area} | Souq Battuta`;
  const raw = item
    ? (ar ? item.descAr || item.desc : item.desc) || (ar ? shop.bioAr || shop.bio : shop.bio)
    : ar
      ? shop.bioAr || shop.bio
      : shop.bio;
  const description = clip(publicText(raw || (ar ? TAGLINE_AR : TAGLINE_EN)), 160);
  const path = shopPath(shop.slug, item?.id);
  const canonical = canonicalUrl(path, lang);
  const image = item?.images?.[0] || shop.cover || shop.avatar || DUCK_LOGO;
  const priced = item && hasFixedPrice(item) ? item : undefined;
  const json = indexable
    ? [
        {
          "script:ld+json": storeJsonLd({
            name: shopName,
            slug: shop.slug,
            area: ar ? shop.areaAr || shop.area : shop.area,
            image: shop.cover || shop.avatar || DUCK_LOGO,
          }),
        },
        ...(priced
          ? [
              {
                "script:ld+json": productJsonLd(
                  { name: shopName, slug: shop.slug },
                  {
                    id: priced.id,
                    name: itemName,
                    description: publicText(ar ? priced.descAr || priced.desc : priced.desc),
                    image: priced.images[0],
                    price: priced.price,
                  },
                ),
              },
            ]
          : []),
      ]
    : [];
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: indexable ? "index, follow" : "noindex, nofollow" },
      ...(indexable ? shareMeta(title, description, canonical, image) : []),
      ...json,
    ],
    links: [
      { rel: "canonical" as const, href: canonical },
      ...(image
        ? [{ rel: "preload" as const, as: "image" as const, href: image, fetchPriority: "high" as const }]
        : []),
    ],
  };
}
