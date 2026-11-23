import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { renderRobots } = await import("@/lib/public-catalog");
        return renderRobots();
      },
    },
  },
});
