import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { sendSouqOtp } from "@/lib/souq-sync";
import { readJoinPending, readSellerDraft } from "@/lib/seller-draft";

export const Route = createFileRoute("/otp")({ component: OtpPage });

function OtpPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const completeJoin = useSession((s) => s.completeJoin);
  const pending = useSession((s) => s.pending);
  const restorePending = useSession((s) => s.restorePending);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(60);
  const [held, setHeld] = useState("");
  const ar = lang === "ar";
  const phone = pending?.phone || held;

  useLayoutEffect(() => {
    const saved = readJoinPending();
    const draft = readSellerDraft();
    const next = (typeof saved?.phone === "string" && saved.phone) || draft?.phone || "";
    if (next) setHeld(next);
    if (!pending?.phone) restorePending();
  }, [pending, restorePending]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const otp = String(new FormData(e.currentTarget).get("otp") ?? "");
    setLoading(true);
    const res = await completeJoin(otp);
    setLoading(false);
    if (!res.ok) {
      setError(res.error === "expired" ? t.otpExpired : res.error === "attempts" ? t.otpAttempts : res.error === "promo" ? (ar ? "الرمز الترويجي لم يعد صالحاً." : "That promotional code is no longer valid.") : res.error === "trial" ? (ar ? "هذا الرقم استخدم التجربة المجانية. اختر خطة مدفوعة لفتح الدكان." : "This phone number has already used its free trial. Choose a paid plan to open your shop.") : t.badOtp);
      return;
    }
    void navigate({ to: "/welcome" });
  }

  async function resend() {
    if (!phone || wait > 0) return;
    setError("");
    const res = await sendSouqOtp({ data: { phone } });
    if (!res.ok) {
      if (res.retryAfter) setWait(res.retryAfter);
      setError(res.error === "rate" || res.error === "cooldown" ? t.otpRate : t.otpSend);
      return;
    }
    setWait(res.retryAfter || 60);
  }

  return (
    <Shell>
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <button type="button" className="mb-4 text-sm" onClick={() => history.back()}>
          ← {t.back}
        </button>
        <h1 className="font-display text-3xl">{t.otpTitle}</h1>
        <p className="mt-2 text-sm text-mute">{t.otpBody}</p>
        {phone ? <p className="mt-1 text-xs text-mute">{phone}</p> : <p className="mt-2 text-sm text-mute">{ar ? "ارجع للخطوة الأولى إن ضاع الرقم." : "Go back to step one if the number was lost."}</p>}
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <input
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
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
        <button type="button" className="mt-4 text-sm font-semibold text-ink underline disabled:opacity-50" disabled={wait > 0} onClick={() => void resend()}>
          {wait > 0 ? t.otpWait.replace("{s}", String(wait)) : t.otpResend}
        </button>
      </main>
    </Shell>
  );
}
