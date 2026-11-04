import { useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CATEGORIES, type CategoryId, type Shop } from "@/lib/data";
import { directoryShops, useSession } from "@/lib/session";
import { rankForYou, shopMuted } from "@/lib/shelves";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { CategoryRail, ShopShelf } from "@/components/shop-shelf";
import { HelloStrip } from "@/components/hello-board";
import { NearPanel } from "@/components/near-panel";
import { DrawDeck } from "@/components/draw-deck";
import { OptImg } from "@/components/opt-img";

export const Route = createFileRoute("/category/$id")({ component: CategoryPage });

const MONTH: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function sinceStamp(since?: string) {
  if (!since) return 0;
  const year = Number(since.match(/20\d{2}/)?.[0] ?? 0);
  const month = MONTH[since.toLowerCase().slice(0, 3)] ?? 0;
  return year * 12 + month;
}

function CategoryPage() {
  const { id } = Route.useParams();
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
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
  const waTaps = useSession((s) => s.waTaps) ?? {};
  const ensureDirectory = useSession((s) => s.ensureDirectory);
  useEffect(() => {
    ensureDirectory();
  }, [ensureDirectory]);
  const cat = CATEGORIES.find((item) => item.id === id) ?? CATEGORIES.find((item) => item.id === "all")!;
  const catalog = useMemo(() => directoryShops(accounts), [accounts]);
  const shops = useMemo(
    () => catalog.filter((shop) => cat.id === "all" || shop.category === (cat.id as CategoryId)),
    [catalog, cat.id],
  );
  const orderScore = (shop: Shop) => (shop.waOrders ?? 0) + (waTaps[shop.slug] ?? 0);
  const liked = useMemo(
    () => rankForYou(shops, { words, favorites, bookmarks, visited, visits, follows, ordered: orderSlugs, shared, order: algo, referred: user?.referredBy, mutedWords, mutedStalls }),
    [shops, words, favorites, bookmarks, visited, visits, follows, orderSlugs, shared, algo, user?.referredBy, mutedWords, mutedStalls],
  );
  const newest = useMemo(() => [...shops].sort((a, b) => sinceStamp(b.since) - sinceStamp(a.since)), [shops]);
  const asked = useMemo(
    () => shops.filter((shop) => orderScore(shop) > 0).sort((a, b) => orderScore(b) - orderScore(a)),
    [shops, waTaps],
  );
  const name = ar ? cat.ar : cat.en;
  const other = ar ? cat.en : cat.ar;
  const more = { aisle: cat.id };

  return (
    <Shell>
      <main className="home">
        <section className="home-section">
          <div className="home-head">
            <div className="flex items-center gap-4">
              <OptImg src={cat.icon} alt="" className="size-16 rounded-2xl object-cover" eager sizes="128px" />
              <div>
                <p className="home-eyebrow">{ar ? "قسم" : "Aisle"}</p>
                <h1 className="font-display text-4xl">{name}</h1>
                <p className="home-shelf-note">{other} · {shops.length}</p>
              </div>
            </div>
          </div>
          <CategoryRail ar={ar} active={cat.id} />
        </section>

        <HelloStrip shops={shops} />

        <section className="home-section home-shelf" aria-labelledby="cat-for-you">
          <div className="home-head home-head-rule">
            <div>
              <p className="home-eyebrow home-kicker">{ar ? "مختار" : "Curated"}</p>
              <h2 id="cat-for-you">{ar ? "إلك" : "For You"}</h2>
              <p className="home-shelf-note">{ar ? "أماكن مختارة إلك" : "Places chosen for you"}</p>
              {user?.role === "seller" ? null : user ? (
                <Link to="/account" search={{ tab: "", note: "" }} className="home-algo-link">
                  {ar ? "إذا ما عجبك اللي بتشوفه، غيّر الخوارزمية" : "If you don't like what you see, change the algorithm"}
                </Link>
              ) : (
                <Link to="/sign-in" search={{ next: "/account" }} className="home-algo-link">
                  {ar ? "إذا ما عجبك اللي بتشوفه، غيّر الخوارزمية" : "If you don't like what you see, change the algorithm"}
                </Link>
              )}
            </div>
          </div>
          {words.length > 0 && <p className="home-note">{t.forYouWords}: {words.join(", ")}</p>}
          {liked.length === 0 ? (
            <p className="home-note">{ar ? "ما في دكاكين بهالقسم بعد." : "No stalls in this aisle yet."}</p>
          ) : (
            <ShopShelf id={`cat-${cat.id}-for-you`} shops={liked} ar={ar} windowed={cat.id === "all" || cat.id === "food"} />
          )}
          <Link to="/shelf" search={{ kind: "for-you", ...more }} className="shelf-more">
            <span aria-hidden="true">{ar ? "المزيد" : "More"}</span>
            <span className="sr-only">{ar ? `المزيد من الأماكن المختارة في ${name}` : `More places chosen for you in ${name}`}</span>
          </Link>
        </section>

        {newest.length > 0 && (
          <section className="home-section home-shelf" aria-labelledby="cat-new">
            <div className="home-head home-head-rule">
              <div>
                <p className="home-eyebrow home-kicker">{ar ? "الأحدث" : "Newest"}</p>
                <h2 id="cat-new">{ar ? "أماكن جديدة" : "New Places"}</h2>
                <p className="home-shelf-note">{ar ? "آخر الدكاكين" : "The latest stalls"}</p>
              </div>
            </div>
            <ShopShelf id={`cat-${cat.id}-new`} shops={newest} ar={ar} windowed={cat.id === "all" || cat.id === "food"} />
            <Link to="/shelf" search={{ kind: "new", ...more }} className="shelf-more">
              <span aria-hidden="true">{ar ? "المزيد" : "More"}</span>
              <span className="sr-only">{ar ? `المزيد من الأماكن الجديدة في ${name}` : `More new places in ${name}`}</span>
            </Link>
          </section>
        )}

        {asked.length > 0 && (
          <section className="home-section home-shelf" aria-labelledby="cat-asked">
            <div className="home-head home-head-rule">
              <div>
                <p className="home-eyebrow home-kicker">{ar ? "شعبية" : "Popular"}</p>
                <h2 id="cat-asked">{ar ? "الأكثر شعبية" : "Most Popular"}</h2>
              </div>
            </div>
            <ShopShelf id={`cat-${cat.id}-asked`} shops={asked} ar={ar} windowed={cat.id === "all" || cat.id === "food"} />
            <Link to="/shelf" search={{ kind: "asked", ...more }} className="shelf-more">
              <span aria-hidden="true">{ar ? "المزيد" : "More"}</span>
              <span className="sr-only">{ar ? `المزيد من الأكثر شعبية في ${name}` : `More most popular stalls in ${name}`}</span>
            </Link>
          </section>
        )}

        <section className="home-section home-shelf" aria-labelledby="cat-near">
          <div className="home-head home-head-rule">
            <div>
              <p className="home-eyebrow home-kicker">{ar ? "المسافة" : "Distance"}</p>
              <h2 id="cat-near">{ar ? "بالقرب" : "Near By"}</h2>
              <p className="home-shelf-note">{ar ? "من عنوانك، أو من مكان تثبّته الآن" : "From your address, or a place you pin now"}</p>
            </div>
          </div>
          <NearPanel shelf={`cat-${cat.id}-near`} shops={shops} ar={ar} windowed={cat.id === "all" || cat.id === "food"} />
        </section>

        <section className="home-section home-shelf" aria-labelledby="cat-random">
          <div className="home-head home-head-rule">
            <div>
              <p className="home-eyebrow home-kicker">{ar ? "اخلط" : "Shuffle"}</p>
              <h2 id="cat-random">{ar ? "عشوائي" : "Random"}</h2>
              <p className="home-shelf-note">{ar ? "بلا خوارزمية - جرّب حظك" : "No Algorithm - try your luck"}</p>
            </div>
          </div>
          <DrawDeck shops={shops.filter((shop) => !shopMuted(shop, mutedWords, mutedStalls))} ar={ar} />
        </section>
      </main>
    </Shell>
  );
}
