import { createFileRoute, notFound, Outlet, redirect, useChildMatches } from "@tanstack/react-router";
import { getPublicShop } from "@/lib/souq-sync";
import { keepLang, pageLangOf } from "@/lib/site";
import { shopHead } from "@/lib/shop-head";
import { PublicShopPage, MissingShop } from "@/components/shop-page";

export const Route = createFileRoute("/shop/$slug")({
  validateSearch: (search: Record<string, unknown>) => keepLang(search),
  loader: async ({ params }) => {
    const res = await getPublicShop({ data: { slug: params.slug } });
    if ("redirect" in res && res.redirect) throw redirect({ to: "/shop/$slug", params: { slug: res.redirect }, statusCode: 301 });
    if (!res.shop) throw notFound();
    return res;
  },
  head: ({ loaderData, match, matches }): { meta?: any; links?: any } => {
    const leaf = matches[matches.length - 1];
    if (leaf && leaf.pathname !== match.pathname) return { meta: [], links: [] };
    if (!loaderData?.shop) return { meta: [{ title: "Shop | Souq Battuta" }, { name: "robots", content: "noindex, nofollow" }] };
    return shopHead(loaderData.shop, pageLangOf(match.search), loaderData.indexable);
  },
  component: ShopRoute,
  notFoundComponent: MissingShop,
});

function ShopRoute() {
  const child = useChildMatches();
  if (child.length > 0) return <Outlet />;
  const data = Route.useLoaderData();
  if (!data?.shop) return <MissingShop />;
  return <PublicShopPage shop={data.shop} />;
}
