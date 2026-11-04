import { createFileRoute, Link } from "@tanstack/react-router";
import { SHOPS, type Product, type Shop } from "@/lib/data";
import { directoryShops, useSession, type BuyerAccount } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { OptImg } from "@/components/opt-img";

export const Route = createFileRoute("/buyer/$username")({ component: PublicBuyer });

function findBuyer(accounts: Record<string, BuyerAccount>, username: string) {
  const key = decodeURIComponent(username).trim().toLowerCase();
  return Object.values(accounts).find(
    (account) => account.role !== "seller" && (account.username.toLowerCase() === key || account.displayName.toLowerCase() === key),
  );
}

function memberDate(name: string, joinedAt?: number) {
  if (joinedAt) return joinedAt;
  const known: Record<string, number> = {
    lina: Date.UTC(2026, 2, 2),
    "lina.w": Date.UTC(2025, 8, 14),
    ahmad_92: Date.UTC(2025, 10, 3),
    sara_k: Date.UTC(2026, 0, 18),
    maya: Date.UTC(2025, 6, 9),
    omar_t: Date.UTC(2025, 11, 21),
    omar: Date.UTC(2025, 9, 2),
    hadi: Date.UTC(2026, 1, 7),
    huda: Date.UTC(2026, 2, 11),
    nour: Date.UTC(2025, 4, 28),
  };
  const key = name.trim().toLowerCase();
  if (known[key]) return known[key];
  let n = 0;
  for (const ch of key) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  return Date.UTC(2025, 0, 1) + (n % (440 * 86400000));
}

function findFavorite(id: string, shops: Shop[]): { product: Product; shop: Shop } | null {
  for (const shop of shops) {
    const product = shop.products.find((item) => item.id === id);
    if (product) return { product, shop };
  }
  return null;
}

function PublicBuyer() {
  const { username } = Route.useParams();
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const accounts = useSession((s) => s.accounts);
  const buyer = findBuyer(accounts, username);
  const name = decodeURIComponent(username);
  const key = name.trim().toLowerCase();
  const avatar = "/brand/avatars/buyer-duck.jpg?v=7";
  const shops = [...SHOPS, ...directoryShops(accounts)];
  const since = new Date(memberDate(buyer?.username || name, buyer?.joinedAt)).toLocaleDateString(lang === "ar" ? "ar" : "en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const written = [
    ...shops.flatMap((shop) =>
      (shop.reviews ?? [])
        .filter((review) => review.user.trim().toLowerCase() === key)
        .map((review) => ({
          id: `${shop.slug}-${review.comment}`,
          title: lang === "ar" ? shop.nameAr : shop.name,
          comment: review.comment,
        })),
    ),
    ...(buyer?.ownReviews ?? []).map((review) => {
      const shop = shops.find((item) => item.slug === review.shopSlug);
      return {
        id: review.id,
        title: shop ? (lang === "ar" ? shop.nameAr : shop.name) : review.shopSlug,
        comment: review.comment,
      };
    }),
  ];
  const liked = buyer?.shareLikes
    ? (buyer.favorites ?? []).map((id) => findFavorite(id, shops)).filter((item): item is { product: Product; shop: Shop } => Boolean(item))
    : [];
  const publicLists = (buyer?.bookmarkLists ?? []).filter((list) => list.visibility === "public");
  const changes = buyer?.usernameChanges ?? [];
  const former = buyer?.usernameHistory ?? [];
  const changeCount = changes.length || former.length;

  return (
    <Shell>
      <main className="buyer-profile">
        <header className="buyer-hero">
          <OptImg src={avatar} alt="" className="buyer-avatar" />
          <div>
            <h1 className="font-display text-3xl">@{buyer?.username || name}</h1>
            <p className="text-sm font-semibold text-ink">
              {t.memberSince} {since}
            </p>
            <p className="text-sm text-mute">
              {t.nameChanges}: {changeCount}
            </p>
            {changes.length > 0 && (
              <ul className="mt-1 space-y-1 text-sm text-mute">
                {changes.map((change) => (
                  <li key={`${change.name}-${change.at}`}>
                    @{change.name} · {new Date(change.at).toLocaleDateString(lang === "ar" ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" })}
                  </li>
                ))}
              </ul>
            )}
            {changes.length === 0 && former.length > 0 && <p className="text-sm text-mute">{former.join(", ")}</p>}
          </div>
        </header>

        <section className="mt-6">
          <h2 className="font-display text-xl">{t.reviews}</h2>
          <ul className="mt-2 divide-y divide-line">
            {written.length === 0 && <li className="py-3 text-sm text-mute">{t.noSaves}</li>}
            {written.map((review) => (
              <li key={review.id} className="py-3">
                <p className="text-sm font-semibold">{review.title}</p>
                <p className="text-sm">“{review.comment}”</p>
              </li>
            ))}
          </ul>
        </section>

        {publicLists.length > 0 && (
          <section className="mt-6">
            <h2 className="font-display text-xl">{t.createdLists}</h2>
            <div className="bookmark-lists">
              {publicLists.map((list) => {
                const covers = list.slugs.map((slug) => shops.find((shop) => shop.slug === slug)).filter((shop): shop is Shop => Boolean(shop)).slice(0, 4);
                return (
                  <article key={list.id} className="bookmark-list-tile">
                    <span className="bookmark-quad">
                      {Array.from({ length: 4 }, (_, index) => (
                        <span key={index}>
                          {covers[index] ? (
                            <Link to="/shop/$slug" params={{ slug: covers[index].slug }}>
                              <OptImg src={covers[index].avatar} alt="" />
                            </Link>
                          ) : null}
                        </span>
                      ))}
                    </span>
                    <strong>{list.name}</strong>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {buyer?.shareLikes && (
          <section className="mt-6">
            <h2 className="font-display text-xl">{t.liked}</h2>
            <div className="buyer-grid">
              {liked.map(({ product, shop }) => (
                <Link key={product.id} to="/shop/$slug" params={{ slug: shop.slug }} className="buyer-card">
                  <OptImg src={product.images[0] || shop.avatar} alt="" />
                  <p>{lang === "ar" ? product.nameAr : product.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </Shell>
  );
}
