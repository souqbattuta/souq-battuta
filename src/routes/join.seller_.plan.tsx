import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { OFFERED_PLANS, PLANS, normalizePlan, type PlanId } from "@/lib/data";
import { useSession } from "@/lib/session";
import { readSellerDraft, saveSellerDraft, type SellerDraft } from "@/lib/seller-draft";
import { checkPromo, type PromoCode } from "@/lib/promo-codes";
import { Shell } from "@/components/site-header";
import { PlanStamp } from "@/components/plan-stamp";
import { PaymentDialog, type PaymentChoice } from "@/components/payment-dialog";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/join/seller_/plan")({
  component: SellerPlanPage,
});

const PAID: PlanId[] = ["basic", "premium"];
const RANK: Record<PlanId, number> = { free: 0, basic: 1, pro: 2, premium: 3 };
const FEATURES: { en: string; ar: string; min: PlanId; hint?: "treasury" | "algo" | "hello" }[] = [
  { en: "The Souq", ar: "السوق", min: "free", hint: "treasury" },
  { en: "Order / Inquire Now", ar: "اطلب / استفسر الآن", min: "free" },
  { en: "WhatsApp stays yours", ar: "واتساب يبقى إلك", min: "free" },
  { en: "5 items", ar: "٥ أصناف", min: "free" },
  { en: "100 items", ar: "١٠٠ صنف", min: "premium" },
  { en: "1 main photo and 3 extra", ar: "صورة رئيسية و٣ إضافية", min: "free" },
  { en: "A video", ar: "فيديو", min: "premium" },
  { en: "Your profile photo", ar: "صورة ملفك", min: "basic" },
  { en: "Open / Closed", ar: "مفتوح / مغلق", min: "basic" },
  { en: "View count", ar: "عدد المشاهدات", min: "basic" },
  { en: "5 keywords", ar: "٥ كلمات", min: "basic", hint: "algo" },
  { en: "15 keywords", ar: "١٥ كلمة", min: "pro", hint: "algo" },
  { en: "25 keywords", ar: "٢٥ كلمة", min: "premium", hint: "algo" },
  { en: "Reviews", ar: "تقييمات", min: "pro" },
  { en: "Sort the shop your way", ar: "رتّب الدكان على كيفك", min: "pro" },
  { en: "Link your social media", ar: "اربط حساباتك", min: "basic" },
  { en: "Analytics", ar: "تحليلات", min: "pro" },
  { en: "2 Hello World posts per 24 hours", ar: "منشورا Hello World كل ٢٤ ساعة", min: "basic", hint: "hello" },
  { en: "5 Hello World posts per 24 hours", ar: "٥ منشورات Hello World كل ٢٤ ساعة", min: "premium", hint: "hello" },
  { en: "Messages from sellers", ar: "رسائل البائعين", min: "pro" },
  { en: "Search in the stall", ar: "بحث في الدكان", min: "premium" },
  { en: "Sizes and colors", ar: "مقاسات وألوان", min: "premium" },
  { en: "Followers", ar: "متابعون", min: "pro" },
];

const VISIBILITY: Record<PlanId, [string, string]> = {
  free: ["Standard visibility", "ظهور عادي"],
  basic: ["Boosted", "ظهور أقوى"],
  pro: ["Priority", "أولوية"],
  premium: ["Top priority", "الأولوية الأولى"],
};

const HINTS: Record<"treasury" | "algo" | "hello", [string, string]> = {
  treasury: ["Your private records: orders, notes, and what you save. Only you see them.", "سجلاتك الخاصة: الطلبات والملاحظات وما تحفظه. لا يراها غيرك."],
  algo: ["Words you add so a search can bring your stall forward.", "كلمات تضيفها حتى يظهر دكانك عندما يبحث أحد."],
  hello: ["A short public note on the souq board. It stays up for a day.", "ملاحظة قصيرة على لوحة السوق. تبقى يوماً واحداً."],
};

