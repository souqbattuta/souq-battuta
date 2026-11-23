import type { Shop } from "./data";

export type AmmanArea = { en: string; ar: string; lat: number; lng: number };

/** Neighbourhood centres. Shop pins use these, never a seller's door. */
export const AMMAN_AREAS: AmmanArea[] = [
  { en: "Abdoun", ar: "عبدون", lat: 31.944, lng: 35.89 },
  { en: "Jabal Amman", ar: "جبل عمّان", lat: 31.9518, lng: 35.9245 },
  { en: "Jabal Al Weibdeh", ar: "جبل اللويبدة", lat: 31.9572, lng: 35.933 },
  { en: "Sweifieh", ar: "الصويفية", lat: 31.957, lng: 35.866 },
  { en: "Downtown", ar: "وسط البلد", lat: 31.9515, lng: 35.932 },
  { en: "Shmeisani", ar: "الشميساني", lat: 31.9732, lng: 35.8972 },
  { en: "Khalda", ar: "خلدا", lat: 31.995, lng: 35.838 },
  { en: "Dabouq", ar: "دابوق", lat: 32.004, lng: 35.825 },
  { en: "Marka", ar: "ماركا", lat: 31.983, lng: 36.02 },
  { en: "Jubeiha", ar: "الجبيهة", lat: 32.027, lng: 35.865 },
  { en: "Tlaa Al Ali", ar: "تلاع العلي", lat: 31.992, lng: 35.866 },
  { en: "Rabieh", ar: "الرابية", lat: 31.984, lng: 35.88 },
  { en: "Um Uthaina", ar: "أم أذينة", lat: 31.968, lng: 35.87 },
  { en: "Abdali", ar: "العبدلي", lat: 31.963, lng: 35.91 },
  { en: "Gardens", ar: "الجاردنز", lat: 31.983, lng: 35.875 },
  { en: "Sports City", ar: "المدينة الرياضية", lat: 31.986, lng: 35.905 },
  { en: "Marj Al Hamam", ar: "مرج الحمام", lat: 31.89, lng: 35.86 },
  { en: "Al Hashmi", ar: "الهاشمي", lat: 31.955, lng: 35.95 },
  { en: "Jabal Al Hussein", ar: "جبل الحسين", lat: 31.968, lng: 35.92 },
];

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
  shmeisani: [31.9732, 35.8972],
  "al shmeisani": [31.9732, 35.8972],
  jubeiha: [32.027, 35.865],
  "tlaa al ali": [31.992, 35.866],
  rabieh: [31.984, 35.88],
  "um uthaina": [31.968, 35.87],
  abdali: [31.963, 35.91],
  gardens: [31.983, 35.875],
  "sports city": [31.986, 35.905],
  "marj al hamam": [31.89, 35.86],
  "al hashmi": [31.955, 35.95],
  "jabal al hussein": [31.968, 35.92],
  amman: [31.9539, 35.9106],
  zarqa: [32.0608, 36.0942],
};

export function areaLabel(area: AmmanArea, ar: boolean) {
  return ar ? `${area.ar} · ${area.en}, Amman` : `${area.en}, Amman`;
}

export function matchAreas(query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return AMMAN_AREAS.filter((area) => area.en.toLowerCase().includes(q) || area.ar.includes(query.trim()));
}

export function nearestArea(lat: number, lng: number) {
  let best: AmmanArea | null = null;
  let bestKm = Infinity;
  for (const area of AMMAN_AREAS) {
    const km = kmBetween({ lat, lng }, { lat: area.lat, lng: area.lng });
    if (km < bestKm) {
      best = area;
      bestKm = km;
    }
  }
  return best && bestKm <= 2.5 ? best : null;
}

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

/** xoshiro128** from a 128-bit seed. Returns a float in [0, 1). */
export function xoshiro128(seed: Uint32Array) {
  let a = seed[0] >>> 0 || 1;
  let b = seed[1] >>> 0;
  let c = seed[2] >>> 0;
  let d = seed[3] >>> 0;
  const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
  return () => {
    const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return result / 4294967296;
  };
}

export function cryptoSeed() {
  const seed = new Uint32Array(4);
  crypto.getRandomValues(seed);
  if ((seed[0] | seed[1] | seed[2] | seed[3]) === 0) seed[0] = 1;
  return seed;
}

function unbiased(next: () => number, limit: number) {
  if (limit <= 1) return 0;
  const bound = Math.floor(0x100000000 / limit) * limit;
  let roll = 0;
  do {
    roll = Math.floor(next() * 0x100000000);
  } while (roll >= bound);
  return roll % limit;
}

/** Fisher–Yates. The list you pass is copied; the original is left alone. */
export function shuffled<T>(list: T[], seed: Uint32Array) {
  const next = xoshiro128(seed);
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = unbiased(next, i + 1);
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}
