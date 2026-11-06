import assert from "node:assert/strict";
import test from "node:test";
import { helloFailCopy, helloLive } from "./hello.ts";
import { checkPromo } from "./promo-codes.ts";
import { allowTestOtp } from "./runtime-flags.ts";
import { journeyHint } from "./shelves.ts";
import type { Shop } from "./data.ts";

function shop(slug: string, category = "food"): Shop {
  return {
    slug,
    name: slug,
    nameAr: slug,
    area: "Amman",
    areaAr: "عمّان",
    category: category as Shop["category"],
    plan: "free",
    phone: "",
    avatar: "/brand/shops/knafeh.jpg",
    products: [],
    mode: "inquire",
    km: 1,
    keywords: ["maqluba"],
  };
}

test("424242 is local-only and never follows an empty project id", () => {
  assert.equal(allowTestOtp({ SOUQ_ALLOW_TEST_OTP: "1", NODE_ENV: "development" }), true);
  assert.equal(allowTestOtp({ SOUQ_ALLOW_TEST_OTP: "1", NODE_ENV: "production" }), false);
  assert.equal(allowTestOtp({ NODE_ENV: "development" }), false);
  assert.equal(allowTestOtp({ GROK_PROJECT_ID: "", NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
});

test("an unknown promo is rejected", () => {
  const promo = checkPromo("NOT-A-CODE", []);
  assert.equal(promo.ok, false);
  if (!promo.ok) assert.equal(promo.error, "unknown");
});

test("one visit to two food shops does not invent a food habit", () => {
  const hint = journeyHint([shop("a"), shop("b")], {
    recent: ["a", "b"],
    counts: { a: 1, b: 1 },
    interest: [],
    dismissed: [],
    ar: false,
  });
  assert.equal(hint, "");
});

test("two visits to one shop can suggest its word", () => {
  const hint = journeyHint([shop("a")], {
    recent: ["a"],
    counts: { a: 2 },
    interest: [],
    dismissed: [],
    ar: false,
  });
  assert.ok(hint === "food" || hint === "maqluba");
});

test("a Hello World post ends 24 hours after publish, not at midnight", () => {
  const at = Date.parse("2026-11-06T22:30:00+03:00");
  const post = { id: "hw", shopSlug: "s", text: "hi", lang: "en" as const, image: "/a.jpg", at, views: 0 };
  assert.equal(helloLive(post, at + 23 * 60 * 60 * 1000), true);
  assert.equal(helloLive(post, at + 25 * 60 * 60 * 1000), false);
});

test("a server failure is not described as a missing photo", () => {
  assert.match(helloFailCopy("timeout", false), /allowance was not used/);
  assert.match(helloFailCopy("server", false), /allowance was not used/);
  assert.equal(helloFailCopy("name", false), "Add a line and a photo.");
});
