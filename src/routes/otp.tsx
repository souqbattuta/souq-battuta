import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";

export const Route = createFileRoute("/otp")({ component: OtpPage });

function OtpPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const completeJoin = useSession((s) => s.completeJoin);
  const pending = useSession((s) => s.pending);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const otp = String(new FormData(e.currentTarget).get("otp") ?? "");
    setLoading(true);
    const res = completeJoin(otp);
    setLoading(false);
    if (!res.ok) {
      const ar = lang === "ar";
      setError(res.error === "promo" ? (ar ? "الرمز الترويجي لم يعد صالحاً." : "That promotional code is no longer valid.") : t.badOtp);
      return;
    }
    void navigate({ to: "/welcome" });
  }

  return (
    <Shell>
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <button type="button" className="mb-4 text-sm" onClick={() => history.back()}>
          ← {t.back}
        </button>
        <h1 className="font-display text-3xl">{t.otpTitle}</h1>
        <p className="mt-2 text-sm text-mute">{t.otpBody}</p>
        {pending && <p className="mt-1 text-xs text-mute">{pending.phone}</p>}
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <input
            name="otp"
            inputMode="numeric"
            maxLength={6}
            className="h-14 w-full rounded-md border border-line bg-cream text-center text-2xl tracking-[0.4em]"
            placeholder="••••••"
            required
          />
          {error && (
            <p className="text-sm text-red" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-md bg-ink font-semibold text-cream disabled:opacity-60"
          >
            {t.verify}
          </button>
        </form>
      </main>
    </Shell>
  );
}
