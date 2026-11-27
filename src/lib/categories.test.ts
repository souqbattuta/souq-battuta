import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { z } from "zod";
import { CATEGORIES, LAUNCH_CATEGORY_IDS, SELLER_CATEGORY_IDS, isCategoryId, isSellerCategory } from "./data.ts";
import { searchLiveShops } from "./public-search.ts";
import { categorySearchText, hasWord } from "./shelves.ts";
import { sitemapLocs, PUBLIC_CATEGORIES } from "./site.ts";
import { queryTokens } from "./synonyms.ts";

const ORDER = ["food", "handicrafts", "jewelry", "farmers-market", "beauty", "clothes", "pets", "misc"] as const;

function idsIn(source: string, marker: string) {
  const at = source.indexOf(marker);
  assert.ok(at >= 0, marker);
  const slice = source.slice(at, at + 500);
  return [...slice.matchAll(/"([a-z-]+)"/g)].map((hit) => hit[1]);
}

test("Pets sits before Misc, and Misc is last before All", () => {
  assert.deepEqual([...SELLER_CATEGORY_IDS], [...ORDER]);
  assert.deepEqual(LAUNCH_CATEGORY_IDS, [...SELLER_CATEGORY_IDS]);
  assert.deepEqual(CATEGORIES.map((item) => item.id), [...ORDER, "all"]);
  assert.deepEqual(PUBLIC_CATEGORIES.map((item) => item.id), [...ORDER]);
  const pets = CATEGORIES.find((item) => item.id === "pets");
  assert.ok(pets);
  assert.equal(pets.en, "For your Pets");
  assert.equal(pets.ar, "للحيوانات الأليفة");
  assert.equal(pets.icon, "/brand/icons/icon-pets.jpg");
  assert.equal(existsSync(join(process.cwd(), "public/brand/icons/icon-pets.jpg")), true);
  const publicPets = PUBLIC_CATEGORIES.find((item) => item.id === "pets");
  assert.equal(publicPets?.en, "For your Pets");
  assert.equal(publicPets?.ar, "للحيوانات الأليفة");
  assert.equal(CATEGORIES.filter((item) => item.id === "all").length, 1);

  const shelf = readFileSync(new URL("../components/shop-shelf.tsx", import.meta.url), "utf8");
  assert.deepEqual(idsIn(shelf, "const CAT_IDS"), [...ORDER, "all"]);
  const client = readFileSync(new URL("../components/souq-sync.tsx", import.meta.url), "utf8");
  assert.match(client, /new Set<string>\(LAUNCH_CATEGORY_IDS\)/);
  assert.equal(client.includes('new Set(["food"'), false);
  const server = readFileSync(new URL("./souq-sync.ts", import.meta.url), "utf8");
  assert.match(server, /const SELLER_CAT = z\.enum\(SELLER_CATEGORY_IDS\)/);
  const joinForm = readFileSync(new URL("../components/join-form.tsx", import.meta.url), "utf8");
  assert.match(joinForm, /LAUNCH_CATEGORY_IDS\.includes\(category\.id\)/);
  const session = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
  assert.match(session, /return isCategoryId\(id\) \? id : null/);
  const catalog = readFileSync(new URL("./public-catalog.ts", import.meta.url), "utf8");
  assert.match(catalog, /isSellerCategory\(row\.category\)/);
  const locs = sitemapLocs("https://souqbattuta.com", [], []).map((item) => item.loc);
  assert.ok(locs.includes("https://souqbattuta.com/category/pets"));
  for (let i = 0; i < ORDER.length; i += 1) {
    assert.ok(locs.indexOf(`https://souqbattuta.com/category/${ORDER[i]}`) > (i === 0 ? -1 : locs.indexOf(`https://souqbattuta.com/category/${ORDER[i - 1]}`)));
  }
});

