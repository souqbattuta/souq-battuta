import type { PlanId, Shop } from "./data";
import { shopText } from "./shelves";

export type HelloPost = {
  id: string;
  shopSlug: string;
  text: string;
  lang: "en" | "ar";
  image: string;
  at: number;
  views: number;
  reported?: boolean;
  hearts?: number;
};

export type HelloHandle = {
  handle: string;
  name: string;
  note: string;
  at: number;
};

export const HELLO_CAP: Record<PlanId, number> = { free: 0, basic: 2, grow: 3, premium: 5 };

export function ammanDay(ts = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date(ts));
}

export function toHandle(name: string) {
  const body = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const clean = word.replace(/[^a-z0-9]/gi, "");
      if (!clean) return "";
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    })
    .join("");
  return body ? `@${body}` : "";
}

export function billedLength(text: string, handles: string[]) {
  const live = new Set(handles.map((handle) => handle.toLowerCase()));
  let free = 0;
  for (const match of text.matchAll(/@[A-Za-z0-9]+/g)) {
    if (live.has(match[0].toLowerCase())) free += match[0].length;
  }
  return text.length - free;
}

export function normalizeHandles(text: string, handles: string[]) {
  const byLower = new Map(handles.map((handle) => [handle.toLowerCase(), handle]));
  return text.replace(/@[A-Za-z0-9]+/g, (token) => byLower.get(token.toLowerCase()) ?? token);
}

export function suggestHandles(text: string, handles: string[]) {
  const match = text.match(/(^|\s)(@[A-Za-z0-9]*)$/);
  if (!match) return [];
  const token = match[2].toLowerCase();
  if (token === "@") return handles.slice(0, 6);
  return handles.filter((handle) => handle.toLowerCase().startsWith(token) && handle.toLowerCase() !== token).slice(0, 6);
}

export type HelloPart = { text: string; handle?: string };

export function splitHandles(text: string, handles: string[]): HelloPart[] {
  const live = new Map(handles.map((handle) => [handle.toLowerCase(), handle]));
  const parts: HelloPart[] = [];
  const re = /@[A-Za-z0-9]+/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const official = live.get(match[0].toLowerCase());
    parts.push(official ? { text: official, handle: official } : { text: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

export function postsToday(posts: HelloPost[], now = Date.now()) {
  const day = ammanDay(now);
  return posts.filter((post) => ammanDay(post.at) === day);
}

export const SAMPLE_HANDLES: HelloHandle[] = [
  {
    handle: "@Jara",
    name: "Jara",
    note: "A Friday row of stalls in Jabal Amman. This page lists who wrote @Jara today.",
    at: 0,
  },
];

export function sampleHello(now = Date.now()): HelloPost[] {
  const rows: Omit<HelloPost, "at">[] = [
    { id: "hw-sample-knafeh", shopSlug: "ahlan-bakery", text: "Knafeh tray is out. Warm until four.", lang: "en", image: "/brand/shops/knafeh-tray.jpg", views: 48, hearts: 6 },
    { id: "hw-sample-maqluba", shopSlug: "namos-kitchen", text: "المقلوبة جاهزة للتوصيل.", lang: "ar", image: "/brand/shops/maqluba.jpg", views: 91, hearts: 14 },
    { id: "hw-sample-runner", shopSlug: "beit-al-tiraz", text: "A new runner is on the table. Come see the stitch.", lang: "en", image: "/brand/shops/tiraz-cloth.jpg", views: 22, hearts: 3 },
    { id: "hw-sample-sage", shopSlug: "wildroot-plantae", text: "Sage is ready to take home.", lang: "en", image: "/brand/shops/plants.jpg", views: 17, hearts: 2 },
    { id: "hw-sample-kaak", shopSlug: "salt-kaak", text: "كعك السمسم طالع من الطابون.", lang: "ar", image: "/brand/shops/bread.jpg", views: 63, hearts: 9 },
    { id: "hw-sample-olive", shopSlug: "green-oasis", text: "Two courtyard olives left.", lang: "en", image: "/brand/shops/bonsai.jpg", views: 31, hearts: 4 },
    { id: "hw-sample-linen", shopSlug: "weibdeh-thread", text: "Unbleached linen shirts. @Jara today.", lang: "en", image: "/brand/shops/hanging.jpg", views: 54, hearts: 7 },
    { id: "hw-sample-cups", shopSlug: "alchemist-clay", text: "فناجين القهوة على الدولاب اليوم.", lang: "ar", image: "/brand/shops/mug.jpg", views: 12, hearts: 1 },
    { id: "hw-sample-rose", shopSlug: "balad-bloom", text: "Rose oil, small bottles on the counter.", lang: "en", image: "/brand/shops/beauty.jpg", views: 27, hearts: 5 },
  ];
  return rows.map((row, index) => ({ ...row, at: now - (index + 1) * 18 * 60 * 1000 }));
}

export function boardPosts(accounts: { helloPosts?: HelloPost[] }[], now = Date.now()) {
  const live = postsToday(accounts.flatMap((account) => account.helloPosts ?? []), now);
  const ids = new Set(live.map((post) => post.id));
  return [...live, ...sampleHello(now).filter((post) => !ids.has(post.id))];
}

export function boardHandles(handles: HelloHandle[]) {
  const have = new Set(handles.map((item) => item.handle.toLowerCase()));
  return [...handles, ...SAMPLE_HANDLES.filter((item) => !have.has(item.handle.toLowerCase()))];
}

export function homeHello(posts: HelloPost[], follows: string[]) {
  const latest = new Map<string, HelloPost>();
  for (const post of [...posts].sort((a, b) => b.at - a.at)) {
    if (!latest.has(post.shopSlug)) latest.set(post.shopSlug, post);
  }
  return [...latest.values()]
    .sort((a, b) => Number(follows.includes(b.shopSlug)) - Number(follows.includes(a.shopSlug)) || b.at - a.at)
    .slice(0, 6);
}

export function rankHello(
  posts: HelloPost[],
  input: { words: string[]; follows: string[]; pageLikes: string[]; helloHearts: string[]; shops: Shop[] },
) {
  const hasSignal = input.words.length > 0 || input.follows.length > 0 || input.pageLikes.length > 0;
  if (!hasSignal) return [...posts].sort((a, b) => b.at - a.at);
  const bySlug = new Map(input.shops.map((shop) => [shop.slug, shop]));
  const score = (post: HelloPost) => {
    const shop = bySlug.get(post.shopSlug);
    let value = 0;
    if (input.follows.includes(post.shopSlug)) value += 5;
    if (input.pageLikes.includes(post.shopSlug)) value += 3;
    if (input.helloHearts.includes(post.id)) value += 1;
    if (shop && input.words.some((word) => shopText(shop).includes(word.toLowerCase()))) value += 4;
    return value;
  };
  return [...posts].sort((a, b) => score(b) - score(a) || b.at - a.at);
}
