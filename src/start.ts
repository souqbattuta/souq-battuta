import { createMiddleware, createStart } from "@tanstack/react-start";
import { LEGACY_HOST, SITE_URL, slugHasPhone } from "@/lib/site";

function hostName(request: Request) {
  const raw = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  return raw.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

function samePath(pathname: string) {
  const short = pathname.match(/^\/s\/([^/]+)\/?$/);
  if (short) return `/shop/${short[1]}`;
  return pathname;
}

async function movedShopUrl(pathname: string, search: string, origin: string) {
  const match = pathname.match(/^\/(?:shop|s)\/([^/]+)(\/.*)?$/);
  if (!match) return "";
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
  const url = new URL(request.url);
  const host = hostName(request);
  if ((request.method === "GET" || request.method === "HEAD")) {
    const moved = await movedShopUrl(pathname || url.pathname, url.search, host === LEGACY_HOST ? SITE_URL : url.origin);
    if (moved) return new Response(null, { status: 301, headers: { location: moved } });
  }
  if (host === LEGACY_HOST) {
    const dest = `${SITE_URL}${samePath(pathname || url.pathname)}${url.search}`;
    try {
      return new Response(null, { status: 301, headers: { location: dest } });
    } catch {
      const result = await next();
      result.response?.headers.set("X-Robots-Tag", "noindex, nofollow");
      result.response?.headers.set("Link", `<${dest}>; rel="canonical"`);
      return result;
    }
  }

  if ((request.method === "GET" || request.method === "HEAD") && pathname.startsWith("/@")) {
    const handle = decodeURIComponent(pathname.slice(2).split("/")[0] || "");
    if (handle && !/\d{7,}/.test(handle)) {
      try {
        const { slugForHandle } = await import("@/lib/public-catalog");
        const slug = await slugForHandle(handle);
        if (slug) {
          return new Response(null, {
            status: 301,
            headers: { location: `${SITE_URL}/shop/${encodeURIComponent(slug)}${url.search}` },
          });
        }
      } catch {
        /* unknown handle falls through */
      }
    }
  }

  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [seoHost],
}));
