import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { OFFERED_PLANS, PLANS, type PlanId } from "@/lib/data";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { PlanStamp } from "@/components/plan-stamp";
import { PaymentDialog, type PaymentChoice } from "@/components/payment-dialog";
import { submitSouqPayment } from "@/lib/souq-sync";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/sell")({ component: SellPage });

const VISIBILITY: Record<PlanId, string> = {
  free: "Standard visibility",
  basic: "Boosted",
  pro: "Priority",
  premium: "Top priority",
};

function SellPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const becomeSeller = useSession((s) => s.becomeSeller);
  const notePayment = useSession((s) => s.notePayment);
  const navigate = useNavigate();
  const [pay, setPay] = useState<PlanId | null>(null);
  const ar = lang === "ar";

  function pick(plan: PlanId) {
    if (!user) {
      void navigate({ to: "/join", search: { intent: "seller" } });
      return;
    }
    if (plan === "free") {
      const slug = user.shopSlug ?? `stall-${user.username.toLowerCase()}`;
      becomeSeller(plan, slug);
      void navigate({ to: "/seller", search: { item: "", tab: "analytics", order: "", note: "" } });
      return;
    }
    setPay(plan);
  }

  function paid(choice: PaymentChoice) {
    setPay(null);
    void submitSouqPayment({ data: { plan: choice.plan, billingPeriod: choice.period, paymentMethod: choice.method, paymentRef: choice.ref } }).then((res) => {
      if (res.ok) notePayment({ pendingPlan: choice.plan, paymentStatus: "pending", paymentMethod: choice.method, paymentRef: choice.ref, billingPeriod: choice.period });
      void navigate({ to: "/seller", search: { item: "", tab: "analytics", order: "", note: "" } });
    });
  }

  return (
    <Shell>
      <main className="px-4 py-10 sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-wider text-red">Sellers keep the customer</p>
        <h1 className="font-display text-4xl">{t.sell}</h1>
        <p className="mt-2 max-w-2xl text-mute">
          WhatsApp stays yours. Your first month of Basic is free. One free month per WhatsApp number. Nothing renews on its own.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {OFFERED_PLANS.map((id) => {
            const p = PLANS[id];
            return (
              <article key={id} className="flex flex-col rounded-xl border border-line bg-cream p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl">{lang === "ar" ? p.nameAr : p.name}</h2>
                  {p.badge !== "none" ? <PlanStamp plan={id} /> : <span className="text-xs text-mute">no stamp</span>}
                </div>
                <p className="mt-1 text-lg font-semibold">{p.price}</p>
                <p className="text-xs text-mute">{id === "free" ? (ar ? "مجاناً لثلاثة أشهر" : "Free for 3 months") : p.priceNote}</p>
                <p className="text-xs font-semibold text-ink">{ar ? { free: "ظهور عادي", basic: "ظهور أقوى", pro: "أولوية", premium: "الأولوية الأولى" }[id] : VISIBILITY[id]}</p>
                <p className="mt-3 flex-1 text-sm">{lang === "ar" ? p.blurbAr : p.blurb}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  <li>{p.listings} items · {p.listings} صنف</li>
                  <li>1 main photo + {p.images - 1} more</li>
                  <li>{p.helloPerDay} Hello World posts a day</li>
                  <li>Descriptions up to {p.descChars} characters</li>
                  <li>{p.options ? "✓ Sizes, options and size chart" : "— Sizes, options and size chart"}</li>
                  <li className="text-xs text-mute">3 months {p.bundles[3]} · 6 months {p.bundles[6]} · 12 months {p.bundles[12]} JOD</li>
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
                          : id === "pro"
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
        {pay && (
          <PaymentDialog
            ar={ar}
            plan={pay}
            amount={PLANS[pay].price}
            onClose={() => setPay(null)}
            onFree={() => setPay(null)}
            onPaid={paid}
          />
        )}
      </main>
    </Shell>
  );
}