test("a saved pets aisle stays pets, and old unknown aisles stay off", () => {
  assert.equal(isSellerCategory("pets"), true);
  assert.equal(isCategoryId("pets"), true);
  for (const old of ["crafts", "plants", "vehicles", "homes", "bazaar", "home", "services"]) {
    assert.equal(isCategoryId(old), false);
    assert.equal(isSellerCategory(old), false);
  }
  const signup = z.object({ categories: z.array(z.enum(SELLER_CATEGORY_IDS)).max(2) }).strict();
  assert.deepEqual(signup.parse({ categories: ["pets"] }).categories, ["pets"]);
  assert.deepEqual(signup.parse({ categories: ["food", "pets"] }).categories, ["food", "pets"]);
  assert.throws(() => signup.parse({ categories: ["crafts"] }));
  assert.throws(() => signup.parse({ categories: ["pets", "food", "misc"] }));

  function shown(stored: string) {
    const parsed = isCategoryId(stored) ? stored : null;
    return {
      category: parsed && parsed !== "all" ? parsed : "misc",
      offAisle: !parsed || parsed === "all",
      stored,
    };
  }
  assert.deepEqual(shown("pets"), { category: "pets", offAisle: false, stored: "pets" });
  assert.equal(shown("crafts").offAisle, true);
  assert.equal(shown("crafts").stored, "crafts");
  assert.notEqual(shown("crafts").category, "pets");
});

test("cat food and أكل قطط find a Pets shop from the category words", async () => {
  const text = categorySearchText("pets");
  for (const query of ["cat food", "أكل قطط"]) {
    const tokens = queryTokens(query);
    assert.ok(tokens.length >= 2, query);
    assert.ok(tokens.every((token) => hasWord(text, token)), `${query} ${tokens.join(",")}`);
  }
  assert.equal(queryTokens("cat food").every((token) => hasWord(categorySearchText("food"), token)), false);

  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((item) => item.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(dir, name), "utf8"));
  }
  const sql = {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query(text, params)).rows as T[],
  };
  const chosen = z.array(z.enum(SELLER_CATEGORY_IDS)).max(2).parse(["pets"]);
  await sql.query(
    `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan)
     values ($1, '', 'x', $2::jsonb, false, true, 'seller', 'paw-stall', 'basic')`,
    ["+962791111111", JSON.stringify({ username: "paw", whatsappPhone: "+962791111111", categories: chosen })],
  );
  await sql.query(
    `insert into souq_shops (slug, owner_phone, name, area, plan, category, keywords, bio, publishable, hidden, demo)
     values ('paw-stall', $1, 'Paw stall', 'Amman', 'basic', $2, '[]'::jsonb, 'Leashes', true, false, false)`,
    ["+962791111111", chosen[0] ?? ""],
  );
  await sql.query(
    `insert into souq_listings (id, shop_slug, owner_phone, name, body)
     values ('leash', 'paw-stall', $1, 'Leash', '{"nameAr":"مقود"}'::jsonb)`,
    ["+962791111111"],
  );
  await sql.query(
    `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan)
     values ('+962792222222', '', 'x', '{"username":"oven","whatsappPhone":"+962792222222","categories":["food"]}'::jsonb, false, true, 'seller', 'oven-stall', 'basic')`,
  );
  await sql.query(
    `insert into souq_shops (slug, owner_phone, name, area, plan, category, keywords, bio, publishable, hidden, demo)
     values ('oven-stall', '+962792222222', 'Oven stall', 'Amman', 'basic', 'food', '[]'::jsonb, 'Bread', true, false, false)`,
  );
  await sql.query(
    `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan)
     values ('+962793333333', '', 'x', '{"username":"oldcraft","whatsappPhone":"+962793333333","categories":["crafts"]}'::jsonb, false, true, 'seller', 'craft-stall', 'basic')`,
  );
  await sql.query(
    `insert into souq_shops (slug, owner_phone, name, area, plan, category, keywords, bio, publishable, hidden, demo)
     values ('craft-stall', '+962793333333', 'Old craft', 'Amman', 'basic', 'crafts', '[]'::jsonb, 'Wood', true, false, false)`,
  );

  const saved = await sql.query<{ category: string; categories: string[] }>(
    `select s.category, a.data->'categories' as categories from souq_shops s join souq_accounts a on a.phone = s.owner_phone where s.slug = 'paw-stall'`,
  );
  assert.equal(saved[0]?.category, "pets");
  assert.deepEqual(saved[0]?.categories, ["pets"]);
  const kept = await sql.query<{ category: string }>(`select category from souq_shops where slug = 'craft-stall'`);
  assert.equal(kept[0]?.category, "crafts");

  for (const query of ["cat food", "أكل قطط"]) {
    const found = await searchLiveShops(sql, { query });
    assert.deepEqual(found.map((item) => item.slug), ["paw-stall"], query);
    assert.equal(JSON.stringify(found).includes("+962"), false);
  }
});

