import type { Shop } from "./data";

const AREAS: Record<string, [number, number]> = {
  "jabal amman": [31.9518, 35.9245],
  weibdeh: [31.9572, 35.933],
  "jabal al weibdeh": [31.9572, 35.933],
  sweifieh: [31.957, 35.866],
  abdoun: [31.944, 35.89],
  khalda: [31.995, 35.838],
  dabouq: [32.004, 35.825],
  marka: [31.983, 36.02],
  downtown: [31.9515, 35.932],
  amman: [31.9539, 35.9106],
  zarqa: [32.0608, 36.0942],
};

function hash(slug: string) {
  let n = 0;
  for (const char of slug) n = (n * 33 + char.charCodeAt(0)) >>> 0;
  return n;
}

/** Stall pin from its neighbourhood, spread so two stalls do not sit on one point. */
export function shopPoint(shop: Shop) {
  const base = AREAS[shop.area.toLowerCase().trim()] ?? AREAS.amman;
  const n = hash(shop.slug);
  const angle = ((n % 360) * Math.PI) / 180;
  const meters = 180 + (n % 650);
  const lat = base[0] + (meters * Math.cos(angle)) / 111320;
  const lng = base[1] + (meters * Math.sin(angle)) / (111320 * Math.cos((base[0] * Math.PI) / 180));
  return { lat, lng };
}

export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearest(shops: Shop[], origin: { lat: number; lng: number }) {
  return shops
    .map((shop) => ({ shop, km: kmBetween(origin, shopPoint(shop)) }))
    .sort((a, b) => a.km - b.km);
}

/** Equal chance. Same seed keeps the order while they scroll. */
export function shuffled<T>(list: T[], seed: number) {
  const next = [...list];
  let state = (seed % 2147483646) + 1;
  for (let i = next.length - 1; i > 0; i -= 1) {
    state = (state * 16807) % 2147483647;
    const j = state % (i + 1);
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return next;
}
