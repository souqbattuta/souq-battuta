import { useLayoutEffect, useState } from "react";
import { CATEGORIES, type Shop } from "./data.ts";

const CATEGORY_WORDS: Record<string, [string, string]> = {
  food: ["food", "أكل"],
  crafts: ["crafts", "حرف"],
  plants: ["plants", "نباتات"],
  beauty: ["beauty", "تجميل"],
  pets: ["pets", "حيوانات"],
  clothes: ["clothes", "أواعي"],
  misc: ["misc", "منوع"],
};

/** Category labels that start a shop's keywords. They do not use a paid slot. */
export function builtInKeywords(ids: string[] = []) {
  const words: string[] = [];
  for (const id of ids) {
    const cat = CATEGORIES.find((item) => item.id === id);
    if (!cat || cat.id === "all") continue;
    words.push(cat.en, cat.ar);
    const extra = CATEGORY_WORDS[id];
    if (extra) words.push(extra[0], extra[1]);
  }
  return [...new Set(words.map((word) => word.trim()).filter((word) => word.length >= 2))];
}

export function shopText(shop: Shop) {
  const category = CATEGORY_WORDS[shop.category] ?? [];
  return [
    shop.name,
    shop.nameAr,
    shop.category,
    ...category,
    shop.bio ?? "",
    shop.bioAr ?? "",
    ...(shop.keywords ?? []),
    ...shop.products.flatMap((product) => [product.name, product.nameAr, product.desc, product.descAr]),
  ]
    .join(" ")
    .toLowerCase();
}

export type AlgoLever =
  | "words"
  | "ordered"
  | "follow"
  | "shared"
  | "bookmarks"
  | "liked"
  | "visited"
  | "likeSimilar"
  | "followSimilar"
  | "fresh";

export const DEFAULT_ALGO_ORDER: AlgoLever[] = [
  "words",
  "ordered",
  "follow",
  "shared",
  "bookmarks",
  "liked",
  "visited",
  "likeSimilar",
  "followSimilar",
  "fresh",
];

export const WORD_CAP = 12;

export function algoOrder(order?: string[]) {
  const picked = (order ?? []).filter((item): item is AlgoLever => DEFAULT_ALGO_ORDER.includes(item as AlgoLever));
  const unique = [...new Set(picked)];
  if (!unique.length) return [...DEFAULT_ALGO_ORDER];
  return [...unique, ...DEFAULT_ALGO_ORDER.filter((item) => !unique.includes(item))];
}

