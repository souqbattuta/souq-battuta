import { createFileRoute, Link } from "@tanstack/react-router";
import { PLANS } from "@/lib/data";
import { useSession } from "@/lib/session";
import { Shell } from "@/components/site-header";

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
});

function WelcomePage() {
  const lang = useSession((s) => s.lang);
  const user = useSession((s) => s.user);
  const ar = lang === "ar";
  const seller = user?.role === "seller";
  const plan = seller && user.sellerPlan ? PLANS[user.sellerPlan] : null;

  if (!user) {
    return (
      <Shell>
        <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
          <Link to="/" className="font-semibold text-ink underline">
            {ar ? "الرئيسية" : "Home"}
          </Link>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="mx-auto w-full max-w-lg px-4 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mute">{ar ? "تم إنشاء الحساب" : "Account created"}</p>
        <h1 className="mt-2 font-display text-4xl text-ink">{ar ? "أهلاً بك من جديد" : "Hala Beak"}</h1>
        <p className="mt-3 font-display text-2xl text-ink">{seller ? (ar ? "دكانك جاهز." : "Your stall is ready.") : ar ? "أهلاً بك في سوق بطوطة." : "Welcome to Souq Battuta."}</p>
        <p className="mt-4 text-sm leading-relaxed text-mute">
          {seller
            ? ar
              ? "الزبون يبقى إلك. الطلبات تروح على واتسابك، وسوق بطوطة لا يأخذ من البيع. انمو على شروطك."
              : "You keep the customer. Orders go to your WhatsApp, and Souq Battuta does not take a cut of the sale. Grow on your own terms."
            : ar
              ? "اكتشف الدكاكين على كيفك. أنت تختار ما يظهر لك."
              : "Discover the stalls on your terms. You decide what shows up for you."}
        </p>
        {plan && (
          <p className="mt-4 rounded-lg border border-line bg-cream px-4 py-3 text-sm text-ink">
            <b>{ar ? plan.nameAr : plan.name}</b>
            {user.promoMonths
              ? ar
                ? ` · ${user.promoMonths} ${user.promoMonths === 1 ? "شهر" : "أشهر"} مجاناً بالرمز ${user.promoCode}`
                : ` · ${user.promoMonths} month${user.promoMonths === 1 ? "" : "s"} free with ${user.promoCode}`
              : ar
                ? " · حسابك فعّال"
                : " · your plan is active"}
          </p>
        )}
        {seller ? (
          <Link
            to="/seller"
            search={{ item: "", tab: "edit", order: "", note: "" }}
            className="mt-6 inline-flex h-12 items-center rounded-md bg-ink px-5 font-semibold text-cream hover:bg-[#152648]"
          >
            {ar ? "افتح المكتب" : "Open your desk"}
          </Link>
        ) : (
          <Link to="/home" className="mt-6 inline-flex h-12 items-center rounded-md bg-ink px-5 font-semibold text-cream hover:bg-[#152648]">
            {ar ? "ادخل السوق" : "Enter the souq"}
          </Link>
        )}
      </main>
    </Shell>
  );
}
