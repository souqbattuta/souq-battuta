import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CATEGORIES, type CategoryId } from "@/lib/data";
import { directoryShops, livePromotions, useSession } from "@/lib/session";
import { newPlacesShelf, rankForYou, useTieSeed } from "@/lib/shelves";
import { Shell } from "@/components/site-header";
import { PromoViewTracker, ShopTiles } from "@/components/shop-shelf";
import { OptImg } from "@/components/opt-img";

export const Route = createFileRoute("/shelf")({
  validateSearch: (search: Record<string, unknown>) => ({
    kind: search.kind === "new" || search.kind === "promos" || search.kind === "asked" || search.kind === "viewed" ? search.kind : "for-you",
    aisle: typeof search.aisle === "string" ? search.aisle : "",
  }),
  component: ShelfPage,
});

function ShelfPage() {
  const { kind, aisle } = Route.useSearch();
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
  const serverShops = useSession((s) => s.serverShops);
  const words = useSession((s) => s.interestWords);
  const favorites = useSession((s) => s.favorites);
  const bookmarks = useSession((s) => s.bookmarks);
  const mutedWords = useSession((s) => s.mutedWords ?? []);
  const mutedStalls = useSession((s) => s.mutedStalls ?? []);
  const algo = useSession((s) => s.algoOrder);
  const visited = useSession((s) => s.recentSlugs) ?? [];
  const visits = useSession((s) => s.visitCounts) ?? {};
  const follows = useSession((s) => s.follows) ?? [];
  const shared = useSession((s) => s.sharedSlugs) ?? [];
  const buyerOrders = useSession((s) => s.orders) ?? [];
  const orderSlugs = useMemo(() => [...new Set(buyerOrders.map((order) => order.shopSlug).filter(Boolean))], [buyerOrders]);
  const ensureDirectory = useSession((s) => s.ensureDirectory);
  useEffect(() => {
    ensureDirectory();
  }, [ensureDirectory]);
  const catalog = useMemo(() => {
    const all = directoryShops(accounts);
    const cat = CATEGORIES.find((item) => item.id === aisle);
    if (!cat || cat.id === "all") return all;
    return all.filter((shop) => shop.category === (cat.id as CategoryId));
  }, [accounts, aisle, serverShops]);
  const tieSeed = useTieSeed();
  const browsedCategories = useMemo(() => {
    const by = new Map(catalog.map((shop) => [shop.slug, shop.category]));
    return [...new Set(visited.map((slug) => by.get(slug)).filter((id): id is string => Boolean(id)))];
  }, [catalog, visited]);
  const forYou = useMemo(
    () => rankForYou(catalog, { words, favorites, bookmarks, visited, visits, follows, ordered: orderSlugs, shared, order: algo, referred: user?.referredBy, mutedWords, mutedStalls, tieSeed, browsedCategories }),
    [catalog, words, favorites, bookmarks, visited, visits, follows, orderSlugs, shared, algo, user?.referredBy, mutedWords, mutedStalls, tieSeed, browsedCategories],
  );
  const newest = useMemo(() => newPlacesShelf(catalog), [catalog]);
  const waTaps = useSession((s) => s.waTaps) ?? {};
  const asked = useMemo(
    () => [...catalog].filter((shop) => (shop.waOrders ?? 0) + (waTaps[shop.slug] ?? 0) > 0).sort((a, b) => ((b.waOrders ?? 0) + (waTaps[b.slug] ?? 0)) - ((a.waOrders ?? 0) + (waTaps[a.slug] ?? 0))),
    [catalog, waTaps],
  );
  const viewed = useMemo(
    () => [...catalog].filter((shop) => (shop.views ?? 0) > 0).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)),
    [catalog],
  );
  const promos = livePromotions(accounts).filter((item) => catalog.some((shop) => shop.slug === item.slug));
  const bumpPromotionClick = useSession((s) => s.bumpPromotionClick);
  const title =
    kind === "new" ? (ar ? "أماكن جديدة" : "New Places")
    : kind === "promos" ? (ar ? "الإعلانات" : "Announcements")
    : kind === "asked" ? (ar ? "الأكثر شعبية" : "Most Popular")
    : kind === "viewed" ? (ar ? "الأكثر مشاهدة" : "Most Viewed")
    : ar ? "إلك" : "For You";
  const full = kind === "new" ? newest : kind === "asked" ? asked : kind === "viewed" ? viewed : forYou;
  const [shown, setShown] = useState(20);
  const page = full.slice(0, shown);

  return (
    <Shell>
      <main className="home-section" style={{ paddingBottom: "3rem" }}>
        <div className="home-head">
          <p className="home-eyebrow">{ar ? "السوق" : "The souq"}</p>
          <h1 className="font-display text-4xl">{title}</h1>
        </div>
        {kind === "promos" ? (
          <div className="shelf-grid">
            <PromoViewTracker ids={promos.map(({ promo }) => promo.id)} />
            {promos.length === 0 && <p className="text-sm text-mute">{ar ? "ما في إعلانات هذا الشهر." : "No announcements this month."}</p>}
            {promos.map(({ promo }) => (
              <Link key={promo.id} to="/shop/$slug" params={{ slug: promo.shopSlug }} className="overflow-hidden rounded-xl border border-line bg-cream" onClick={() => bumpPromotionClick(promo.id)}>
                {promo.images?.[0] && <OptImg src={promo.images[0]} alt="" className="h-36 w-full object-cover" />}
                <span className="block p-3">
                  <p className="text-xs uppercase tracking-wide text-mute">{promo.shopName}{promo.off ? ` · ${promo.off}` : ""}</p>
                  <b className="mt-1 block font-display text-xl">{ar ? promo.titleAr : promo.title}</b>
                  <p className="mt-1 text-sm text-mute">{ar ? promo.detailAr : promo.detail}</p>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <ShopTiles shelf={`more-${kind}-${aisle}`} shops={page} ar={ar} />
            {shown < full.length && (
              <button type="button" className="shelf-more" onClick={() => setShown((n) => n + 20)}>
                {ar ? "المزيد" : "More"}
              </button>
            )}
          </>
        )}
      </main>
    </Shell>
  );
}
