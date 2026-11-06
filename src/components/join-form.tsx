import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CATEGORIES, type CategoryId } from "@/lib/data";
import { isValidArabPhone, isValidSellerUsername, isValidUsername, normalizePhone, usernameTaken, useSession } from "@/lib/session";
import { copy, place } from "@/lib/i18n";
import { stageSouqSignup } from "@/lib/souq-sync";
import { readSellerDraft, saveSellerDraft, type SellerDraft } from "@/lib/seller-draft";
import { LocationPicker } from "@/components/location-picker";
import { OptImg } from "@/components/opt-img";

const AREAS = ["Abdoun", "Jabal Amman", "Jabal Al Weibdeh", "Sweifieh", "Downtown", "Shmeisani", "Khalda"];

export function JoinForm({ intent }: { intent: "buyer" | "seller" }) {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const t = copy[lang];
  const startJoin = useSession((s) => s.startJoin);
  const accounts = useSession((s) => s.accounts);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [draft, setDraft] = useState<SellerDraft | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (intent !== "seller") {
      setReady(true);
      return;
    }
    const saved = readSellerDraft();
    if (saved) {
      setDraft(saved);
      setCategories(saved.categories);
      if (typeof saved.areaLat === "number" && typeof saved.areaLng === "number") setPin({ lat: saved.areaLat, lng: saved.areaLng });
    }
    setReady(true);
  }, [intent]);

  function toggle(id: CategoryId) {
    setCategories((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") ?? "");
    const phone = String(fd.get("phone") ?? "");
    const password = String(fd.get("password") ?? "");
    const repeat = String(fd.get("repeat") ?? "");
    const city = String(fd.get("city") ?? "");
    const address = String(fd.get("address") ?? "");
    const displayName = String(fd.get("displayName") ?? "");
    const shopName = String(fd.get("shopName") ?? "").trim();
    const referral = String(fd.get("referral") ?? "");
    if (intent === "seller") {
      if (shopName.length < 2) return setError(ar ? "اكتب اسم الدكان." : "Enter the shop name.");
      if (!isValidSellerUsername(username)) return setError(t.sellerUserRule);
    } else if (displayName.trim().length < 2) return setError(t.displayName);
    else if (!isValidUsername(username)) return setError(t.shortUser);
    if (usernameTaken(username, accounts, "")) return setError(t.usernameTaken);
    if (!isValidArabPhone(phone)) return setError(t.invalidPhone);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError(t.shortPass);
    if (password !== repeat) return setError(t.mismatch);
    if (!city) return setError(t.city);
    if (intent === "seller" && categories.length === 0) return setError(ar ? "اختر قسماً واحداً على الأقل." : "Pick at least one aisle.");
    if (fd.get("age") !== "on" || fd.get("privacy") !== "on") return setError(t.ticks);
    setLoading(true);
    if (intent === "seller") {
      const phoneNorm = normalizePhone(phone);
      const staged = await stageSouqSignup({
        data: {
          phone: phoneNorm,
          password,
          profile: {
            username,
            displayName: shopName,
            shopName,
            city,
            address,
            intent: "seller",
            categories,
            areaLat: pin?.lat,
            areaLng: pin?.lng,
          },
        },
      });
      setLoading(false);
      if (!staged.ok) {
        setError(staged.error === "exists" ? t.usernameTaken : staged.error === "rate" ? t.otpRate : t.otpSend);
        return;
      }
      saveSellerDraft({
        phone: phoneNorm,
        username,
        shopName,
        address,
        city,
        areaLat: pin?.lat,
        areaLng: pin?.lng,
        categories,
        plan: draft?.plan,
        billingPeriod: draft?.billingPeriod,
        promoCode: draft?.promoCode,
        promoMonths: draft?.promoMonths,
      });
      void navigate({ to: "/join/seller/plan" });
      return;
    }
    const joined = await startJoin({ phone, username, password, displayName, city, address, referral, intent: "buyer" });
    setLoading(false);
    if (!joined.ok) {
      setError(joined.error === "unconfigured" ? t.otpUnconfigured : joined.error === "exists" ? t.needVerify : joined.error === "rate" || joined.error === "cooldown" ? t.otpRate : t.otpSend);
      return;
    }
    void navigate({ to: "/otp" });
  }

  if (!ready) return <p className="text-sm text-mute">{ar ? "…" : "…"}</p>;

  return (
    <form key={draft?.phone ?? intent} className="space-y-3" onSubmit={onSubmit}>
      {intent === "buyer" && <Field name="displayName" label={t.displayName} required />}
      {intent === "seller" && <Field name="shopName" label={ar ? "اسم الدكان" : "Shop name"} defaultValue={draft?.shopName} required />}
      <Field name="username" label={t.username} autoComplete="username" defaultValue={draft?.username} required />
      <Field name="phone" label={t.phone} type="tel" autoComplete="tel" placeholder="07XXXXXXXX or +9627XXXXXXXX" defaultValue={draft?.phone} required />
      <p className="text-xs text-mute">{t.invalidPhone}</p>
      <Field name="password" label={t.password} type="password" autoComplete="new-password" required />
      <Field name="repeat" label={t.repeat} type="password" autoComplete="new-password" required />
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{t.city} *</span>
        <select name="city" className="h-12 w-full rounded-md border border-line bg-white px-3" required defaultValue={draft?.city || ""}>
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
      <Field name="address" label={t.address} autoComplete="street-address" defaultValue={draft?.address} />
      {intent === "buyer" && <Field name="referral" label={t.referral} placeholder="NAMOS" />}
      {intent === "seller" && (
        <>
          <p className="text-sm font-semibold">{ar ? "الأقسام" : "Aisles"} *</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((category) => category.id !== "all").map((category) => {
              const on = categories.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={on}
                  className={on ? "flex items-center gap-2 rounded-full border border-ink bg-cream px-2 py-1 text-sm" : "flex items-center gap-2 rounded-full border border-line bg-white px-2 py-1 text-sm"}
                  onClick={() => toggle(category.id)}
                >
                  <OptImg src={category.icon} alt="" className="size-7 rounded-full object-cover" sizes="28px" />
                  <span>{ar ? category.ar : category.en}</span>
                </button>
              );
            })}
          </div>
          <LocationPicker
            mode="area"
            searchLabel={ar ? "ابحث عن المكان" : "Search a place"}
            locateLabel={ar ? "موقعي الآن" : "Where I am"}
            hint={ar ? "ثبّت الدبوس على منطقتك." : "Drop the pin on your area."}
            onPick={(lat, lng) => setPin({ lat, lng })}
          />
        </>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="age" className="mt-1 size-4 accent-ink" />
        {t.age}
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="privacy" className="mt-1 size-4 accent-ink" />
        <span>{t.privacy}</span>
      </label>
      {error && (
        <p className="rounded-md bg-red/10 px-3 py-2 text-sm text-red" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-md bg-ink font-semibold text-cream hover:bg-[#152648] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
      >
        {loading ? "…" : intent === "seller" ? (ar ? "التالي" : "Continue") : t.createAccount}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
  defaultValue,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
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
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className="h-12 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-ink"
      />
    </label>
  );
}
