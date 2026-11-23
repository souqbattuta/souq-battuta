import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/feeds/google-merchant.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { renderMerchantFeed } = await import("@/lib/public-catalog");
          return renderMerchantFeed();
        } catch (error) {
          console.error("[merchant-feed]", error);
          return new Response("feed unavailable", { status: 503 });
        }
      },
    },
  },
});