function escapeWord(word: string) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function foldText(text: string) {
  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole word or whole phrase. "art" does not match "party". */
export function hasWord(text: string, word: string) {
  const clean = foldText(word);
  if (clean.length < 2) return false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:\\u0627\\u0644)?${escapeWord(clean)}(?![\\p{L}\\p{N}])`, "iu");
  return re.test(foldText(text));
}

export function shopMuted(shop: Shop, mutedWords: string[] = [], mutedStalls: string[] = []) {
  if (mutedStalls.includes(shop.slug)) return true;
  const blob = shopText(shop);
  return mutedWords.some((word) => hasWord(blob, word));
}

function daysOld(shop: Shop, now = Date.now()) {
  const stamp = shop.createdAt || shop.joinedAt;
  if (typeof stamp !== "number" || stamp <= 0) return 9999;
  const ms = stamp < 10_000_000_000 ? stamp * 1000 : stamp;
  return (now - ms) / 86400000;
}

/** Explicit internal flag only. A real shop whose name contains "test" is not a demo. */
export function isDemoShop(shop: { demo?: boolean }) {
  return shop.demo === true;
}

/** Production buyer catalogs drop demo shops. Hidden is a separate moderation flag. */
export function buyerVisibleShops<T extends { demo?: boolean }>(shops: T[], production: boolean) {
  if (!production) return shops;
  return shops.filter((shop) => !isDemoShop(shop));
}

function stallWords(shop: Shop) {
  return (shop.keywords ?? []).map((word) => word.toLowerCase()).filter(Boolean);
}

function isSimilar(shop: Shop, seeds: Shop[]) {
  if (seeds.some((seed) => seed.slug === shop.slug)) return false;
  const own = new Set(stallWords(shop));
  for (const seed of seeds) {
    const theirs = stallWords(seed);
    if (theirs.length && own.size && theirs.some((word) => own.has(word))) return true;
    if (!theirs.length && !own.size && seed.category === shop.category && shop.category !== "misc" && shop.category !== "all") return true;
  }
  return false;
}

export function rankForYou(
  shops: Shop[],
  input: {
    words: string[];
    favorites: string[];
    bookmarks: string[];
    visited?: string[];
    visits?: Record<string, number>;
    follows?: string[];
    ordered?: string[];
    shared?: string[];
    order?: string[];
    referred?: string;
    mutedWords?: string[];
    mutedStalls?: string[];
    tieSeed?: number;
    browsedCategories?: string[];
  },
) {
  const words = input.words.map((word) => word.toLowerCase()).filter((word) => word.length >= 2);
  const order = algoOrder(input.order);
  const follows = new Set(input.follows ?? []);
  const ordered = new Set(input.ordered ?? []);
  const shared = new Set(input.shared ?? []);
  const bookmarks = new Set(input.bookmarks);
  const likedSeeds = shops.filter((shop) => shop.products.some((product) => input.favorites.includes(product.id)));
  const followSeeds = shops.filter((shop) => follows.has(shop.slug));
  const tieSeed = input.tieSeed ?? 0;
  const score = (shop: Shop) => {
    const blob = shopText(shop);
    let value = 0;
    order.forEach((lever, index) => {
      const weight = order.length - index;
      let hit = 0;
      if (lever === "words") hit = words.filter((word) => hasWord(blob, word)).length;
      if (lever === "ordered") hit = ordered.has(shop.slug) ? 1 : 0;
      if (lever === "follow") hit = follows.has(shop.slug) ? 1 : 0;
      if (lever === "shared") hit = shared.has(shop.slug) ? 1 : 0;
      if (lever === "bookmarks") hit = bookmarks.has(shop.slug) ? 1 : 0;
      if (lever === "liked") hit = shop.products.some((product) => input.favorites.includes(product.id)) ? 1 : 0;
      if (lever === "visited") {
        const times = input.visits?.[shop.slug] ?? (input.visited?.includes(shop.slug) ? 1 : 0);
        hit = Math.min(times, 5);
      }
      if (lever === "likeSimilar") hit = isSimilar(shop, likedSeeds) ? 1 : 0;
      if (lever === "followSimilar") hit = isSimilar(shop, followSeeds) ? 1 : 0;
      if (lever === "fresh") {
        const young = daysOld(shop) <= 30;
        const matches = words.filter((word) => hasWord(blob, word)).length;
        const browsed = (input.browsedCategories ?? []).includes(shop.category);
        if (!young) hit = 0;
        else if (words.length) {
          hit = matches ? Math.min(matches, 5) + (matches >= 2 ? 2 : 0) : 0;
        } else hit = browsed ? 1 : 0;
      }
      if (hit) value += weight * Math.min(hit, 5);
    });
    if (input.referred && shop.slug === input.referred) value += 1;
    return value;
  };
  const tie = (slug: string) => {
    let hash = tieSeed >>> 0 || 1;
    for (const ch of slug) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    return hash >>> 0;
  };
  const seen = new Set<string>();
  return [...shops]
    .filter((shop) => {
      if (!shop?.slug || seen.has(shop.slug) || shop.hidden || isDemoShop(shop)) return false;
      if (!showInForYou(shop)) return false;
      if (shopMuted(shop, input.mutedWords, input.mutedStalls)) return false;
      seen.add(shop.slug);
      return true;
    })
    .sort((a, b) => score(b) - score(a) || tie(a.slug) - tie(b.slug));
}

export function showInForYou(shop: Shop) {
  const photos = [shop.cover, shop.avatar, ...shop.products.flatMap((product) => product.images ?? [])];
  return photos.some((src) => typeof src === "string" && src.length > 0 && !/duck\.jpg|placeholder|default-duck/i.test(src));
}

const PLAN_BOOST: Record<string, number> = { premium: 4, grow: 3, basic: 2, free: 1 };

/** Small nudge for Explore and category browse. Not used by For You. */
export function browseNudge(plan: string) {
  return plan === "premium" ? 3 : plan === "grow" ? 2 : plan === "basic" ? 1 : 0;
}

export function newPlacesShelf(shops: Shop[]) {
  const seen = new Set<string>();
  return shops
    .filter((shop) => {
      if (!shop?.slug || seen.has(shop.slug) || shop.hidden || isDemoShop(shop)) return false;
      if (!showInForYou(shop)) return false;
      if (daysOld(shop) > 30) return false;
      seen.add(shop.slug);
      return true;
    })
    .sort((a, b) => (PLAN_BOOST[b.plan] ?? 1) - (PLAN_BOOST[a.plan] ?? 1) || (b.createdAt ?? b.joinedAt ?? 0) - (a.createdAt ?? a.joinedAt ?? 0));
}

export function readTieSeed() {
  const key = "souq-tie-seed";
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return Number(saved) || 1;
  } catch {
    /* private mode */
  }
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0] || 1;
  try {
    sessionStorage.setItem(key, String(n));
  } catch {
    /* ignore */
  }
  return n;
}

export function useTieSeed() {
  const [seed, setSeed] = useState(0);
  useLayoutEffect(() => {
    setSeed(readTieSeed());
  }, []);
  return seed;
}

export function journeyHint(
  shops: Shop[],
  input: { recent: string[]; counts: Record<string, number>; interest: string[]; dismissed: string[]; ar: boolean },
) {
  const skip = new Set([...input.interest, ...input.dismissed].map((word) => word.toLowerCase()));
  const bySlug = new Map(shops.map((shop) => [shop.slug, shop]));
  const seen = input.recent.map((slug) => bySlug.get(slug)).filter((shop): shop is Shop => Boolean(shop));
  const tally = new Map<string, number>();
  const add = (word: string, times: number) => {
    const clean = word.trim().toLowerCase();
    if (clean.length < 2 || skip.has(clean)) return;
    tally.set(clean, (tally.get(clean) ?? 0) + times);
  };
  for (const shop of seen) {
    const times = input.counts[shop.slug] ?? 0;
    if (times < 2) continue;
    const category = CATEGORY_WORDS[shop.category];
    if (category) add(input.ar ? category[1] : category[0], times);
    for (const word of shop.keywords ?? []) add(word, times);
  }
  const best = [...tally.entries()]
    .filter((entry) => entry[1] >= 2)
    .sort((a, b) => b[1] - a[1] || Number(/[\u0600-\u06FF]/.test(b[0]) === input.ar) - Number(/[\u0600-\u06FF]/.test(a[0]) === input.ar))[0];
  return best?.[0] ?? "";
}
