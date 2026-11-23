import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getPublicShop } from "@/lib/souq-sync";
import { keepLang, pageLangOf } from "@/lib/site";
import { shopHead } from "@/lib/shop-head";
import { PublicShopPage, MissingShop } from "@/components/shop-page";

export const Route = createFileRoute("/shop/$slug/i/$itemId")({
  validateSearch: (search: Record<string, unknown>) => keepLang(search),
  loader: async ({ params }) => {
    const res = await getPublicShop({ data: { slug: params.slug } });
    if ("redirect" in res && res.redirect) {
      throw redirect({ to: "/shop/$slug/i/$itemId", params: { slug: res.redirect, itemId: params.itemId }, statusCode: 301 });
    }
    const item = res.shop?.products.find((product) => product.id === params.itemId);
    if (!res.shop || !item) throw notFound();
    return { shop: res.shop, indexable: res.indexable, item };
  },
  head: ({ loaderData, match }): { meta?: any; links?: any } => {
    if (!loaderData?.shop || !loaderData.item) return { meta: [{ title: "Item | Souq Battuta" }, { name: "robots", content: "noindex, nofollow" }] };
    return shopHead(loaderData.shop, pageLangOf(match.search), loaderData.indexable, loaderData.item);
  },
  component: ItemRoute,
  notFoundComponent: MissingShop,
});

function ItemRoute() {
  const data = Route.useLoaderData();
  if (!data?.shop || !data.item) return <MissingShop />;
  return <PublicShopPage shop={data.shop} focusId={data.item.id} />;
}
