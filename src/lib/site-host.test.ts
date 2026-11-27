import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import test from "node:test";
import {
  canonicalUrl,
  configuredSiteUrl,
  currentSiteUrl,
  homeJsonLd,
  languageLinks,
  legacyRedirect,
  LEGACY_HOST,
  pageRobots,
  renderRobots,
  shareMeta,
  sitemapLocs,
  storeJsonLd,
  withSiteOrigin,
} from "./site.ts";

const als = new AsyncLocalStorage<string>();
(globalThis as typeof globalThis & { __souqSiteOrigin?: { run<T>(origin: string, fn: () => T): T; get(): string } }).__souqSiteOrigin = {
  run: (origin, fn) => als.run(origin, fn),
  get: () => als.getStore() || "",
};

const PREVIEW = "https://wave-sage-hill-pepper.grok.me";

function previewRequest(path: string) {
  return new Request(`${PREVIEW}${path}`, {
    headers: { host: "wave-sage-hill-pepper.grok.me", "x-forwarded-proto": "https" },
  });
}

test("an unset SITE_URL stays on the preview host and asks Google not to index", async () => {
  const prev = process.env.SITE_URL;
  delete process.env.SITE_URL;
  try {
    assert.equal(configuredSiteUrl(), "");
    const req = previewRequest("/home");
    assert.equal(currentSiteUrl(req), PREVIEW);
    assert.equal(legacyRedirect(LEGACY_HOST, "/home", ""), "");
    assert.equal(legacyRedirect(LEGACY_HOST, "/privacy", "?lang=ar"), "");
    const seen = withSiteOrigin(PREVIEW, () => {
      const canonical = canonicalUrl("/home");
      const privacy = canonicalUrl("/privacy");
      const og = shareMeta("Home", "Wander", canonical, "/brand/duck-mark.png").find((item) => item.property === "og:url")?.content;
      const langs = languageLinks("/privacy").map((item) => item.href);
      const json = JSON.stringify(homeJsonLd());
      return { canonical, privacy, og, langs, json };
    });
    assert.equal(seen.canonical, `${PREVIEW}/home`);
    assert.equal(seen.privacy, `${PREVIEW}/privacy`);
    assert.equal(seen.og, `${PREVIEW}/home`);
    assert.deepEqual(seen.langs, [PREVIEW + "/privacy", PREVIEW + "/privacy?lang=ar", PREVIEW + "/privacy"]);
    assert.equal(seen.json.includes(PREVIEW), true);
    assert.equal(seen.json.includes("souqbattuta.com"), false);
    assert.equal(pageRobots("/home"), "noindex, nofollow");
    assert.equal(pageRobots("/privacy"), "noindex, nofollow");
    assert.equal(pageRobots("/buyer/test"), "noindex, nofollow");
    const robots = await renderRobots(req).text();
    assert.match(robots, new RegExp(`Sitemap: ${PREVIEW}/sitemap.xml`));
    assert.match(robots, /Disallow: \/buyer/);
    assert.equal(robots.includes("souqbattuta.com"), false);
    const locs = sitemapLocs(PREVIEW, [
      { slug: "namoshop", updated_at: "2026-11-01" },
      { slug: "stall-795636663", updated_at: "2026-11-01" },
    ], [
      { id: "bread", shop_slug: "namoshop", created_at: "2026-11-02" },
      { id: "old", shop_slug: "stall-795636663", created_at: "2026-11-02" },
    ]).map((item) => item.loc);
    assert.equal(locs.includes(`${PREVIEW}/shop/namoshop`), true);
    assert.equal(locs.some((loc) => loc.includes("stall-795636663")), false);
    assert.equal(locs.some((loc) => loc.includes("souqbattuta.com")), false);
  } finally {
    if (prev === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prev;
  }
});

test("SITE_URL points public tags at that host and 301s only the preview", () => {
  const prev = process.env.SITE_URL;
  process.env.SITE_URL = "https://souqbattuta.com";
  try {
    assert.equal(configuredSiteUrl(), "https://souqbattuta.com");
    assert.equal(canonicalUrl("/home"), "https://souqbattuta.com/home");
    assert.equal(canonicalUrl("/privacy", "ar"), "https://souqbattuta.com/privacy?lang=ar");
    assert.equal(currentSiteUrl(previewRequest("/home")), "https://souqbattuta.com");
    assert.equal(pageRobots("/home"), "index, follow");
    assert.equal(pageRobots("/privacy"), "index, follow");
    assert.equal(pageRobots("/buyer/test"), "noindex, nofollow");
    assert.equal(pageRobots("/seller"), "noindex, nofollow");
    assert.equal(pageRobots("/otp"), "noindex, nofollow");
    assert.equal(pageRobots("/shop/namoshop", false), "noindex, nofollow");
    assert.equal(legacyRedirect(LEGACY_HOST, "/home", ""), "https://souqbattuta.com/home");
    assert.equal(legacyRedirect(LEGACY_HOST, "/s/namoshop", "?lang=ar"), "https://souqbattuta.com/shop/namoshop?lang=ar");
    assert.equal(legacyRedirect("souqbattuta.com", "/home", ""), "");
    assert.equal(legacyRedirect("example.com", "/home", ""), "");
    const store = storeJsonLd({ name: "Namo", slug: "namo", area: "Jabal Amman" });
    const packed = JSON.stringify(store);
    assert.equal(packed.includes("phone"), false);
    assert.equal(packed.includes("street"), false);
    assert.equal(packed.includes("latitude"), false);
    assert.equal(store.address.addressLocality, "Jabal Amman");
    assert.equal(store.url, "https://souqbattuta.com/shop/namo");
  } finally {
    if (prev === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prev;
  }
});

test("the index header is not forced on every path", () => {
  const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  const headers = JSON.stringify(vercel.headers);
  assert.equal(headers.includes("index, follow"), false);
  const vite = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
  assert.equal(vite.includes('setHeader("X-Robots-Tag", "index, follow")'), false);
  const start = readFileSync(new URL("../start.ts", import.meta.url), "utf8");
  assert.match(start, /legacyRedirect/);
  assert.match(start, /pageRobots\(path\)/);
  assert.equal(start.includes("DEFAULT_SITE"), false);
  assert.equal(start.includes('from "node:async_hooks"'), false);
  const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /pageRobots\(path\)/);
  const site = readFileSync(new URL("./site.ts", import.meta.url), "utf8");
  assert.equal(site.includes("DEFAULT_SITE"), false);
  assert.equal(site.includes('|| "https://souqbattuta.com"'), false);
  const catalog = readFileSync(new URL("./public-catalog.ts", import.meta.url), "utf8");
  assert.equal(catalog.includes("souqbattuta.com"), false);
  assert.match(catalog, /currentSiteUrl\(request\)/);
});
