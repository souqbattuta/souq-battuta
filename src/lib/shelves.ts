import type { Shop } from "./data";

const CATEGORY_WORDS: Record<string, [string, string]> = {
  food: ["food", "أكل"],
  crafts: ["crafts", "حرف"],
  plants: ["plants", "نباتات"],
  beauty: ["beauty", "تجميل"],
  pets: ["pets", "حيوانات"],
  clothes: ["clothes", "أواعي"],
  misc: ["misc", "منوع"],
};

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

const PREVIOUS_ALGO_ORDER = ["words", "visited", "bookmarks", "liked"];

export const WORD_CAP = 12;

export function algoOrder(order?: string[]) {
  const sameAsPrevious =
    !!order && order.length === PREVIOUS_ALGO_ORDER.length && PREVIOUS_ALGO_ORDER.every((item, index) => order[index] === item);
  if (!order?.length || sameAsPrevious) return [...DEFAULT_ALGO_ORDER];
  const picked = order.filter((item): item is AlgoLever => DEFAULT_ALGO_ORDER.includes(item as AlgoLever));
  return [...picked, ...DEFAULT_ALGO_ORDER.filter((item) => !picked.includes(item))];
}
export function shopMuted(shop: Shop, mutedWords: string[] = [], mutedStalls: string[] = []) {
  if (mutedStalls.includes(shop.slug)) return true;
  const blob = shopText(shop);
  return mutedWords.some((word) => word && blob.includes(word.toLowerCase()));
}

const MONTH: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function sinceKey(since?: string) {
  if (!since) return 0;
  const year = Number(since.match(/20\d{2}/)?.[0] ?? 0);
  if (!year) return 0;
  return year * 12 + (MONTH[since.toLowerCase().slice(0, 3)] ?? 0);
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
  },
) {
  const words = input.words.map((word) => word.toLowerCase()).filter(Boolean);
  const order = algoOrder(input.order);
  const follows = new Set(input.follows ?? []);
  const ordered = new Set(input.ordered ?? []);
  const shared = new Set(input.shared ?? []);
  const bookmarks = new Set(input.bookmarks);
  const now = new Date();
  const nowKey = now.getFullYear() * 12 + now.getMonth();
  const likedSeeds = shops.filter((shop) => shop.products.some((product) => input.favorites.includes(product.id)));
  const followSeeds = shops.filter((shop) => follows.has(shop.slug));
  const score = (shop: Shop) => {
    const blob = shopText(shop);
    let value = 0;
    order.forEach((lever, index) => {
      const weight = (order.length - index) * 100;
      let hit = 0;
      if (lever === "words") hit = words.filter((word) => blob.includes(word)).length;
      if (lever === "ordered") hit = ordered.has(shop.slug) ? 1 : 0;
      if (lever === "follow") hit = follows.has(shop.slug) ? 1 : 0;
      if (lever === "shared") hit = shared.has(shop.slug) ? 1 : 0;
      if (lever === "bookmarks") hit = bookmarks.has(shop.slug) ? 1 : 0;
      if (lever === "liked") hit = shop.products.some((product) => input.favorites.includes(product.id)) ? 1 : 0;
      if (lever === "visited") {
        const times = input.visits?.[shop.slug] ?? (input.visited?.includes(shop.slug) ? 1 : 0);
        hit = times > 0 ? 1 : 0;
      }
      if (lever === "likeSimilar") hit = isSimilar(shop, likedSeeds) ? 1 : 0;
      if (lever === "followSimilar") hit = isSimilar(shop, followSeeds) ? 1 : 0;
      if (lever === "fresh") {
        const key = sinceKey(shop.since);
        const age = key ? nowKey - key : 99;
        hit = age >= 0 && age <= 4 ? 1 : 0;
      }
      if (hit) value += weight + Math.min(hit, 12);
    });
    if (input.referred && shop.slug === input.referred) value += 1;
    const boost = shop.plan === "premium" ? 30 : shop.plan === "grow" ? 20 : shop.plan === "basic" ? 10 : 0;
    return value + boost;
  };
  return [...shops]
    .filter((shop) => !shopMuted(shop, input.mutedWords, input.mutedStalls))
    .sort((a, b) => score(b) - score(a) || (b.views ?? 0) - (a.views ?? 0));
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
    const times = input.counts[shop.slug] ?? 1;
    const category = CATEGORY_WORDS[shop.category];
    if (category) add(input.ar ? category[1] : category[0], times);
    for (const word of shop.keywords ?? []) add(word, times);
  }
  const best = [...tally.entries()]
    .filter((entry) => entry[1] >= 2)
    .sort((a, b) => b[1] - a[1] || Number(/[\u0600-\u06FF]/.test(b[0]) === input.ar) - Number(/[\u0600-\u06FF]/.test(a[0]) === input.ar))[0];
  return best?.[0] ?? "";
}
