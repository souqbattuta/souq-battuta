import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { foldText } from "./fold-text.ts";
import { copy } from "./i18n.ts";
import { compareNear } from "./near.ts";
import { searchLiveShops } from "./public-search.ts";
import { hasWord } from "./shelves.ts";
import { MATCH_SYNONYMS } from "./synonyms.ts";

test("folding strips tatweel and harakat, and knafeh spellings match", () => {
  assert.equal(foldText("كُنَافَة"), "كنافه");
  assert.equal(foldText("كنـافة"), "كنافه");
  assert.equal(foldText("كنافة"), foldText("كنافه"));
  assert.equal(hasWord("صينية كنافة", "knafeh"), true);
  assert.equal(hasWord("صينية كنافة", "kunafa"), true);
  assert.equal(hasWord("صينية كنافة", "كنافة"), true);
  assert.equal(hasWord("a party on the roof", "art"), false);
  const knafeh = MATCH_SYNONYMS[0];
  assert.ok(knafeh.includes("knafeh") && knafeh.includes("kunafeh") && knafeh.includes("kunafa") && knafeh.includes("konafa"));
  assert.ok(knafeh.includes("كنافة") && knafeh.includes("كنافه"));
});

test("near ties under 0.05 km use plan, and a real gap stays distance first", () => {
  assert.ok(compareNear({ km: 1.04, plan: "premium" }, { km: 1, plan: "basic" }) < 0);
  assert.ok(compareNear({ km: 1, plan: "basic" }, { km: 1.2, plan: "premium" }) < 0);
  assert.ok(compareNear({ km: 1, plan: "basic" }, { km: 1.05, plan: "premium" }) < 0);
});

test("Discover calls the server search and does not sort by plan first", () => {
  assert.equal(copy.en.searchBusy, "Searching…");
  assert.equal(copy.ar.searchBusy, "جاري البحث…");
  assert.equal(copy.en.searchEmpty, "No shops match that search.");
  assert.equal(copy.ar.searchEmpty, "ما في دكاكين تطابق هذا البحث.");
  const page = readFileSync(new URL("../routes/discover.tsx", import.meta.url), "utf8");
  assert.match(page, /searchPublicShops/);
  assert.match(page, /t\.searchBusy/);
  assert.match(page, /t\.searchEmpty/);
  assert.equal(page.includes("browseNudge"), false);
  assert.equal(page.includes("<h2"), false);
  const sync = readFileSync(new URL("./souq-sync.ts", import.meta.url), "utf8");
  const search = sync.slice(sync.indexOf("export const searchPublicShops"), sync.indexOf("export const listHello"));
  assert.match(search, /sessionPhone/);
  assert.match(search, /if \(phone\)/);
  assert.match(search, /readAlgo/);
  assert.match(search, /searchLiveShops/);
  assert.equal(search.includes("buyer_phone"), false);
  assert.equal(search.includes("console."), false);
});

