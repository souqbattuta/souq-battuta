import { createMiddleware, createStart } from "@tanstack/react-start";
import { LEGACY_HOST, SITE_URL } from "@/lib/site";

function hostName(request: Request) {
  const raw = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  return raw.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

function samePath(pathname: string) {
  const short = pathname.match(/^\/s\/([^/]+)\/?$/);
  if (short) return `/shop/${short[1]}`;
  return pathname;
}

const seoHost = createMiddleware({ type: "request" }).server(async ({ request, next, pathname }) => {
  const url = new URL(request.url);
  const host = hostName(request);
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
