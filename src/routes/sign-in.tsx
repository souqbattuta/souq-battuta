import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { isValidArabPhone, useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { cn } from "@/lib/cn";
import { OptImg } from "@/components/opt-img";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "/home",
    ...(s.role === "seller" ? { role: "seller" as const } : {}),
  }),
  search: { middlewares: [stripSearchParams({ next: "/home" })] },
  component: SignInPage,
});

function SignInPage() {
  const { next, role: roleSearch } = Route.useSearch();
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const signIn = useSession((s) => s.signIn);
  const navigate = useNavigate();
  const [role, setRole] = useState<"buyer" | "seller">(roleSearch === "seller" || next === "/seller" ? "seller" : "buyer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  function goNext() {
    if (role === "seller") {
      if (next === "/sell") void navigate({ to: "/sell" });
      else void navigate({ to: "/seller", search: { item: "", tab: "analytics", order: "", note: "" } });
      return;
    }
    if (next.startsWith("/shop/")) {
      const slug = next.split("/")[2] ?? "";
      void navigate({ to: "/shop/$slug", params: { slug } });
    } else if (next === "/sell") {
      void navigate({ to: "/sell" });
    } else if (next === "/seller") {
      void navigate({ to: "/seller", search: { item: "", tab: "analytics", order: "", note: "" } });
    } else if (next === "/account") {
      void navigate({ to: "/account", search: { tab: "", note: "" } });
    } else {
      void navigate({ to: "/home" });
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone") ?? "");
    const password = String(fd.get("password") ?? "");
    if (!isValidArabPhone(phone)) {
      setError(t.invalidPhone);
      return;
    }
    setLoading(true);
    let res: Awaited<ReturnType<typeof signIn>>;
    try {
      res = await signIn(phone, password, role);
    } catch {
      setLoading(false);
      setError(lang === "ar" ? "ما قدرنا نسجل الدخول. حدّث الصفحة وحاول مرة ثانية." : "Could not sign in. Refresh the page and try again.");
      return;
    }
    setLoading(false);
    if (!res.ok) {
      setError(res.error === "phone" ? t.invalidPhone : res.error === "notSeller" ? t.notSeller : res.error === "notBuyer" ? t.notBuyer : res.error === "password" ? t.wrongPass : t.shortPass);
      return;
    }
    if (fd.get("remember")) sessionStorage.removeItem("souq-ephemeral");
    else sessionStorage.setItem("souq-ephemeral", "1");
    goNext();
  }

  return (
    <Shell>
      <main className="login-split">
        <aside className="login-aside">
          <OptImg src="/brand/login-collage.jpg" alt="" className="login-collage-img" eager />
        </aside>

        <section className="login-panel">
          <div className="login-card">
            <h1 className="font-display text-3xl text-ink">{role === "seller" ? t.sellerLogin : t.signIn}</h1>
            <div className="login-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={role === "buyer"}
                onClick={() => {
                  setRole("buyer");
                  setError("");
                }}
              >
                {t.buyers}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={role === "seller"}
                onClick={() => {
                  setRole("seller");
                  setError("");
                }}
              >
                {t.sellers}
              </button>
            </div>
            {role === "seller" && <p className="text-sm text-mute">{t.sellerLoginNote}</p>}
            <form className="space-y-3" action="javascript:void(0)" onSubmit={onSubmit}>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">{t.phone}</span>
                <input
                  name="phone"
                  autoComplete="username"
                  inputMode="tel"
                  className="h-12 w-full rounded-md border border-line bg-white px-3"
                  placeholder="+962 79… or +966 5…"
                  required
                />
                {role === "seller" && <span className="mt-1 block text-xs font-normal text-mute">{t.phoneHint}</span>}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">{t.password}</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-md border border-line bg-white px-3"
                  required
                />
              </label>
              {error && (
                <p className="rounded-md bg-red/10 px-3 py-2 text-sm text-red" role="alert">
                  {error}
                </p>
              )}
              <label className="flex items-center gap-2 text-sm text-ink">
                <input name="remember" type="checkbox" defaultChecked className="size-4 accent-ink" />
                {t.keepLogged}
              </label>
              <button
                type="submit"
                disabled={!ready || loading}
                className="h-12 w-full rounded-md bg-ink font-semibold text-cream disabled:opacity-60"
              >
                {loading ? "…" : t.signIn}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-mute">
              <Link to="/join" search={{ intent: "buyer" }} className={cn("font-semibold text-ink underline")}>
                {t.createAccount}
              </Link>
            </p>
          </div>
        </section>
      </main>
    </Shell>
  );
}
