import assert from "node:assert/strict";
import test from "node:test";
import type { Shop } from "./data.ts";
import { HELLO_CAP, HELLO_EDIT, HELLO_WINDOW, helloLive, rankHello } from "./hello.ts";
import { browseNudge, builtInKeywords, hasWord, newPlacesShelf, rankForYou } from "./shelves.ts";

function shop(partial: Partial<Shop> & Pick<Shop, "slug" | "plan">): Shop {
  return {
    name: partial.slug,
    nameAr: partial.slug,
    area: "Amman",
    areaAr: "عمّان",
    category: "food",
    phone: "",
    avatar: "/brand/shops/knafeh.jpg",
    products: [{ id: `${partial.slug}-p`, name: "Tray", nameAr: "صينية", price: 1, desc: "Rice tray", descAr: "رز", images: ["/brand/shops/knafeh.jpg"] }],
    mode: "inquire",
    km: 1,
    createdAt: Date.now() - 2 * 86400000,
    ...partial,
  };
}

test("whole words, not substrings, including Arabic alef", () => {
  assert.equal(hasWord("a party on the roof", "art"), false);
  assert.equal(hasWord("the art of bread", "art"), true);
  assert.equal(hasWord("أكل بيتي من إربد", "اكل"), true);
  assert.equal(hasWord("food tray", "foo"), false);
});

test("category labels are the starting keywords", () => {
  const words = builtInKeywords(["food"]);
  assert.ok(words.includes("Food"));
  assert.ok(words.includes("طعام"));
});

test("For You ignores plan; New Places does not", () => {
  const now = Date.now();
  const free = shop({ slug: "free-shop", plan: "free", keywords: ["maqluba"], createdAt: now - 5 * 86400000 });
  const premium = shop({ slug: "paid-shop", plan: "premium", keywords: ["linen"], createdAt: now - 20 * 86400000 });
  const ranked = rankForYou([premium, free], { words: ["maqluba"], favorites: [], bookmarks: [], tieSeed: 3 });
  assert.equal(ranked[0]?.slug, "free-shop");
  assert.equal(browseNudge("premium") > browseNudge("free"), true);
  const fresh = newPlacesShelf([free, premium]);
  assert.equal(fresh[0]?.slug, "paid-shop");
});

test("New Places inside For You needs a keyword, or a category the buyer actually opened", () => {
  const young = shop({ slug: "young", plan: "premium", keywords: ["soap"], category: "beauty", createdAt: Date.now() - 86400000 });
  const old = shop({ slug: "old", plan: "free", keywords: ["knafeh"], createdAt: Date.now() - 400 * 86400000 });
  const missed = rankForYou([young, old], { words: ["knafeh"], favorites: [], bookmarks: [], order: ["fresh", "words"], tieSeed: 1 });
  assert.equal(missed[0]?.slug, "old");
  const hit = rankForYou([young, old], { words: ["soap"], favorites: [], bookmarks: [], order: ["fresh", "words"], tieSeed: 1 });
  assert.equal(hit[0]?.slug, "young");
  const browsed = rankForYou([young, old], { words: [], favorites: [], bookmarks: [], order: ["fresh"], browsedCategories: ["beauty"], tieSeed: 1 });
  assert.equal(browsed[0]?.slug, "young");
});

test("Hello World ranks follows, then keywords, then time, never plan", () => {
  const now = Date.now();
  const posts = [
    { id: "a", shopSlug: "paid", text: "linen shirts", lang: "en" as const, image: "/a.jpg", at: now - 1000, views: 1 },
    { id: "b", shopSlug: "free", text: "knafeh tray", lang: "en" as const, image: "/b.jpg", at: now - 5000, views: 1 },
    { id: "c", shopSlug: "followed", text: "quiet day", lang: "en" as const, image: "/c.jpg", at: now - 9000, views: 1 },
  ];
  const shops = [
    shop({ slug: "paid", plan: "premium" }),
    shop({ slug: "free", plan: "free", keywords: ["knafeh"] }),
    shop({ slug: "followed", plan: "free" }),
  ];
  const ranked = rankHello(posts, { words: ["knafeh"], follows: ["followed"], shops });
  assert.equal(ranked[0]?.id, "c");
  assert.equal(ranked[1]?.id, "b");
  assert.equal(HELLO_CAP.free, 1);
  assert.equal(HELLO_CAP.basic, 2);
  assert.equal(HELLO_CAP.grow, 3);
  assert.equal(HELLO_CAP.premium, 5);
  assert.equal(HELLO_WINDOW, 24 * 60 * 60 * 1000);
  assert.equal(HELLO_EDIT, 15 * 60 * 1000);
  assert.equal(helloLive({ ...posts[0], at: now - HELLO_WINDOW - 1000 }), false);
  assert.equal(helloLive({ ...posts[0], status: "removed" }), false);
});
