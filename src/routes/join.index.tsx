import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { OptImg } from "@/components/opt-img";

export const Route = createFileRoute("/join/")({
  validateSearch: (s: Record<string, unknown>) => ({
    intent: s.intent === "seller" ? ("seller" as const) : ("buyer" as const),
  }),
  search: { middlewares: [stripSearchParams({ intent: "buyer" })] },
  component: JoinPage,
});

function JoinPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];

  return (
    <Shell>
      <main className="login-split">
        <aside className="login-aside">
          <OptImg src="/brand/join-collage.jpg" alt="" className="login-collage-img" eager />
        </aside>
        <section className="login-panel">
          <div className="login-card">
            <h1 className="font-display text-3xl text-ink">{t.createAccount}</h1>
            <p className="mt-2 text-sm text-mute">{t.beginJourney}</p>
            <div className="join-choices">
              <Link to="/join/buyer" className="join-choice">
                <span className="font-display text-2xl">{t.buyers}</span>
              </Link>
              <Link to="/join/seller" className="join-choice">
                <span className="font-display text-2xl">{t.sellers}</span>
              </Link>
            </div>
            <p className="mt-5 text-center text-sm text-mute">
              {t.already}{" "}
              <Link to="/sign-in" search={{ next: "/home" }} className="font-semibold text-ink underline">
                {t.signIn}
              </Link>
            </p>
          </div>
        </section>
      </main>
    </Shell>
  );
}