test("phone category labels stay whole at 320, 375 and 390", async () => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const serif = readFileSync(join(process.cwd(), "node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff2")).toString("base64");
    const naskh = readFileSync(join(process.cwd(), "node_modules/@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff2")).toString("base64");
    let css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    css = css.replace(/@import[^;]+;\s*/, "").replace("@theme {", ":root {");
    const faces = `@font-face{font-family:"Source Serif 4";src:url(data:font/woff2;base64,${serif}) format("woff2");font-weight:700;font-style:normal}@font-face{font-family:"Noto Naskh Arabic";src:url(data:font/woff2;base64,${naskh}) format("woff2");font-weight:700;font-style:normal}`;
    const tiles = CATEGORIES.map((item) => {
      return `<a class="home-cat" data-id="${item.id}" href="/category/${item.id}"><span class="home-cat-frame"></span><span class="home-cat-copy"><b>${item.en}</b><span class="font-arabic">${item.ar}</span></span></a>`;
    }).join("");
    const tilesAr = CATEGORIES.map((item) => {
      return `<a class="home-cat" data-id="${item.id}" href="/category/${item.id}"><span class="home-cat-frame"></span><span class="home-cat-copy"><b class="font-arabic">${item.ar}</b><span>${item.en}</span></span></a>`;
    }).join("");
    for (const width of [320, 375, 390, 1280]) {
      for (const dir of ["ltr", "rtl"] as const) {
        await page.setViewportSize({ width, height: 800 });
        await page.setContent(`<!doctype html><html dir="${dir}"><head><style>${faces}${css}</style></head><body style="margin:0"><div class="home-cats-wrap"><div class="cat-rail"><div class="home-cats">${dir === "rtl" ? tilesAr : tiles}</div></div></div></body></html>`, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        const report = await page.evaluate(() => {
          const cats = [...document.querySelectorAll<HTMLElement>(".home-cat")];
          const boxes = cats.map((el) => el.getBoundingClientRect());
          let overlap = false;
          for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
              const a = boxes[i];
              const b = boxes[j];
              const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (x > 1 && y > 1) overlap = true;
            }
          }
          const clipped: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>(".home-cat-copy b, .home-cat-copy > span")) {
            if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 4) clipped.push(el.textContent || "");
          }
          const pets = document.querySelector<HTMLElement>('.home-cat[data-id="pets"] .home-cat-copy b');
          const english = document.querySelector<HTMLElement>('.home-cat[data-id="pets"] .home-cat-copy :not(.font-arabic)');
          const label = pets?.textContent || "";
          const transform = pets ? getComputedStyle(pets).textTransform : "";
          const englishText = english?.textContent || "";
          const englishTransform = english ? getComputedStyle(english).textTransform : "";
          const spill = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          return { overlap, clipped, label, transform, englishText, englishTransform, spill, count: cats.length };
        });
        assert.equal(report.count, 9, `${dir} ${width}`);
        assert.equal(report.overlap, false, `${dir} ${width}`);
        assert.deepEqual(report.clipped, [], `${dir} ${width} ${report.clipped.join("|")}`);
        assert.ok(report.spill <= 1, `${dir} ${width} spill ${report.spill}`);
        if (dir === "ltr") assert.equal(report.label, "For your Pets");
        else assert.equal(report.label, "للحيوانات الأليفة");
        assert.equal(report.englishText, "For your Pets");
        assert.equal(report.englishTransform, "none");
      }
    }
  } finally {
    await browser.close();
  }
});
