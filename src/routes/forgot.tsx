import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { isValidArabPhone, useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { OptImg } from "@/components/opt-img";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/souq-sync";

export const Route = createFileRoute("/forgot")({
  validateSearch: (s: Record<string, unknown>) => ({
    role: s.role === "seller" ? ("seller" as const) : ("buyer" as const),
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const { role } = Route.useSearch();
  const lang = useSession((s) => s.lang) as "en" | "ar";
  const t = copy[lang];
  const ar = lang === "ar";
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function send(nextPhone: string) {
    setError("");
    if (!isValidArabPhone(nextPhone)) {
      setError(t.invalidPhone);
      return;
    }
    setLoading(true);
    const res = await requestPasswordReset({ data: { phone: nextPhone } });
    setLoading(false);
    if (!res.ok) {
      setError(res.error === "phone" ? t.invalidPhone : t.otpRate);
      return;
    }
    setPhone(nextPhone);
    setStep("code");
    setWait(res.retryAfter || 60);
  }

  async function onPhone(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = String(new FormData(e.currentTarget).get("phone") ?? "");
    await send(next);
  }

  async function onCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("otp") ?? "");
    const password = String(fd.get("password") ?? "");
    const repeat = String(fd.get("repeat") ?? "");
    if (password !== repeat) {
      setError(t.passMatch);
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError(t.shortPass);
      return;
    }
    setLoading(true);
    const res = await confirmPasswordReset({ data: { phone, code, password } });
    setLoading(false);
    if (!res.ok) {
      setError(
        res.error === "expired"
          ? t.otpExpired
          : res.error === "attempts"
            ? t.otpAttempts
            : res.error === "rate"
              ? t.otpRate
              : res.error === "password"
                ? t.shortPass
                : t.badOtp,
      );
      return;
    }
    if (useSession.getState().user) useSession.getState().signOut();
    setStep("done");
    setError("");
  }

  return (
    <Shell>
      <main className="login-split">
        <aside className="login-aside">
          <OptImg src="/brand/login-collage.jpg" alt="" className="login-collage-img" eager />
        </aside>
        <section className="login-panel">
          <div className="login-card">
            <h1 className="font-display text-3xl text-ink">{t.forgotTitle}</h1>
            <p className="text-sm text-mute">{role === "seller" ? t.sellers : t.buyers}</p>
            {step === "phone" && (
              <form className="space-y-3" onSubmit={(event) => void onPhone(event)}>
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
                </label>
                {error && (
                  <p className="rounded-md bg-red/10 px-3 py-2 text-sm text-red" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={loading} className="h-12 w-full rounded-md bg-ink font-semibold text-cream disabled:opacity-60">
                  {loading ? "…" : ar ? "أرسل الرمز" : "Send code"}
                </button>
              </form>
            )}
            {step === "code" && (
              <form className="space-y-3" onSubmit={(event) => void onCode(event)}>
                <p className="text-sm text-mute">{t.forgotSame}</p>
                {import.meta.env.DEV && <p className="text-xs text-mute">Test code: 424242</p>}
                <input
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-14 w-full rounded-md border border-line bg-white text-center text-2xl tracking-[0.4em]"
                  placeholder="••••••"
                  required
                />
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold">{t.forgotNew}</span>
                  <input name="password" type="password" autoComplete="new-password" className="h-12 w-full rounded-md border border-line bg-white px-3" required />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold">{t.repeat}</span>
                  <input name="repeat" type="password" autoComplete="new-password" className="h-12 w-full rounded-md border border-line bg-white px-3" required />
                </label>
                {error && (
                  <p className="rounded-md bg-red/10 px-3 py-2 text-sm text-red" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={loading} className="h-12 w-full rounded-md bg-ink font-semibold text-cream disabled:opacity-60">
                  {loading ? "…" : t.verify}
                </button>
                <button
                  type="button"
                  className="text-sm font-semibold text-ink underline disabled:opacity-50"
                  disabled={wait > 0 || loading}
                  onClick={() => void send(phone)}
                >
                  {wait > 0 ? t.otpWait.replace("{s}", String(wait)) : t.otpResend}
                </button>
              </form>
            )}
            {step === "done" && <p className="text-sm text-ink">{t.forgotDone}</p>}
            <p className="mt-5 text-center text-sm text-mute">
              <Link
                to="/sign-in"
                search={role === "seller" ? { role: "seller", next: "/seller" } : { next: "/home" }}
                className="font-semibold text-ink underline"
              >
                {t.signIn}
              </Link>
            </p>
          </div>
        </section>
      </main>
    </Shell>
  );
}
