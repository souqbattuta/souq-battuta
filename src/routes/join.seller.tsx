import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { JoinForm } from "@/components/join-form";

export const Route = createFileRoute("/join/seller")({
  component: SellerJoinPage,
});

function SellerJoinPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];

  return (
    <Shell>
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <Link to="/join" search={{ intent: "seller" }} className="text-sm font-semibold text-ink underline">
          {t.back}
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-mute">{lang === "ar" ? "الخطوة ١ من ٢" : "Step 1 of 2"}</p>
        <h1 className="mt-1 font-display text-3xl text-ink">{t.sellers}</h1>
        <div className="mt-6">
          <JoinForm intent="seller" />
        </div>
      </main>
    </Shell>
  );
}
