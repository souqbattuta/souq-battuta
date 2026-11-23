import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { renderSitemap } = await import("@/lib/public-catalog");
          return renderSitemap(request);
        } catch (error) {
          console.error("[sitemap]", error);
          return new Response("sitemap unavailable", { status: 503 });
        }
      },
    },
  },
});
