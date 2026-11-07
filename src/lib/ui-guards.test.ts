import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { photoControlName } from "./photo-label.ts";
import { productMatches, sectionsWithMatches } from "./shop-search.ts";
import { buyerVisibleShops, isDemoShop } from "./shelves.ts";

const item = (name: string, nameAr = name) => ({
  name,
  nameAr,
  desc: "A cloth leash",
  descAr: "مقود",
  group: "Dogs",
  groupAr: "كلاب",
});

test("privacy route imports Shell and keeps the existing policy", () => {
  const source = readFileSync(new URL("../routes/privacy.tsx", import.meta.url), "utf8");
  assert.match(source, /import \{ Shell \} from "@\/components\/site-header"/);
  assert.match(source, /<Shell>/);
  assert.match(source, /How we contact you/);
  assert.match(source, /كيف منراسلك/);
  assert.doesNotMatch(source, /Privacy Policy is being reviewed/);
});

test("the error boundary offers Back home and Try again", () => {
  const source = readFileSync(new URL("./error-component.tsx", import.meta.url), "utf8");
  assert.match(source, /Back home/);
  assert.match(source, /Try again/);
  assert.match(source, /reset\(\)/);
  assert.match(source, /to="\/home"/);
});

test("photo controls name the seller and the item", () => {
  assert.equal(photoControlName("en", "Paw Leather", "Cloth leash"), "View Paw Leather Cloth leash photos");
  assert.equal(photoControlName("ar", "جلد الكف", "مقود"), "عرض صور جلد الكف مقود");
  assert.equal(photoControlName("en", "Paw Leather"), "View Paw Leather photos");
});

test("an item search with no matches hides empty groups and can be cleared by matching everything", () => {
  const sections = [
    { key: "dogs", title: "Dogs", titleAr: "كلاب", items: [item("Cloth leash", "مقود قماش")] },
    { key: "birds", title: "Birds", titleAr: "طيور", items: [item("Seed bag", "كيس حب")] },
  ];
  assert.deepEqual(sectionsWithMatches(sections, "zzzz-no-such-item"), []);
  assert.equal(productMatches(item("Cloth leash"), "leash"), true);
  assert.equal(productMatches(item("Cloth leash"), "LEASH"), true);
  assert.equal(productMatches(item("Party tray"), "art"), true);
  const restored = sectionsWithMatches(sections, "");
  assert.equal(restored.length, 2);
  assert.equal(restored[0].items.length, 1);
  assert.equal(restored[1].items.length, 1);
});

test("the public footer hides Test List outside production", () => {
  const source = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.match(source, /!import\.meta\.env\.PROD && \([\s\S]*Test List/);
  assert.match(source, /قائمة التجربة/);
});

test("public catalogs drop an explicit demo flag and keep a real shop named Test", () => {
  const demo = { slug: "paper-stall", name: "Paper Stall", demo: true };
  const named = { slug: "latest-test-batch", name: "Latest test batch", nameAr: "تجربة حقيقية" };
  const real = { slug: "paw-leather", name: "Paw Leather" };
  assert.equal(isDemoShop(demo), true);
  assert.equal(isDemoShop(named), false);
  assert.equal(isDemoShop({ ...named, hidden: true }), false);
  const production = buyerVisibleShops([demo, named, real], true).map((shop) => shop.slug);
  assert.deepEqual(production, ["latest-test-batch", "paw-leather"]);
  const preview = buyerVisibleShops([demo, named, real], false).map((shop) => shop.slug);
  assert.deepEqual(preview, ["paper-stall", "latest-test-batch", "paw-leather"]);
});
