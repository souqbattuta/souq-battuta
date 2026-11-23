import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { copy } from "./i18n.ts";
import {
  allowPhotoUpload,
  allowReport,
  allowReviewWrite,
  deleteBuyerReview,
  fileReport,
  reviewAuthorName,
  writeBuyerReview,
} from "./abuse.ts";

test("review, photo, and report limits use the bilingual lines", () => {
  assert.equal(copy.en.reviewHold, "You can review a shop after an order is marked done. Please try again later if you have already sent several reviews.");
  assert.match(copy.ar.reviewHold, /تقدر تقيّم المحل/);
  assert.equal(copy.en.photoRate, "Too many photos, try again later · صور كثيرة، جرّب لاحقاً.");
  assert.equal(copy.en.reportRate, "Too many reports, try again later · بلاغات كثيرة، جرّب لاحقاً.");
  const source = readFileSync(new URL("./souq-sync.ts", import.meta.url), "utf8");
  const review = source.slice(source.indexOf("export const saveSouqReview"), source.indexOf("export const deleteSouqReview"));
  assert.equal(review.includes("data.authorName"), false);
  assert.match(review, /reviewAuthorName/);
});

function counter() {
  const hits = new Map<string, number>();
  return async (bucket: string, limit: number) => {
    const next = (hits.get(bucket) ?? 0) + 1;
    hits.set(bucket, next);
    return next <= limit;
  };
}

test("the eleventh review write for one buyer is refused", async () => {
  const hit = counter();
  const phone = "+962795636663";
  for (let n = 0; n < 10; n += 1) assert.equal(await allowReviewWrite(hit, `203.0.113.${n}`, phone), true);
  assert.equal(await allowReviewWrite(hit, "203.0.113.99", phone), false);
});

test("photo uploads stop at 30 an hour and 80 a day", async () => {
  const buckets = new Map<string, { hits: number; start: number }>();
  let now = 0;
  const hit = async (bucket: string, limit: number, windowSeconds: number) => {
    const row = buckets.get(bucket);
    if (!row || now - row.start >= windowSeconds) {
      buckets.set(bucket, { hits: 1, start: now });
      return true;
    }
    row.hits += 1;
    return row.hits <= limit;
  };
  const phone = "+962790000000";
  for (let n = 0; n < 30; n += 1) assert.equal(await allowPhotoUpload(hit, phone), true);
  assert.equal(await allowPhotoUpload(hit, phone), false);
  now += 3600;
  for (let n = 0; n < 30; n += 1) assert.equal(await allowPhotoUpload(hit, phone), true);
  now += 3600;
  for (let n = 0; n < 20; n += 1) assert.equal(await allowPhotoUpload(hit, phone), true);
  assert.equal(await allowPhotoUpload(hit, phone), false);
});

test("the sixth report from one account is refused", async () => {
  const hit = counter();
  const phone = "+962791111111";
  for (let n = 0; n < 5; n += 1) assert.equal(await allowReport(hit, "198.51.100.8", phone), true);
  assert.equal(await allowReport(hit, "198.51.100.8", phone), false);
});

test("a buyer reviews only after a done order, under their own name, and only they can delete it", async () => {
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
  const buyer = "+962795555555";
  const other = "+962796666666";
  await sql.query(`insert into souq_shops (slug, owner_phone, name, plan) values ('hala-kitchen', '+962790000001', 'Hala Kitchen', 'pro')`);
  await sql.query(
    `insert into souq_orders (id, shop_slug, buyer_phone, status, product_name) values ('o-1', 'hala-kitchen', $1, 'new', 'Bread')`,
    [buyer],
  );
  const blocked = await writeBuyerReview(sql, {
    phone: buyer,
    shopSlug: "hala-kitchen",
    score: 5,
    comment: "Good",
    authorName: reviewAuthorName({ displayName: "Hala", username: "hala" }),
    area: "Jabal Amman",
    id: "r-1",
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error, "order");
  await sql.query(`update souq_orders set status = 'done' where id = 'o-1'`);
  const saved = await writeBuyerReview(sql, {
    phone: buyer,
    shopSlug: "hala-kitchen",
    score: 5,
    comment: "Good bread",
    authorName: reviewAuthorName({ displayName: "Hala", username: "hala" }),
    area: "Jabal Amman",
    id: "r-1",
  });
  assert.equal(saved.ok, true);
  const rows = await sql.query<{ id: string; author_name: string }>(`select id, author_name from souq_reviews`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.author_name, "Hala");
  assert.notEqual(rows[0]?.author_name, "Alias Person");
  const again = await writeBuyerReview(sql, {
    phone: buyer,
    shopSlug: "hala-kitchen",
    score: 4,
    comment: "Still good",
    authorName: "Hala",
    area: "Jabal Amman",
    id: "r-2",
  });
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.id, "r-1");
  const after = await sql.query<{ n: number; review_count: number }>(
    `select (select count(*)::int from souq_reviews) as n, review_count from souq_views where shop_slug = 'hala-kitchen'`,
  );
  assert.equal(after[0]?.n, 1);
  assert.equal(after[0]?.review_count, 1);
  const stranger = await deleteBuyerReview(sql, "r-1", other);
  assert.equal(stranger.ok, false);
  assert.equal((await sql.query(`select id from souq_reviews`)).length, 1);
  const removed = await deleteBuyerReview(sql, "r-1", buyer);
  assert.equal(removed.ok, true);
  assert.equal((await sql.query(`select id from souq_reviews`)).length, 0);
  const views = await sql.query<{ review_count: number }>(`select review_count from souq_views where shop_slug = 'hala-kitchen'`);
  assert.equal(views[0]?.review_count, 0);

  await sql.query(`insert into souq_shops (slug, owner_phone, name) values ('shop-a', '+962790000002', 'A')`);
  for (const phone of ["+962791000001", "+962791000002", "+962791000003"]) {
    await fileReport(sql, { id: `rp-${phone}`, targetType: "shop", targetId: "shop-a", phone, reason: "shop" });
  }
  const hidden = await sql.query<{ hidden: boolean }>(`select hidden from souq_shops where slug = 'shop-a'`);
  assert.equal(hidden[0]?.hidden, true);
  const reports = await sql.query(`select id from souq_reports where target_id = 'shop-a'`);
  assert.equal(reports.length, 3);
});
