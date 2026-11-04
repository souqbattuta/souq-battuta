import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { directoryShops, useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { PlanStamp } from "@/components/plan-stamp";
import { OptImg } from "@/components/opt-img";

export const Route = createFileRoute("/discover")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
  }),
  search: { middlewares: [stripSearchParams({ q: "" })] },
  component: DiscoverPage,
});

function DiscoverPage() {
  const { q } = Route.useSearch();
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const accounts = useSession((s) => s.accounts);
  const query = q.trim().toLowerCase();
  const results = directoryShops(accounts)
    .map((shop) => {
      const blob = `${shop.name} ${shop.nameAr} ${shop.area} ${shop.areaAr} ${shop.bio ?? ""} ${shop.bioAr ?? ""} ${shop.keywords?.join(" ") ?? ""} ${shop.products.map((product) => `${product.name} ${product.nameAr} ${product.desc}`).join(" ")}`.toLowerCase();
      return { shop, match: !query || blob.includes(query) };
    })
    .filter((row) => row.match)
    .sort((a, b) => Number(b.shop.plan === "premium") - Number(a.shop.plan === "premium"))
    .map((row) => row.shop);

  return (
    <Shell>
      <main className="px-4 py-8 sm:px-8">
        <h1 className="font-display text-3xl">{t.discover}</h1>
        <form>
          <input
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className="mt-4 h-12 w-full max-w-lg rounded-md border border-line bg-cream px-3"
          />
        </form>
        <p className="mt-2 text-sm text-mute">{results.length} stalls</p>
        <ul className="mt-4 divide-y divide-line">
          {results.map((s) => (
            <li key={s.slug} className="py-3">
              <Link to="/shop/$slug" params={{ slug: s.slug }} className="flex items-center gap-3">
                <OptImg src={s.avatar} alt="" className="size-14 rounded-full object-cover" sizes="112px" />
                <div>
                  <div className="flex items-center gap-2">
                    <b>{lang === "ar" ? s.nameAr : s.name}</b>
                    <PlanStamp plan={s.plan} />
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
