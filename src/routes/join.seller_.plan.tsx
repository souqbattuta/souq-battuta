import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PLANS, type PlanId } from "@/lib/data";
import { useSession } from "@/lib/session";
import { clearSellerDraft, readSellerDraft } from "@/lib/seller-draft";
import { checkPromo, type PromoCode } from "@/lib/promo-codes";
import { Shell } from "@/components/site-header";
import { PlanStamp } from "@/components/plan-stamp";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/join/seller_/plan")({
  component: SellerPlanPage,
});

const PAID: PlanId[] = ["basic", "grow", "premium"];
const RANK: Record<PlanId, number> = { free: 0, basic: 1, grow: 2, premium: 3 };
const FEATURES: { en: string; ar: string; min: PlanId }[] = [
  { en: "The Treasury", ar: "الخزينة", min: "free" },
  { en: "Order / Inquire Now", ar: "اطلب / استفسر الآن", min: "free" },
  { en: "WhatsApp stays yours", ar: "واتساب يبقى إلك", min: "free" },
  { en: "5 items", ar: "٥ أصناف", min: "free" },
  { en: "30 items", ar: "٣٠ صنفاً", min: "grow" },
  { en: "100 items", ar: "١٠٠ صنف", min: "premium" },
  { en: "3 photos an item", ar: "٣ صور للصنف", min: "free" },
  { en: "5 photos an item", ar: "٥ صور للصنف", min: "basic" },
  { en: "1 main photo and 5 sub photos", ar: "صورة رئيسية و٥ صور فرعية", min: "grow" },
  { en: "Your profile photo", ar: "صورة ملفك", min: "basic" },
  { en: "Open / Closed", ar: "مفتوح / مغلق", min: "basic" },
  { en: "View count", ar: "عدد المشاهدات", min: "basic" },
  { en: "5 algorithm terms", ar: "٥ مصطلحات للخوارزمية", min: "basic" },
  { en: "15 algorithm terms", ar: "١٥ مصطلحاً للخوارزمية", min: "grow" },
  { en: "25 algorithm terms", ar: "٢٥ مصطلحاً للخوارزمية", min: "premium" },
  { en: "Reviews", ar: "تقييمات", min: "grow" },
  { en: "Sort the shop your way", ar: "رتّب الدكان على كيفك", min: "grow" },
  { en: "Link your social media", ar: "اربط حساباتك", min: "basic" },
  { en: "Analytics", ar: "تحليلات", min: "grow" },
  { en: "2 Hello, World! posts a day", ar: "منشوران في اليوم على Hello, World!", min: "basic" },
  { en: "3 Hello, World! posts a day", ar: "٣ منشورات في اليوم على Hello, World!", min: "grow" },
  { en: "5 Hello, World! posts a day", ar: "٥ منشورات في اليوم على Hello, World!", min: "premium" },
  { en: "Messages from sellers", ar: "رسائل البائعين", min: "grow" },
  { en: "Search in the stall", ar: "بحث في الدكان", min: "premium" },
  { en: "Sizes and colors", ar: "مقاسات وألوان", min: "premium" },
  { en: "Followers", ar: "متابعون", min: "grow" },
];