test("search finds a shop past the first 20, folds knafeh, and ranks the buyer before the plan", async () => {
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
  const body = JSON.stringify({ nameAr: "كنافة", desc: "Cheese tray", descAr: "صينية" });
  async function shop(slug: string, phone: string, plan: string, item: string, flags: { hidden?: boolean; demo?: boolean; publishable?: boolean; old?: boolean }) {
    await sql.query(
      `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan)
       values ($1, '', 'x', $2::jsonb, false, true, 'seller', $3, $4)`,
      [phone, JSON.stringify({ username: slug, whatsappPhone: phone }), slug, plan],
    );
    await sql.query(
      `insert into souq_shops (slug, owner_phone, name, area, plan, category, keywords, bio, publishable, hidden, demo, created_at)
       values ($1, $2, $3, 'Amman', $4, 'food', '[]'::jsonb, '', $5, $6, $7, ${flags.old ? "now() - interval '40 days'" : "now()"})`,
      [slug, phone, slug, plan, flags.publishable !== false, flags.hidden === true, flags.demo === true],
    );
    await sql.query(
      `insert into souq_listings (id, shop_slug, owner_phone, name, body)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [`item-${slug}`, slug, phone, item, item === "كنافة" ? body : JSON.stringify({ nameAr: "صابون" })],
    );
  }
  for (let i = 1; i <= 20; i += 1) {
    const phone = `+96279${String(i).padStart(7, "0")}`;
    await shop(`filler-${i}`, phone, "basic", "Soap", {});
  }
  await shop("old-stall", "+962790000099", "basic", "كنافة", { old: true });
  await shop("basic-oven", "+962790000088", "basic", "كنافة", {});
  await shop("premium-oven", "+962790000077", "premium", "كنافة", {});
  await shop("hidden-stall", "+962790000066", "premium", "كنافة", { hidden: true });
  await shop("demo-stall", "+962790000055", "premium", "كنافة", { demo: true });
  await shop("quiet-stall", "+962790000044", "premium", "كنافة", { publishable: false });

  const page = await sql.query<{ slug: string }>(
    `select s.slug from souq_shops s
     join souq_accounts a on a.phone = s.owner_phone
     where s.hidden = false and s.demo = false and s.publishable = true
       and a.data->>'whatsappPhone' ~ '^\\+9627[789][0-9]{7}$'
     order by s.created_at desc
     limit 20`,
  );
  assert.equal(page.some((row) => row.slug === "old-stall"), false);

  for (const word of ["knafeh", "kunafa", "كنافة"]) {
    const found = await searchLiveShops(sql, { query: word });
    assert.ok(found.some((item) => item.slug === "old-stall"), word);
    assert.equal(found[0]?.slug, "premium-oven", word);
  }
  const followed = await searchLiveShops(sql, { query: "knafeh", follows: ["basic-oven"] });
  assert.equal(followed[0]?.slug, "basic-oven");
  assert.ok(followed.findIndex((item) => item.slug === "premium-oven") > 0);
  const slugs = new Set(followed.map((item) => item.slug));
  assert.equal(slugs.has("hidden-stall"), false);
  assert.equal(slugs.has("demo-stall"), false);
  assert.equal(slugs.has("quiet-stall"), false);
  const blob = JSON.stringify(followed);
  assert.equal(blob.includes("+962"), false);
  assert.equal(blob.includes("whatsappPhone"), false);
  assert.equal(blob.includes("buyer_phone"), false);
  for (const shop of followed) {
    assert.equal(shop.hasWhatsapp, true);
    assert.equal("phone" in shop, false);
    assert.equal("owner_phone" in shop, false);
  }
});

test("Discover search lines do not overflow a phone", async () => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const rules = css.slice(css.lastIndexOf(".discover-page"));
    for (const width of [360, 390]) {
      for (const dir of ["ltr", "rtl"] as const) {
        await page.setViewportSize({ width, height: 800 });
        await page.setContent(`<!doctype html><html dir="${dir}" lang="${dir === "rtl" ? "ar" : "en"}"><head><style>
          html,body{margin:0}
          ${rules}
        </style></head><body><main class="discover-page" style="padding:1rem">
          <h1>${dir === "rtl" ? "السوق" : "The Souq"}</h1>
          <form><input value="${dir === "rtl" ? "كنافة" : "knafeh"}" style="width:100%;height:48px"></form>
          <p class="discover-note">${dir === "rtl" ? "جاري البحث…" : "Searching…"}</p>
          <p class="discover-note">${dir === "rtl" ? "ما في دكاكين تطابق هذا البحث." : "No shops match that search."}</p>
          <ul class="discover-list"><li><a>Basic oven · كنافة نابلسية بجبنة من جبل عمّان</a></li></ul>
        </main></body></html>`);
        const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(spill <= 1, `${dir} ${width} ${spill}`);
      }
    }
  } finally {
    await browser.close();
  }
});
