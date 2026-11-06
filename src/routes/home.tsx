import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { directoryShops, useSession } from "@/lib/session";
import { newPlacesShelf, rankForYou, shopMuted, useTieSeed } from "@/lib/shelves";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { Crown } from "@/components/plan-stamp";
import { CategoryRail, ShopShelf } from "@/components/shop-shelf";
import { HelloStrip } from "@/components/hello-board";
import { NearPanel } from "@/components/near-panel";
import { DrawDeck } from "@/components/draw-deck";
import { OptImg } from "@/components/opt-img";
import { BRAND } from "@/lib/brand-manifest";

/* LOCKED section names. Do not rename unless the user says unlock sections.
   For You / إلك
   New Places / أماكن جديدة
   Most Popular / الأكثر شعبية
   Near By / بالقرب
   Random / عشوائي
*/

export const Route = createFileRoute("/home")({ component: HomePage });

function HomePage() {
  const lang = useSession((s) => s.lang);
  const user = useSession((s) => s.user);
  const t = copy[lang];
  const ar = lang === "ar";
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
  const [paused, setPaused] = useState(false);
  const [slide, setSlide] = useState(0);
  const nextSlide = () => setSlide((current) => (current + 1) % 2);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(nextSlide, 8000);
    return () => window.clearInterval(timer);
  }, [paused, slide]);

  return (
    <Shell>
      <main className="home">
        <h1 className="sr-only">{ar ? "سوق بطوطة" : "Souq Battuta"}</h1>
        <section className={`home-hero flock-hero${paused ? " is-paused" : ""}`} aria-label={ar ? "مين إحنا" : "Who we are"}>
          <picture className="flock-collage-frame">
            <source media="(max-width: 760px)" type="image/avif" srcSet={BRAND["/brand/hero-collage-phone.jpg"].avif} sizes="100vw" />
            <source media="(max-width: 760px)" type="image/webp" srcSet={BRAND["/brand/hero-collage-phone.jpg"].webp} sizes="100vw" />
            <source type="image/avif" srcSet={BRAND["/brand/hero-collage.jpg"].avif} sizes="100vw" />
            <source type="image/webp" srcSet={BRAND["/brand/hero-collage.jpg"].webp} sizes="100vw" />
            <img className="flock-collage" src={BRAND["/brand/hero-collage.jpg"].src} alt="" width={BRAND["/brand/hero-collage.jpg"].w} height={BRAND["/brand/hero-collage.jpg"].h} decoding="async" fetchPriority="high" />
          </picture>
          <button
            type="button"
            className="flock-pause"
            aria-label={paused ? (ar ? "تشغيل" : "Play") : ar ? "إيقاف" : "Pause"}
            onClick={() => setPaused((on) => !on)}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <div className="flock-stage">
            <div className={`flock-pass${slide === 0 ? " is-intro" : ""}`} key={slide}>
              {slide === 0 ? (
                <div className="flock-sheet">
                  <p>Souq Battuta is different.<span>سوق بطوطة مختلف</span></p>
                  <p>Your rules. Your terms.<span>ضمن قواعدك وشروطك</span></p>
                  <p>Create your own algorithm. Build your network. Strengthen your community.<span>اصنع خوارزميتك ابنِ شبكتك قوِّي مجتمعك</span></p>
                  <p>No hidden cuts. No processing fees.<span>بدون عمولات</span></p>
                  <p>Your profit: 100% yours.<span>ربحك: 100٪ إلك</span></p>
                </div>
              ) : (
                <div className="flock-sheet is-plans">
                  <p>Pay only for the software.<span>لدفع فقط مقابل البرنامج</span></p>
                  <div className="flock-plans">
                    <Link to="/join">
                      <span className="flock-crown flock-crown-basic"><Crown plan="basic" className="h-8 w-9" /></span>
                      <b>0.150</b>
                      <small>Basic · أساسي</small>
                    </Link>
                    <Link to="/join">
                      <span className="flock-crown flock-crown-grow"><Crown plan="grow" className="h-8 w-9" /></span>
                      <b>0.500</b>
                      <small>Grow · نمو</small>
                    </Link>
                    <Link to="/join">
                      <span className="flock-crown flock-crown-premium"><Crown plan="premium" className="h-8" /></span>
                      <b>1 JD</b>
                      <small>Premium · بريميوم</small>
                    </Link>
                  </div>
                </div>
              )}
              <OptImg className="flock-duck" src="/brand/duck-mark.png" alt="" eager sizes="88px" />
              <Link to="/join" className="flock-stamp">
                <span>انضم لسرب بطوطة</span>
                <span>Join the Battuta flock</span>
              </Link>
            </div>
          </div>
          <div className="flock-map">
            <button type="button" className="flock-next" aria-label={ar ? "التالي" : "Next"} onClick={nextSlide} />
          </div>
        </section>

        <p className="mx-auto max-w-2xl px-4 py-6 text-center text-base leading-relaxed text-ink">
          <span className="block">Discover Amman’s home businesses without ads or paid boosts. You choose what you see.</span>
          <span className="mt-2 block" dir="rtl" lang="ar">اكتشف مشاريع عمّان البيتية بدون إعلانات وبدون دفع مقابل الظهور. أنت تختار ما تراه.</span>
        </p>

        <section className="home-section home-cats-wrap" aria-labelledby="home-cats">
          <div className="home-head">
            <div>
              <p className="home-eyebrow">{ar ? "تجوّل" : "Wander"}</p>
              <h2 id="home-cats">{ar ? "الأقسام" : "Categories"}</h2>
            </div>
          </div>
          <CategoryRail ar={ar} />
        </section>

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

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M4 2.5h2.4v11H4zm5.6 0H12v11H9.6z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M4.2 2.4v11.2L13.5 8z" />
    </svg>
  );
}