function SellerPlanPage() {
  const lang = useSession((s) => s.lang);
  const startJoin = useSession((s) => s.startJoin);
  const navigate = useNavigate();
  const promos = useSession((s) => s.promoCodes);
  const redemptions = useSession((s) => s.promoRedemptions);
  const ar = lang === "ar";
  const draft = readSellerDraft();
  const [plan, setPlan] = useState<PlanId>("free");
  const [payOpen, setPayOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState("");

  async function finish(chosen: PlanId, applied?: PromoCode | null) {
    if (!draft) return;
    const gift = applied === undefined ? promo : applied;
    setLoading(true);
    const joined = await startJoin({
      phone: draft.phone,
      username: draft.username,
      address: draft.address,
      city: draft.city,
      areaLat: draft.areaLat,
      areaLng: draft.areaLng,
      intent: "seller",
      plan: gift?.plan ?? chosen,
      categories: draft.categories,
      promoCode: gift?.code,
      promoMonths: gift?.months,
    });
    setLoading(false);
    if (!joined.ok) {
      setPromoError(joined.error === "unconfigured" ? (ar ? "واتساب غير موصول بعد." : "WhatsApp is not set up on this site yet.") : ar ? "تعذر إرسال الرمز." : "The code could not be sent.");
      return;
    }
    clearSellerDraft();
    void navigate({ to: "/otp" });
  }

  function applyCode() {
    setPromoError("");
    const result = checkPromo(code, redemptions ?? [], Date.now(), promos);
    if (!result.ok) {
      setPromo(null);
      setPromoError(
        result.error === "expired"
          ? ar ? "هذا الرمز انتهى." : "This code has expired."
          : result.error === "full"
            ? ar ? "هذا الرمز استُخدم بالكامل." : "This code has been fully used."
            : ar ? "الرمز غير صحيح." : "That code is not valid.",
      );
      return;
    }
    setPromo(result.promo);
    setPlan(result.promo.plan);
  }

  function continuePlan() {
    if (!draft) return;
    if (promo && promo.plan === plan) {
      finish(plan, promo);
      return;
    }
    if (PAID.includes(plan)) {
      setPayOpen(true);
      return;
    }
    finish(plan, null);
  }

  if (!draft) {
    return (
      <Shell>
        <main className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-mute">{ar ? "ابدأ من الخطوة الأولى." : "Start from step one."}</p>
          <Link to="/join/seller" className="mt-3 inline-flex h-11 items-center font-semibold text-ink underline">
            {ar ? "إنشاء حساب بائع" : "Create a seller account"}
          </Link>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <Link to="/join/seller" className="text-sm font-semibold text-ink underline">
          {ar ? "رجوع" : "Back"}
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-mute">{ar ? "الخطوة ٢ من ٢" : "Step 2 of 2"}</p>
        <h1 className="mt-1 font-display text-3xl text-ink">{ar ? "اختر الخطة" : "Choose a plan"}</h1>
        <p className="mt-2 max-w-xl text-sm text-mute">
          {ar
            ? "المجاني ينشئ الحساب مباشرة. الخطط المدفوعة تفتح الدفع أولاً. رقم البطاقة لا يُحفظ."
            : "Free creates the account now. A paid plan opens payment first. The card number is not saved."}
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const item = PLANS[id];
            const on = plan === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setPlan(id)}
                className={cn(
                  "flex flex-col rounded-xl border bg-cream p-4 text-start",
                  on ? "border-ink ring-2 ring-ink" : "border-line",
                  "hover:-translate-y-0.5 hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-2xl">{ar ? item.nameAr : item.name}</span>
                  {item.badge !== "none" ? (
                    <PlanStamp plan={id} className="plan-badge profile-badge" />
                  ) : (
                    <span className="plan-badge profile-badge" aria-hidden="true" />
                  )}
                </span>
                <span className="mt-1 text-lg font-semibold">{item.price}</span>
                <ul className="mt-3 space-y-1">
                  {FEATURES.map((feature) => {
                    const included = RANK[id] >= RANK[feature.min];
                    return (
                      <li key={feature.en} className={included ? "tier-feature" : "tier-feature is-out"}>
                        <span className="tick" aria-hidden="true">{included ? "✓" : ""}</span>
                        <span>{ar ? feature.ar : feature.en}</span>
                      </li>
                    );
                  })}
                </ul>
              </button>
            );
          })}
        </div>
        <section className="mt-8 max-w-md rounded-xl border border-line bg-cream p-4">
          <h2 className="font-display text-xl text-ink">{ar ? "أدخل الرمز الترويجي" : "Enter promotional code"}</h2>
          <p className="mt-1 text-sm text-mute">
            {ar ? "رمز من سوق بطوطة يفتح خطة لعدد من الأشهر مجاناً." : "A Souq Battuta code opens a plan for a set number of free months."}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={ar ? "الرمز" : "Code"}
              aria-label={ar ? "الرمز الترويجي" : "Promotional code"}
              className="h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 uppercase outline-none focus:border-ink"
            />
            <button
              type="button"
              onClick={applyCode}
              className="h-11 rounded-md border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {ar ? "تطبيق" : "Apply"}
            </button>
          </div>
          {promoError && <p className="mt-2 text-sm text-red" role="alert">{promoError}</p>}
          {promo && (
            <p className="mt-2 text-sm font-semibold text-ink">
              {ar ? promo.noteAr : promo.note}
            </p>
          )}
        </section>
        <button
          type="button"
          disabled={loading}
          onClick={continuePlan}
          className="mt-6 h-12 rounded-md bg-ink px-6 font-semibold text-cream hover:bg-[#152648] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
        >
          {loading ? "…" : promo && promo.plan === plan ? (ar ? "إنشاء الحساب" : "Create account") : PAID.includes(plan) ? (ar ? "متابعة للدفع" : "Continue to payment") : ar ? "إنشاء الحساب" : "Create account"}
        </button>
      </main>
      {payOpen && (
        <PaymentDialog
          ar={ar}
          amount={PLANS[plan].price}
          onClose={() => setPayOpen(false)}
          onPaid={() => finish(plan, null)}
        />
      )}
    </Shell>
  );
}