function SellerPlanPage() {
  const lang = useSession((s) => s.lang);
  const startJoin = useSession((s) => s.startJoin);
  const navigate = useNavigate();
  const promos = useSession((s) => s.promoCodes);
  const redemptions = useSession((s) => s.promoRedemptions);
  const ar = lang === "ar";
  const [draft, setDraft] = useState<SellerDraft | null | undefined>(undefined);
  const [plan, setPlan] = useState<PlanId>("basic");
  const [payOpen, setPayOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState("");

  useEffect(() => {
    const saved = readSellerDraft();
    setDraft(saved);
    if (saved?.plan && saved.plan !== "pro") setPlan(normalizePlan(saved.plan));
    if (saved?.plan === "pro" || saved?.plan === "grow") setPlan("pro");
  }, []);

  function remember(next: Partial<SellerDraft>) {
    if (!draft) return;
    const saved = { ...draft, ...next };
    setDraft(saved);
    saveSellerDraft(saved);
  }

  async function finish(chosen: PlanId, payment?: PaymentChoice | null, applied?: PromoCode | null) {
    if (!draft) return;
    const gift = applied === undefined ? promo : applied;
    const pendingPay = Boolean(payment);
    setLoading(true);
    const joined = await startJoin({
      phone: draft.phone,
      username: draft.username,
      displayName: draft.shopName,
      shopName: draft.shopName,
      address: draft.address,
      city: draft.city,
      areaLat: draft.areaLat,
      areaLng: draft.areaLng,
      intent: "seller",
      plan: gift?.plan ?? chosen,
      categories: draft.categories,
      promoCode: gift?.code,
      promoMonths: gift?.months,
      billingPeriod: payment?.period ?? "monthly",
      paymentStatus: pendingPay ? "pending" : "active",
      paymentMethod: pendingPay ? payment?.method : "free",
      paymentRef: payment?.ref,
    });
    setLoading(false);
    if (!joined.ok) {
      setPromoError(joined.error === "unconfigured" ? (ar ? "واتساب غير موصول بعد." : "WhatsApp is not set up on this site yet.") : joined.error === "missing" ? (ar ? "ابدأ من الخطوة الأولى." : "Start from step one.") : joined.error === "trial" ? (ar ? "هذا الرقم استخدم التجربة المجانية. اختر خطة مدفوعة لفتح الدكان." : "This phone number has already used its free trial. Choose a paid plan to open your shop.") : ar ? "تعذر إرسال الرمز. الرمز التجريبي 424242 ما زال يعمل إن كانت الخطوة الأولى محفوظة." : "The code could not be sent. The test code 424242 still works if step one was saved.");
      return;
    }
    remember({ plan: gift?.plan ?? chosen, billingPeriod: payment?.period, paymentMethod: payment?.method ?? "free", paymentRef: payment?.ref, promoCode: gift?.code, promoMonths: gift?.months });
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
      finish(plan, null, promo);
      return;
    }
    if (PAID.includes(plan)) {
      setPayOpen(true);
      return;
    }
    finish(plan, null, null);
  }

  if (draft === undefined) {
    return (
      <Shell>
        <main className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-mute">…</p>
        </main>
      </Shell>
    );
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
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-cream p-3 text-sm">
          <img src="/brand/duck-mark.png" alt="" width={28} height={28} />
          <p>{ar ? "أول شهر من الأساسي مجاني. شهر مجاني واحد لكل رقم واتساب. بعد ذلك اختر خطة ليبقى دكانك مفتوحاً." : "Your first month of Basic is free. One free month per WhatsApp number. After that, choose a plan to keep your shop open."}</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {OFFERED_PLANS.map((id) => {
            const item = PLANS[id];
            const on = plan === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPlan(id);
                  remember({ plan: id });
                }}
                className={cn(
                  "flex flex-col rounded-xl border bg-cream p-4 text-start",
                  id === "pro" ? "border-[#FFB705] ring-2 ring-[#FFB705]" : on ? "border-ink ring-2 ring-ink" : "border-line",
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
                <span className="mt-1 text-sm font-semibold">{item.monthly} JOD / month · {item.monthly} دينار بالشهر</span>
                <span className="mt-1 text-[11px] text-mute">
                  3 months {item.bundles[3]} · 6 months {item.bundles[6]} · 12 months {item.bundles[12]} JOD
                </span>
                <ul className="mt-3 space-y-1 text-sm">
                  <li>{item.listings} items · {item.listings} صنف</li>
                  <li>1 main photo + {item.images - 1} more · صورة رئيسية + {item.images - 1} إضافية</li>
                  <li>{item.helloPerDay} Hello World posts a day · {item.helloPerDay} منشورات Hello World باليوم</li>
                  <li>Descriptions up to {item.descChars} characters · وصف حتى {item.descChars} حرف</li>
                  <li>{item.options ? "✓" : "—"} Sizes, options and size chart · مقاسات وخيارات وجدول مقاسات</li>
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
          plan={plan}
          amount={PLANS[plan].price}
          onClose={() => setPayOpen(false)}
          onFree={() => {
            setPayOpen(false);
            setPlan("free");
            finish("free", null, null);
          }}
          onPaid={(choice) => {
            setPayOpen(false);
            finish(choice.plan, choice, null);
          }}
        />
      )}
    </Shell>
  );
}
