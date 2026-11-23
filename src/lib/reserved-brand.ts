const BRAND_LETTER: Record<string, string> = {
  ا: "a", أ: "a", إ: "a", آ: "a", ٱ: "a", ء: "", ئ: "i", ؤ: "o",
  ب: "b", ت: "t", ث: "t", ج: "j", ح: "h", خ: "h",
  د: "d", ذ: "d", ر: "r", ز: "z", س: "s", ش: "s", ص: "s", ض: "d",
  ط: "t", ظ: "z", ع: "a", غ: "g", ف: "f", ق: "q", ك: "k", ل: "l",
  م: "m", ن: "n", ه: "h", ة: "a", و: "o", ى: "a", ي: "i",
};

const WHOLE_SOURCES = ["battuta", "بطوطة", "بطوطه", "souqbattuta", "sooqbattuta", "سوق بطوطة", "سوق بطوطه"];
const ROLE_SOURCES = ["official", "admin", "staff", "support", "الرسمي", "رسمي", "rasmi", "alrasmi", "al-rasmi"];

let wholeBrands: Set<string> | null = null;
let roleWords: string[] | null = null;
let brandWithRole: Set<string> | null = null;

/** Case-insensitive key for username uniqueness. Trims and collapses spaces. */
export function usernameKey(name: unknown) {
  return String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function skeletons(name: string) {
  let raw = name.trim().toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/\u0640/g, "");
  raw = raw
    .replace(/[0٠]/g, "o")
    .replace(/[3٣]/g, "e")
    .replace(/[4٤]/g, "a")
    .replace(/[5٥]/g, "s")
    .replace(/[7٧]/g, "t");
  let folded = "";
  for (const ch of raw) {
    if (ch === "1" || ch === "١") folded += "1";
    else folded += BRAND_LETTER[ch] ?? ch;
  }
  const collapsed = folded.replace(/[^a-z1]/g, "").replace(/(.)\1+/g, "$1");
  const ones = collapsed.split("1").length - 1;
  const seeds = ones === 0 ? [collapsed] : ones > 12 ? [collapsed.replaceAll("1", "i"), collapsed.replaceAll("1", "l")] : expandOnes(collapsed);
  return seeds.map((value) => value.replace(/(.)\1+/g, "$1"));
}

function expandOnes(collapsed: string) {
  let out = [""];
  for (const ch of collapsed) {
    if (ch !== "1") {
      out = out.map((prefix) => prefix + ch);
      continue;
    }
    const next: string[] = [];
    for (const prefix of out) next.push(prefix + "i", prefix + "l");
    out = next;
  }
  return out;
}

function brands() {
  if (!wholeBrands) wholeBrands = new Set(WHOLE_SOURCES.flatMap((name) => skeletons(name)));
  return wholeBrands;
}

function roles() {
  if (!roleWords) {
    roleWords = [...new Set(ROLE_SOURCES.flatMap((name) => skeletons(name)).filter(Boolean))].sort((a, b) => b.length - a.length);
  }
  return roleWords;
}

function composed() {
  if (!brandWithRole) {
    const out = new Set<string>();
    for (const brand of WHOLE_SOURCES) {
      for (const role of ROLE_SOURCES) {
        for (const joined of [`${brand} ${role}`, `${role} ${brand}`, `${brand}${role}`, `${role}${brand}`]) {
          for (const skeleton of skeletons(joined)) out.add(skeleton);
        }
      }
    }
    brandWithRole = out;
  }
  return brandWithRole;
}

function reservedSkeleton(skeleton: string) {
  if (!skeleton) return false;
  const hasSouq = /s[ou]{1,2}[qk]/.test(skeleton);
  const hasBattuta = /b[aou]?t[ou]{0,2}t[aeiouh]{0,2}/.test(skeleton);
  if (hasSouq && hasBattuta) return true;
  if (brands().has(skeleton)) return true;
  if (composed().has(skeleton)) return true;
  let rest = skeleton;
  let peeled = false;
  for (let n = 0; n < 8; n += 1) {
    const hit = roles().find((word) => rest.startsWith(word) || rest.endsWith(word));
    if (!hit) break;
    peeled = true;
    rest = rest.startsWith(hit) ? rest.slice(hit.length) : rest.slice(0, -hit.length);
  }
  return peeled && brands().has(rest);
}

/** True when the name is the Souq Battuta brand or a lookalike. */
export function isReservedBrand(name: unknown) {
  const text = String(name ?? "").trim();
  if (!text) return false;
  return skeletons(text).some((skeleton) => reservedSkeleton(skeleton));
}

type Queryable = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

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

function heldFlag(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
}

/**
 * Find shops already using a reserved username, display name, shop name, or slug.
 * Does not delete accounts or shops. Marks the shop so public lists can hide it.
 * Returns held 0 when nothing matches.
 */
export async function sweepReservedShops(sql: Queryable) {
  const rows = await sql.query<{
    slug: string;
    name: string | null;
    name_hold: boolean | string | null;
    shop_slug: string | null;
    data: unknown;
  }>(
    `select s.slug, s.name, s.name_hold, a.shop_slug, a.data
     from souq_shops s
     join souq_accounts a on a.phone = s.owner_phone`,
  );
  let held = 0;
  for (const row of rows) {
    const data = asData(row.data);
    const bad = [data.username, data.displayName, data.shopName, row.shop_slug, row.slug, row.name].some((value) => isReservedBrand(value));
    if (bad) held += 1;
    if (heldFlag(row.name_hold) === bad) continue;
    await sql.query(`update souq_shops set name_hold = $2 where slug = $1`, [row.slug, bad]);
  }
  return { checked: rows.length, held };
}
