import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { isValidArabPhone, isValidUsername, usernameTaken, useSession } from "@/lib/session";
import { copy, place } from "@/lib/i18n";
import { Shell } from "@/components/site-header";

export const Route = createFileRoute("/join/buyer")({
  component: BuyerJoinPage,
});

const AREAS = ["Abdoun", "Jabal Amman", "Jabal Al Weibdeh", "Sweifieh", "Downtown", "Shmeisani", "Khalda"];

function BuyerJoinPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const startJoin = useSession((s) => s.startJoin);
  const accounts = useSession((s) => s.accounts);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const displayName = String(fd.get("displayName") ?? "");
    const username = String(fd.get("username") ?? "");
    const phone = String(fd.get("phone") ?? "");
    const password = String(fd.get("password") ?? "");
    const repeat = String(fd.get("repeat") ?? "");
    const city = String(fd.get("city") ?? "");
    const address = String(fd.get("address") ?? "");
    const referral = String(fd.get("referral") ?? "");
    if (displayName.trim().length < 2) return setError(t.displayName);
    if (!isValidUsername(username)) return setError(t.shortUser);
    if (usernameTaken(username, accounts, "")) return setError(t.usernameTaken);
    if (!isValidArabPhone(phone)) return setError(t.invalidPhone);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError(t.shortPass);
    if (password !== repeat) return setError(t.mismatch);
    if (!city) return setError(t.city);
    if (fd.get("age") !== "on" || fd.get("privacy") !== "on") return setError(t.ticks);
    setLoading(true);
    const joined = await startJoin({
      phone,
      username,
      password,
      displayName,
      city,
      address,
      referral,
      intent: "buyer",
    });
    setLoading(false);
    if (!joined.ok) {
      setError(joined.error === "unconfigured" ? t.otpUnconfigured : joined.error === "exists" ? t.needVerify : joined.error === "rate" || joined.error === "cooldown" ? t.otpRate : t.otpSend);
      return;
    }
    void navigate({ to: "/otp" });
  }

  return (
    <Shell>
      <main className="mx-auto w-full max-w-lg px-4 py-10">
        <Link to="/join" search={{ intent: "buyer" }} className="text-sm font-semibold text-ink underline">
          {t.back}
        </Link>
        <h1 className="mt-3 font-display text-3xl text-ink">{t.buyers}</h1>
        <p className="mt-1 text-sm text-mute">{t.profileHint}</p>
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <Field name="displayName" label={t.displayName} required />
          <Field name="username" label={t.username} required />
          <Field name="phone" label={t.phone} type="tel" autoComplete="tel" placeholder="+962 7X XXX XXXX" required />
          <p className="text-xs text-mute">{t.invalidPhone}</p>
          <Field name="password" label={t.password} type="password" autoComplete="new-password" required />
          <Field name="repeat" label={t.repeat} type="password" autoComplete="new-password" required />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">{t.city} *</span>
            <select name="city" className="h-12 w-full rounded-md border border-line bg-white px-3" required defaultValue="">
              <option value="" disabled>
                {t.city}
              </option>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {place(area, lang)}
                </option>
              ))}
            </select>
          </label>
          <Field name="address" label={t.address} />
          <Field name="referral" label={t.referral} placeholder="NAMOS" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="age" className="mt-1 size-4 accent-ink" />
            {t.age}
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="privacy" className="mt-1 size-4 accent-ink" />
            <span>
              {t.privacy} —{" "}
              <Link to="/privacy" className="underline">
                read
              </Link>
            </span>
          </label>
          {error && (
            <p className="rounded-md bg-red/10 px-3 py-2 text-sm text-red" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-md bg-ink font-semibold text-cream disabled:opacity-60"
          >
            {loading ? "…" : t.createAccount}
          </button>
        </form>
      </main>
    </Shell>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="h-12 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-ink"
      />
    </label>
  );
}
