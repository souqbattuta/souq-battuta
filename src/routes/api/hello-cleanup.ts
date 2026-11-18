import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (secret) {
    if (header !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const { sweepHelloStorage } = await import("@/lib/hello-cleanup");
    const result = await sweepHelloStorage();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[hello] cleanup failed", error);
    return new Response("cleanup failed", { status: 500 });
  }
}

export const Route = createFileRoute("/api/hello-cleanup")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
