import { createMiddleware, createStart } from "@tanstack/react-start";
import { currentSiteUrl, legacyRedirect, pageRobots, requestHostName, slugHasPhone, withSiteOrigin } from "@/lib/site";

type SiteBox = { run<T>(origin: string, fn: () => T): T; get(): string };

function siteGlobal() {
  return globalThis as typeof globalThis & { __souqSiteOrigin?: SiteBox };
}

async function installOrigin() {
  const holder = siteGlobal();
  if (holder.__souqSiteOrigin) return;
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const als = new AsyncLocalStorage<string>();
  holder.__souqSiteOrigin = {
    run: (origin, fn) => als.run(origin, fn),
    get: () => als.getStore() || "",
  };
}

async function movedShopUrl(pathname: string, search: string, origin: string) {
  const match = pathname.match(/^\/(?:shop|s)\/([^/]+)(\/.*)?$/);
  if (!match || !origin) return "";
  let slug = match[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* keep the raw segment */
  }
  if (!slugHasPhone(slug)) return "";
  try {
    const { getSql } = await import("@/lib/db");
    const { lookupSlugRedirect } = await import("@/lib/shop-slug");
    const next = await lookupSlugRedirect(await getSql(), slug);
    if (!next) return "";
    return `${origin}/shop/${encodeURIComponent(next)}${match[2] || ""}${search}`;
  } catch {
    return "";
  }
}

const seoHost = createMiddleware({ type: "request" }).server(async ({ request, next, pathname }) => {
  await installOrigin();
  const url = new URL(request.url);
  const path = pathname || url.pathname;
  const host = requestHostName(request);
  const origin = currentSiteUrl(request);
  if (request.method === "GET" || request.method === "HEAD") {
    const moved = await movedShopUrl(path, url.search, origin);
    if (moved) return new Response(null, { status: 301, headers: { location: moved } });
  }
  const jump = legacyRedirect(host, path, url.search);
  if (jump) return new Response(null, { status: 301, headers: { location: jump } });

  if ((request.method === "GET" || request.method === "HEAD") && path.startsWith("/@")) {
    const handle = decodeURIComponent(path.slice(2).split("/")[0] || "");
    if (handle && !/\d{7,}/.test(handle) && origin) {
      try {
        const { slugForHandle } = await import("@/lib/public-catalog");
        const slug = await slugForHandle(handle);
        if (slug) {
          return new Response(null, {
            status: 301,
            headers: { location: `${origin}/shop/${encodeURIComponent(slug)}${url.search}` },
          });
        }
      } catch {
        /* unknown handle falls through */
      }
    }
  }

  return withSiteOrigin(origin, async () => {
    const result = await next();
    result.response?.headers.set("X-Robots-Tag", pageRobots(path));
    return result;
  });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [seoHost],
}));
