import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { HelloFeed } from "@/components/hello-board";
import { Shell } from "@/components/site-header";

type HelloTab = "for-you" | "recent" | "viewed";

function asTab(value: unknown): HelloTab {
  if (value === "recent" || value === "viewed") return value;
  return "for-you";
}

export const Route = createFileRoute("/hello")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: asTab(search.tab),
    at: typeof search.at === "string" ? search.at.replace(/^@/, "") : "",
    post: typeof search.post === "string" ? search.post : "",
  }),
  search: { middlewares: [stripSearchParams({ tab: "for-you", at: "", post: "" })] },
  component: HelloPage,
});

function HelloPage() {
  const { tab, at, post } = Route.useSearch();
  return (
    <Shell>
      <main className="px-4 py-6 sm:px-8">
        <HelloFeed tab={tab} at={at} post={post} />
      </main>
    </Shell>
  );
}
