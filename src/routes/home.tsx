import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { directoryShops, useSession } from "@/lib/session";
import { newPlacesShelf, rankForYou, shopMuted, useTieSeed } from "@/lib/shelves";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { CategoryRail, ShopShelf } from "@/components/shop-shelf";
import { HelloStrip } from "@/components/hello-board";
import { NearPanel } from "@/components/near-panel";
import { DrawDeck } from "@/components/draw-deck";
import { HeroFilm } from "@/components/hero-film";
import heroFilmCss from "../hero-film.css?url";

/* LOCKED section names. Do not rename unless the user says unlock sections.
   For You / إلك
   New Places / أماكن جديدة
   Most Popular / الأكثر شعبية
   Near By / بالقرب
   Random / عشوائي
*/

export const Route = createFileRoute("/home")({
  head: () => ({
    links: [
      { rel: "stylesheet", href: heroFilmCss },
      {
        rel: "preload",
        as: "image",
        href: "/brand/hero/storyboard-desktop-poster.jpg",
        type: "image/jpeg",
        media: "(min-width:761px)",
        fetchPriority: "high",
      },
      {
        rel: "preload",
        as: "image",
        href: "/brand/hero/storyboard-mobile-poster.jpg",
        type: "image/jpeg",
        media: "(max-width:760px)",
        fetchPriority: "high",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const lang = useSession((s) => s.lang);
  const user = useSession((s) => s.user);
  const t = copy[lang];
  const ar = lang === "ar";
  const [accountDeleted, setAccountDeleted] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("souq-account-deleted") === "1") {
        sessionStorage.removeItem("souq-account-deleted");
        setAccountDeleted(true);
      }
    } catch {
      /* private mode can block storage */
    }
  }, []);
  const accounts = useSession((s) => s.accounts);
  const serverShops = useSession((s) => s.serverShops);
  const ensureDirectory = useSession((s) => s.ensureDirectory);
  useEffect(() => {
    ensureDirectory();
  }, [ensureDirectory]);
  const catalog = useMemo(() => directoryShops(accounts), [accounts, serverShops]);
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
  const browsedCategories = useMemo(() => {
    const by = new Map(catalog.map((shop) => [shop.slug, shop.category]));
    return [...new Set(visited.map((slug) => by.get(slug)).filter((id): id is string => Boolean(id)))];
  }, [catalog, visited]);
  const tieSeed = useTieSeed();
  const picks = useMemo(
    () => rankForYou(catalog, { words, favorites, bookmarks, visited, visits, follows, ordered: orderSlugs, shared, order: algo, referred: user?.referredBy, mutedWords, mutedStalls, tieSeed, browsedCategories }).slice(0, 20),
    [catalog, words, favorites, bookmarks, visited, visits, follows, orderSlugs, shared, algo, user?.referredBy, mutedWords, mutedStalls, tieSeed, browsedCategories],
  );
  const newest = useMemo(() => newPlacesShelf(catalog).slice(0, 20), [catalog]);
  const waTaps = useSession((s) => s.waTaps) ?? {};
  const asked = useMemo(
    () => [...catalog].filter((shop) => (shop.waOrders ?? 0) + (waTaps[shop.slug] ?? 0) > 0).sort((a, b) => ((b.waOrders ?? 0) + (waTaps[b.slug] ?? 0)) - ((a.waOrders ?? 0) + (waTaps[a.slug] ?? 0))),
    [catalog, waTaps],
  );

  return (
    <Shell>
      <main className="home">
        <h1 className="sr-only">{ar ? "سوق بطوطة" : "Souq Battuta"}</h1>
        {accountDeleted && (
          <p className="account-deleted-note" role="status" dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"}>
            {t.accountDeleted}
          </p>
        )}
        <section className="home-hero home-story-hero" aria-label={ar ? "مين إحنا" : "Who we are"}>
          <HeroFilm />
        </section>

        <p className="mx-auto max-w-2xl px-4 py-6 text-center text-base leading-relaxed text-ink">
          <span className="block">Discover Amman’s home businesses without ads or paid boosts. You choose what you see.</span>
          <span className="mt-2 block" dir="rtl" lang="ar">اكتشف مشاريع عمّان البيتية بدون إعلانات وبدون دفع مقابل الظهور. أنت تختار ما تراه.</span>
        </p>

        <section className="home-section" aria-labelledby="home-cats">
          <div className="home-head">
            <div>
              <p className="home-eyebrow">{ar ? "تجوّل" : "Wander"}</p>
              <h2 id="home-cats">{ar ? "الأقسام" : "Categories"}</h2>
            </div>
          </div>
        </section>
        <div className="home-cats-wrap">
          <CategoryRail ar={ar} />
        </div>

        <HelloStrip shops={catalog} />

        <section className="home-section home-shelf" aria-labelledby="home-for-you">
          <div className="home-head home-head-rule">
            <div>
              <p className="home-eyebrow home-kicker">{ar ? "مختار" : "Curated"}</p>
              <h2 id="home-for-you">{ar ? "إلك" : "For You"}</h2>
              <p className="home-shelf-note">{ar ? "أماكن مختارة إلك" : "Places chosen for you"}</p>
              {user?.role === "seller" ? null : user ? (
                <Link to="/account" search={{ tab: "", note: "" }} className="home-algo-link">
                  {ar ? "إذا ما عجبك اللي بتشوفه، غيّر الكلمات" : "If you don't like what you see, change your keywords"}
                </Link>
              ) : (
                <Link to="/sign-in" search={{ next: "/account" }} className="home-algo-link">
                  {ar ? "إذا ما عجبك اللي بتشوفه، غيّر الكلمات" : "If you don't like what you see, change your keywords"}
                </Link>
              )}
            </div>
          </div>
          {words.length > 0 && <p className="home-note">{t.forYouWords}: {words.join(", ")}</p>}
          {words.length === 0 && (
            <p className="home-note">{ar ? "أضف اهتمامات حتى تطابقك الأماكن الجديدة." : "Add a few interests so New Places can match you."}</p>
          )}
          {user?.referredBy && <p className="home-note">{t.becauseYouJoined} Namos Kitchen</p>}
          <ShopShelf id="for-you" shops={picks} ar={ar} />
          <Link to="/shelf" search={{ kind: "for-you", aisle: "" }} className="shelf-more">
            <span aria-hidden="true">{ar ? "المزيد" : "More"}</span>
            <span className="sr-only">{ar ? "المزيد من الأماكن المختارة إلك" : "More places chosen for you"}</span>
          </Link>
        </section>

        {newest.length > 0 && (
          <section className="home-section home-shelf" aria-labelledby="home-new">
            <div className="home-head home-head-rule">
              <div>
                <p className="home-eyebrow home-kicker">{ar ? "الأحدث" : "Newest"}</p>
                <h2 id="home-new">{ar ? "أماكن جديدة" : "New Places"}</h2>
                <p className="home-shelf-note">{ar ? "دكاكين فتحت خلال ٣٠ يوماً." : "Shops opened in the last 30 days."}</p>
              </div>
            </div>
            <ShopShelf id="new" shops={newest} ar={ar} />
            <Link to="/shelf" search={{ kind: "new", aisle: "" }} className="shelf-more">
              <span aria-hidden="true">{ar ? "المزيد" : "More"}</span>
              <span className="sr-only">{ar ? "المزيد من الأماكن الجديدة" : "More new places"}</span>
            </Link>
          </section>
        )}

        {asked.length > 0 && (
          <section className="home-section home-shelf" aria-labelledby="home-asked">
            <div className="home-head home-head-rule">
              <div>
                <p className="home-eyebrow home-kicker">{ar ? "شعبية" : "Popular"}</p>
                <h2 id="home-asked">{ar ? "الأكثر شعبية" : "Most Popular"}</h2>
              </div>
            </div>
            <ShopShelf id="asked" shops={asked} ar={ar} />
            <Link to="/shelf" search={{ kind: "asked", aisle: "" }} className="shelf-more">
              <span aria-hidden="true">{ar ? "المزيد" : "More"}</span>
              <span className="sr-only">{ar ? "المزيد من الأكثر شعبية" : "More most popular shops"}</span>
            </Link>
          </section>
        )}

        <section className="home-section home-shelf" aria-labelledby="home-near">
          <div className="home-head home-head-rule">
            <div>
              <p className="home-eyebrow home-kicker">{ar ? "المسافة" : "Distance"}</p>
              <h2 id="home-near">{ar ? "بالقرب" : "Near By"}</h2>
              <p className="home-shelf-note">{ar ? "من عنوانك، أو من مكان تثبّته الآن" : "From your address, or a place you pin now"}</p>
            </div>
          </div>
          <NearPanel shelf="near" shops={catalog} ar={ar} />
        </section>

        <section className="home-section home-shelf" aria-labelledby="home-random">
          <div className="home-head home-head-rule">
            <div>
              <p className="home-eyebrow home-kicker">{ar ? "اخلط" : "Shuffle"}</p>
              <h2 id="home-random">{ar ? "عشوائي" : "Random"}</h2>
              <p className="home-shelf-note">{ar ? "خلطة جديدة في كل زيارة" : "A fresh shuffle each visit"}</p>
            </div>
          </div>
          <DrawDeck shops={catalog.filter((shop) => !shopMuted(shop, mutedWords, mutedStalls))} ar={ar} />
        </section>
      </main>
    </Shell>
  );
}