function PaymentDialog({
  ar,
  amount,
  onClose,
  onPaid,
}: {
  ar: boolean;
  amount: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const number = String(fd.get("number") ?? "").replace(/\s/g, "");
    const expiry = String(fd.get("expiry") ?? "").trim();
    const cvc = String(fd.get("cvc") ?? "").trim();
    if (name.length < 2) return setError(ar ? "اكتب الاسم على البطاقة." : "Enter the name on the card.");
    if (!/^\d{16}$/.test(number)) return setError(ar ? "رقم البطاقة ١٦ خانة." : "Card number must be 16 digits.");
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError(ar ? "التاريخ بهذه الصورة MM/YY." : "Use expiry as MM/YY.");
    const [month, year] = expiry.split("/").map(Number);
    const end = new Date(2000 + year, month, 0);
    if (month < 1 || month > 12 || end < new Date()) return setError(ar ? "البطاقة منتهية." : "This card is expired.");
    if (!/^\d{3,4}$/.test(cvc)) return setError(ar ? "رمز الأمان ٣ أو ٤ أرقام." : "Security code is 3 or 4 digits.");
    setLoading(true);
    onPaid();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1c305c]/45 px-4" role="presentation" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pay-title" className="font-display text-2xl text-ink">
              {ar ? "الدفع" : "Payment"}
            </h2>
            <p className="text-sm text-mute">{amount}</p>
          </div>
          <button
            type="button"
            aria-label={ar ? "إغلاق" : "Close"}
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-lg hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            ×
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          {ar
            ? "لا نحفظ رقم البطاقة ولا رمز الأمان. عند الإطلاق سيُفتح الدفع عبر بوابة خارجية، بحيث لا تصل بيانات البطاقة إلى سوق بطوطة."
            : "We do not save the card number or security code. At launch this step will open a hosted checkout, so card details never reach Souq Battuta."}
        </p>
        <label className="mt-4 block text-sm font-semibold">
          {ar ? "الاسم على البطاقة" : "Name on card"}
          <input name="name" autoComplete="cc-name" required className="mt-1 h-11 w-full rounded-md border border-line px-3 font-normal outline-none focus:border-ink" />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          {ar ? "رقم البطاقة" : "Card number"}
          <input name="number" inputMode="numeric" autoComplete="cc-number" placeholder="•••• •••• •••• ••••" required className="mt-1 h-11 w-full rounded-md border border-line px-3 font-normal outline-none focus:border-ink" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">
            {ar ? "الانتهاء" : "Expiry"}
            <input name="expiry" autoComplete="cc-exp" placeholder="MM/YY" required className="mt-1 h-11 w-full rounded-md border border-line px-3 font-normal outline-none focus:border-ink" />
          </label>
          <label className="block text-sm font-semibold">
            {ar ? "رمز الأمان" : "Security code"}
            <input name="cvc" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" required className="mt-1 h-11 w-full rounded-md border border-line px-3 font-normal outline-none focus:border-ink" />
          </label>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 h-12 w-full rounded-md bg-ink font-semibold text-cream hover:bg-[#152648] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
        >
          {loading ? "…" : ar ? "ادفع وأنشئ الحساب" : "Pay and create account"}
        </button>
      </form>
    </div>
  );
}
