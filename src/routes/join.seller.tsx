import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { JoinForm } from "@/components/join-form";
import { AnimalRule } from "@/components/animal-rule";

export const Route = createFileRoute("/join/seller")({
  component: SellerJoinPage,
});

function SellerJoinPage() {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const t = copy[lang];

  return (
    <Shell>
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <Link to="/join" search={{ intent: "seller" }} className="text-sm font-semibold text-ink underline">
          {t.back}
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-mute">{lang === "ar" ? "الخطوة ١ من ٢" : "Step 1 of 2"}</p>
        <h1 className="mt-1 font-display text-3xl text-ink">{t.sellers}</h1>
        <ol className="mt-4 space-y-2 text-sm leading-relaxed text-ink">
          <li>{ar ? "١) افتح دكانك — أضف المنتجات والصور." : "1) Open your shop — add products and photos."}</li>
          <li>{ar ? "٢) انشر Hello World اليومي — قل للمشترين ما الجديد." : "2) Publish your daily Hello World — tell buyers what’s new."}</li>
          <li>{ar ? "٣) خليهم يلاقوك — المشترون يجدونك من الأقسام والاهتمامات التي يختارونها." : "3) Get discovered — buyers find you through categories and interests they choose."}</li>
        </ol>
        <div className="mt-6 space-y-4">
          <AnimalRule ar={lang === "ar"} />
          <JoinForm intent="seller" />
        </div>
      </main>
    </Shell>
  );
}
