import assert from "node:assert/strict";
import test from "node:test";
import { shopSlugCandidate, shopSlugSeed, shopSlugWithSuffix } from "./shop-slug.ts";
import { slugHasPhone } from "./site.ts";

test("shop slugs come from the name, not a phone", () => {
  assert.equal(shopSlugCandidate("Hala Kitchen"), "hala-kitchen");
  assert.equal(shopSlugCandidate("  Hala   Kitchen! "), "hala-kitchen");
  assert.equal(shopSlugCandidate("مطبخ هالة"), "مطبخ-هالة");
  assert.equal(shopSlugSeed("Souq Battuta", "Hala Kitchen"), "hala-kitchen");
  assert.equal(shopSlugCandidate("Souq Battuta"), "");
  assert.equal(shopSlugCandidate("سوق بطوطة"), "");
  assert.equal(shopSlugCandidate("stall-795636663"), "stall");
  assert.equal(slugHasPhone(shopSlugCandidate("stall-795636663")), false);
  assert.equal(shopSlugCandidate("123456789"), "");
  assert.equal(shopSlugCandidate("ab"), "");
  assert.equal(shopSlugCandidate("Cafe 24"), "cafe-24");
  const phoneName = shopSlugCandidate("Hala 0791234567");
  assert.equal(phoneName, "hala");
  assert.equal(slugHasPhone(phoneName), false);
  assert.equal(/\d{7,}/.test(phoneName), false);
});

test("a taken slug gets a letter suffix, not phone digits", () => {
  const slug = shopSlugWithSuffix("hala-kitchen", "krmp");
  assert.equal(slug, "hala-kitchen-krmp");
  assert.equal(slugHasPhone(slug), false);
  assert.match(slug, /^hala-kitchen-[a-z]+$/);
  assert.equal(slug.length <= 40, true);
  const long = shopSlugWithSuffix("a".repeat(40), "wxyz");
  assert.equal(long.length <= 40, true);
  assert.equal(long.endsWith("-wxyz"), true);
  assert.equal(slugHasPhone(long), false);
});

test("an old stall- phone address moves and redirects", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { assignShopSlug, lookupSlugRedirect, sweepPhoneSlugs } = await import("./shop-slug.ts");
  const pg = new PGlite();
  await pg.waitReady;
  const dir = join(process.cwd(), "migrations");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) await pg.exec(await readFile(join(dir, name), "utf8"));
  const phone = "+962795636663";
  const old = "stall-795636663";
  await pg.query(
    `insert into souq_accounts (phone, secret, data, role, shop_slug, phone_verified)
     values ($1, '', $2::jsonb, 'seller', $3, true)`,
    [phone, JSON.stringify({ username: "hala", displayName: "Hala Kitchen", shopName: "Hala Kitchen" }), old],
  );
  await pg.query(
    `insert into souq_shops (slug, owner_phone, name, publishable, name_hold) values ($1, $2, 'Hala Kitchen', true, true)`,
    [old, phone],
  );
  await pg.query(`insert into souq_listings (id, shop_slug, owner_phone, name) values ('item-1', $1, $2, 'Bread')`, [old, phone]);
  const sql = {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query(text, params)).rows as T[],
  };
  const moved = await sweepPhoneSlugs(sql);
  assert.equal(moved.checked, 1);
  assert.equal(moved.moved, 1);
  const shops = await sql.query<{ slug: string; name_hold: boolean }>(`select slug, name_hold from souq_shops`);
  assert.equal(shops[0]?.slug, "hala-kitchen");
  assert.equal(shops[0]?.name_hold, true);
  assert.equal(slugHasPhone(shops[0]?.slug ?? ""), false);
  assert.equal(await lookupSlugRedirect(sql, old), "hala-kitchen");
  const accounts = await sql.query<{ shop_slug: string }>(`select shop_slug from souq_accounts`);
  assert.equal(accounts[0]?.shop_slug, "hala-kitchen");
  const listings = await sql.query<{ shop_slug: string }>(`select shop_slug from souq_listings`);
  assert.equal(listings[0]?.shop_slug, "hala-kitchen");
  const again = await sweepPhoneSlugs(sql);
  assert.equal(again.moved, 0);
  await pg.transaction(async (tx) => {
    const txsql = {
      query: async <T>(text: string, params: unknown[] = []) => (await tx.query(text, params)).rows as T[],
    };
    const slug = await assignShopSlug(txsql, ["Hala Kitchen"]);
    assert.notEqual(slug, "hala-kitchen");
    assert.match(slug, /^hala-kitchen-[a-z]+$/);
    assert.equal(slugHasPhone(slug), false);
    assert.equal(/795636663/.test(slug), false);
  });
});

