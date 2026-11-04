import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PLANS, type PlanId } from "@/lib/data";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { PlanStamp } from "@/components/plan-stamp";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/sell")({ component: SellPage });

function SellPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const becomeSeller = useSession((s) => s.becomeSeller);
  const navigate = useNavigate();

  function pick(plan: PlanId) {
    if (!user) {
      void navigate({ to: "/join", search: { intent: "seller" } });
      return;
    }
    const slug = user.shopSlug ?? `stall-${user.username.toLowerCase()}`;
    becomeSeller(plan, slug);
    void navigate({ to: "/seller", search: { item: "", tab: "analytics", order: "", note: "" } });
  }

  return (
    <Shell>
      <main className="px-4 py-10 sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-wider text-red">Sellers keep the customer</p>
        <h1 className="font-display text-4xl">{t.sell}</h1>
        <p className="mt-2 max-w-2xl text-mute">
          WhatsApp stays yours. No in-app payment. Free is three months once per phone. After that, the same number cannot use Free again.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            return (
              <article key={id} className="flex flex-col rounded-xl border border-line bg-cream p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl">{lang === "ar" ? p.nameAr : p.name}</h2>
                  {p.badge !== "none" ? <PlanStamp plan={id} /> : <span className="text-xs text-mute">no stamp</span>}
                </div>
                <p className="mt-1 text-lg font-semibold">{p.price}</p>
                <p className="text-xs text-mute">{p.priceNote}</p>
                <p className="mt-3 flex-1 text-sm">{lang === "ar" ? p.blurbAr : p.blurb}</p>
                <ul className="mt-3 space-y-1 text-xs text-mute">
                  <li>{p.listings} listings · {p.images} photos each</li>
                  <li>{p.openClosed ? "Open/Closed" : "No Open/Closed"}</li>
                  <li>{p.views ? "Profile views" : "No views"}</li>
                  <li>{p.reviews ? "Reviews" : "No reviews"}</li>
                  <li>{p.socials ? "Verified socials" : "No socials"}</li>
                  <li>{p.invoice ? "Inquiry or invoice slip" : "Inquiry only"}</li>
                </ul>
                <button
                  type="button"
                  onClick={() => pick(id)}
                  className={cn(
                    "mt-4 h-12 rounded-md font-semibold",
                    id === "premium" ? "bg-stamp-blue text-cream" : "bg-ink text-cream",
                  )}
                >
                  Start with {p.name}
                </button>
                <Link
                  to="/shop/$slug"
                  params={{
                    slug:
                      id === "free"
                        ? "ahlan-bakery"
                        : id === "basic"
                          ? "alchemist-clay"
                          : id === "grow"
                            ? "namos-kitchen"
                            : "beit-al-tiraz",
                  }}
                  className="mt-2 text-center text-xs underline"
                >
                  See a {p.name} profile
                </Link>
              </article>
            );
          })}
        </div>
      </main>
    </Shell>
  );
}
