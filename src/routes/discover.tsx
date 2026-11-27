import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { displayPlan, type Shop } from "@/lib/data";
import { directoryShops, shopFromPublic, useSession } from "@/lib/session";
import { rankBrowse, useTieSeed } from "@/lib/shelves";
import { searchPublicShops } from "@/lib/souq-sync";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { PlanBadge } from "@/components/plan-stamp";
import { OptImg } from "@/components/opt-img";
import { keepLang } from "@/lib/site";

const EMPTY: string[] = [];

export const Route = createFileRoute("/discover")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
    ...keepLang(s),
  }),
  search: { middlewares: [stripSearchParams({ q: "" })] },
  component: DiscoverPage,
});

function DiscoverPage() {
  const routeSearch = Route.useSearch();
  const { q } = routeSearch;
  const navigate = useNavigate();
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
  const serverShops = useSession((s) => s.serverShops);
  const follows = useSession((s) => s.follows) ?? EMPTY;
  const interest = useSession((s) => s.interestWords) ?? EMPTY;
  const query = q.trim();
  const signedIn = Boolean(user);
  const tieSeed = useTieSeed();
  const tie = (slug: string) => {
    let hash = tieSeed || 1;
    for (const ch of slug) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    return hash >>> 0;
  };
  const followKey = follows.join("\n");
  const [bag, setBag] = useState<{ q: string; phase: "loading" | "done"; shops: Shop[] } | null>(null);

  useEffect(() => {
    if (query.length < 2) return;
    let cancel = false;
    setBag({ q: query, phase: "loading", shops: [] });
    void searchPublicShops({ data: { q: query, ...(signedIn && follows.length ? { follows } : {}) } })
      .then((res) => {
        if (cancel) return;
        setBag({ q: query, phase: "done", shops: res.shops.map(shopFromPublic) });
      })
      .catch(() => {
        if (!cancel) setBag({ q: query, phase: "done", shops: [] });
      });
    return () => {
      cancel = true;
    };
  }, [query, signedIn, followKey, follows]);

  const listing = useMemo(
    () =>
      rankBrowse(directoryShops(accounts), {
        follows: signedIn ? follows : [],
        words: signedIn ? interest : [],
        personal: signedIn,
        tie,
      }),
    [accounts, serverShops, signedIn, follows, interest, tieSeed],
  );
  const active = bag && bag.q === query ? bag : null;
  const searching = query.length >= 2 && (!active || active.phase === "loading");
  const results = query.length >= 2 ? (active?.phase === "done" ? active.shops : []) : query ? [] : listing;
  const showEmpty = query.length > 0 && !searching && results.length === 0;

  return (
    <Shell>
      <main className="discover-page px-4 py-8 sm:px-8">
        <h1 className="font-display text-3xl">{lang === "ar" ? "السوق" : "The Souq"}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const next = String(new FormData(event.currentTarget).get("q") ?? "");
            void navigate({ to: "/discover", search: { q: next, ...keepLang(routeSearch) } });
          }}
        >
          <input
            name="q"
            defaultValue={q}
            key={q}
            placeholder={t.searchPlaceholder}
            className="mt-4 h-12 w-full max-w-lg rounded-md border border-line bg-cream px-3"
          />
        </form>
        {searching ? <p className="discover-note mt-2 text-sm text-mute">{t.searchBusy}</p> : null}
        {showEmpty ? <p className="discover-note mt-2 text-sm text-mute">{t.searchEmpty}</p> : null}
        {!searching && !showEmpty ? (
          <p className="discover-note mt-2 text-sm text-mute">{results.length} {lang === "ar" ? "دكاكين" : "shops"}</p>
        ) : null}
        <ul className="discover-list mt-4 divide-y divide-line">
          {results.map((s) => (
            <li key={s.slug} className="py-3">
              <Link to="/shop/$slug" params={{ slug: s.slug }} className="flex items-center gap-3">
                <OptImg src={s.avatar} alt="" className="size-14 rounded-full object-cover" sizes="112px" />
                <div>
                  <div className="flex items-center gap-2">
                    <b>{lang === "ar" ? s.nameAr : s.name}</b>
                    <PlanBadge plan={displayPlan(s.plan)} size="mark" />
                  </div>
                  <p className="text-xs text-mute">{lang === "ar" ? s.areaAr : s.area}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </Shell>
  );
}
