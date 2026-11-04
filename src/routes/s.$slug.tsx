import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/s/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/shop/$slug", params: { slug: params.slug } });
  },
});
