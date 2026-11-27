import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { formatJod, priceLabel, type Product, type Shop } from "@/lib/data";
import { cn } from "@/lib/cn";
import { LocationPicker } from "@/components/location-picker";
import { SavePlaceSheet } from "@/components/place-picker";

const GREET = "★★★ *Hello from Souq Battuta* ★★★";
const GREET_AR = "★★★  *هلا بيك من سوق بطوطة*  ★★★";

function centerWa(line: string, width: number) {
  const pad = Math.max(0, Math.floor((width - Array.from(line).length) / 2));
  return "\u3000".repeat(pad) + line;
}

function OrderText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap">
      {text.split("\n").map((line, index) => (
        <span key={index} className={index < 2 ? "block text-center" : "block"}>
          {index < 2 ? line.trim() : line || "\u00a0"}
        </span>
      ))}
    </div>
  );
}

type OrderLine = { product: Product; qty: number; note?: string; detail?: string; lineTotal?: number | null };
type PickedAddress = { name: string; line?: string; lat?: number; lng?: number };

export function WhatsAppCta({
  shop,
  product,
  qty = 1,
  mode,
  items,
  addressPick,
  lockAddress = false,
  deliveryFee = null,
  fulfillment = "delivery",
  preview = false,
  onEdit,
  onSent,
}: {
  shop: Shop;
  product: Product;
  qty?: number;
  mode: "inquire" | "invoice";
  items?: OrderLine[];
  addressPick?: PickedAddress | null;
  lockAddress?: boolean;
  deliveryFee?: { label: string; amount: number | null } | null;
  fulfillment?: "delivery" | "pickup";
  preview?: boolean;
  onEdit?: () => void;
  onSent?: () => void;
}) {
  const lang = useSession((s) => s.lang);
  const user = useSession((s) => s.user);
  const addresses = useSession((s) => s.addresses);
  const placeOrder = useSession((s) => s.placeOrder);
  const recordWa = useSession((s) => s.recordWa);
  const t = copy[lang];
  const [step, setStep] = useState<"idle" | "confirm" | "wa">(preview ? "confirm" : "idle");
  const [addressId, setAddressId] = useState("");
  const [live, setLive] = useState<{ lat: number; lng: number } | null>(null);
  const [locNote, setLocNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [adding, setAdding] = useState(false);
  const [fresh, setFresh] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [savePin, setSavePin] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const deliver = fulfillment !== "pickup" && shop.handoff !== "pickup";
  useEffect(() => {
    if (addressId || !addresses.length) return;
    let last = "";
    try { last = sessionStorage.getItem("souq-last-place") || ""; } catch { /* ignore */ }
    const found = addresses.find((item) => item.id === last) ?? addresses[0];
    if (found) setAddressId(found.id);
  }, [addresses, addressId]);

  if (!user) {
    return (
      <Link
        to="/sign-in"
        search={{ next: `/shop/${shop.slug}` }}
        className="inline-flex h-12 items-center justify-center rounded-md bg-wa px-5 font-semibold text-white transition hover:brightness-95 active:scale-[0.98]"
      >
        {t.loginToContact}
      </Link>
    );
  }

  const lines = (items ?? [{ product, qty }]).filter((line) => line.qty > 0);
  const itemsTotal = lines.reduce((sum, line) => {
    if (line.lineTotal != null) return sum + line.lineTotal;
    if (line.product.priceMode && line.product.priceMode !== "price") return sum;
    return sum + line.product.price * line.qty;
  }, 0);
  const grand = itemsTotal + (deliveryFee?.amount ?? 0);
  const picked = lockAddress ? addressPick : addressId === "fresh" ? null : addresses.find((item) => item.id === addressId) ?? null;
  const pin =
    addressId === "fresh" && fresh
      ? fresh
      : !lockAddress && addressId === "current"
      ? live
      : picked?.lat != null && picked.lng != null
        ? { lat: picked.lat, lng: picked.lng }
        : null;
  const mapUrl = pin ? `https://www.google.com/maps?q=${pin.lat},${pin.lng}` : "";
  const addressName = addressId === "fresh" ? fresh?.label : !lockAddress && addressId === "current" ? (lang === "ar" ? "موقعي" : "My location") : picked?.name;
  const orderText = lines
    .map((line) => {
      const label = lang === "ar" ? line.product.nameAr : line.product.name;
      const note = line.note?.trim();
      const priced = !line.product.priceMode || line.product.priceMode === "price";
      const amount = line.lineTotal != null ? formatJod(line.lineTotal) : priced ? formatJod(line.product.price * line.qty) : priceLabel(line.product, lang);
      const row = `${line.qty} × ${label}${line.detail ? ` (${line.detail})` : ""} — ${amount}`;
      return note ? `${row}\n*** ● ${note} ● ***` : row;
    })
    .join("\n");
  const feeText = deliveryFee ? (deliveryFee.amount == null ? deliveryFee.label : formatJod(deliveryFee.amount)) : "";
  const addressBody = [addressName, picked?.line, mapUrl].filter(Boolean).join("\n");
  const addressMessage =
    fulfillment === "pickup"
      ? "*Pickup*\n*استلام*"
      : addressBody
        ? `*Address:*\n*العنوان:*\n${addressBody}`
        : "";
  const orderMessage = [
    centerWa(GREET, Array.from(GREET).length),
    centerWa(GREET_AR, Array.from(GREET).length),
    `*Username:* ${user.username}`,
    `*اسم المستخدم:* ${user.username}`,
    "*Order:*",
    "*الطلب:*",
    orderText,
    ...(feeText ? [`*Delivery fees:* ${feeText}`, `*رسوم التوصيل:* ${feeText}`] : []),
    `* ✦ Total:* ${formatJod(grand)}`,
    `*المجموع:* ${formatJod(grand)} ✦`,
    ...(addressMessage ? [addressMessage] : []),
  ].join("\n");

  async function sendBoth() {
    if (sending) return;
    const win = window.open("", "_blank");
    setSending(true);
    setSendError("");
    const productName = lines.map((line) => `${line.qty} × ${line.product.name}`).join(", ");
    try {
      const res = await placeOrder({
        shopSlug: shop.slug,
        shopName: shop.name,
        productName,
        addressName,
        total: grand,
      });
      if (!res?.ok) {
        win?.close();
        setSendError(res?.error === "rate"
          ? "Too many requests, try again later · طلبات كثيرة، جرّب لاحقاً"
          : t.orderUnrecorded);
        return;
      }
      const waPhone = String(res.waPhone ?? "");
      if (!/^9627[789]\d{7}$/.test(waPhone)) {
        win?.close();
        setSendError(lang === "ar" ? "تعذر فتح واتساب. جرّب مرة ثانية." : "Couldn't open WhatsApp. Try again.");
        return;
      }
      const href = `https://wa.me/${waPhone}?text=${encodeURIComponent(orderMessage)}`;
      if (!win) {
        setSendError(lang === "ar" ? "تعذر فتح واتساب. جرّب مرة ثانية." : "Couldn't open WhatsApp. Try again.");
        return;
      }
      win.location.href = href;
      recordWa(shop.slug);
      onSent?.();
    } catch {
      win?.close();
      setSendError(t.orderUnrecorded);
    } finally {
      setSending(false);
    }
  }

  if (step === "confirm") {
    return (
      <div className="rounded-xl border border-line bg-[#ece5dd] p-4">
        <div className="space-y-2">
          <div className="rounded-md bg-[#dcf8c6] p-3 text-sm leading-relaxed text-ink shadow-sm">
            <OrderText text={orderMessage} />
          </div>
        </div>
        {deliver && !lockAddress && (
          <div className="mt-3">
            <p className="mb-1 text-sm font-semibold">{lang === "ar" ? "التوصيل إلى" : "Deliver to"}</p>
            <div className="near-places">
              {addresses.map((item) => (
                <button key={item.id} type="button" className={addressId === item.id ? "is-on" : ""} onClick={() => { setAddressId(item.id); setLive(null); try { sessionStorage.setItem("souq-last-place", item.id); } catch { /* ignore */ } }}>
                  {item.name === "Home" ? "Home · البيت" : item.name === "Work" ? "Work · الشغل" : item.name}
                </button>
              ))}
              <button type="button" onClick={() => setAdding(true)}>+ {lang === "ar" ? "أضف مكاناً" : "Add a place"}</button>
              {addresses.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setLocNote("");
                    if (!navigator.geolocation) {
                      setLocNote(lang === "ar" ? "الموقع مطفي. ابحث أو حرّك الخريطة." : "Location is off. Search or move the map.");
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (geo) => {
                        const pin = { lat: geo.coords.latitude, lng: geo.coords.longitude, label: lang === "ar" ? "موقعي" : "My location" };
                        setFresh(pin);
                        setAddressId("fresh");
                      },
                      () => setLocNote(lang === "ar" ? "الموقع مطفي. ابحث أو حرّك الخريطة." : "Location is off. Search or move the map."),
                      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
                    );
                  }}
                >
                  {lang === "ar" ? "موقعي" : "Use my location"}
                </button>
              )}
            </div>
            {locNote && <p className="mt-1 text-xs text-red">{locNote}</p>}
          </div>
        )}
        <p className="mt-3 text-sm text-ink">This goes to the shop’s own WhatsApp. · تروح الرسالة على واتساب المحل مباشرة.</p>
        {sendError && <p className="mt-2 text-sm text-red">{sendError}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="h-12 flex-1 rounded-md bg-sand font-semibold text-ink"
            onClick={() => (onEdit ? onEdit() : setStep("idle"))}
          >
            {lang === "ar" ? "عدّل الطلب" : "Edit order"}
          </button>
          {shop.hasWhatsapp !== false && (
          <button
            type="button"
            className="h-12 flex-1 rounded-md bg-wa font-semibold text-white disabled:opacity-50"
            disabled={sending}
            onClick={() => void sendBoth()}
          >
            {lang === "ar" ? "أكّد وافتح واتساب" : "Confirm & open WhatsApp"}
          </button>
          )}
        </div>
        {adding && (
          <LocationPicker
            mode="fullscreen"
            searchLabel=""
            locateLabel=""
            hint=""
            onClose={() => setAdding(false)}
            onPick={(lat, lng, label) => {
              const pin = { lat, lng, label: label || (lang === "ar" ? "عمّان" : "Amman") };
              setFresh(pin);
              setAddressId("fresh");
              setSavePin(pin);
              setAdding(false);
            }}
          />
        )}
        {savePin && (
          <SavePlaceSheet pin={savePin} onClose={() => setSavePin(null)} onDone={() => setSavePin(null)} />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStep("confirm")}
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-wa px-5 font-semibold text-white transition hover:brightness-95 active:scale-[0.98] sm:w-auto",
      )}
    >
      {mode === "invoice" ? t.confirmOrder : t.whatsapp}
    </button>
  );
}
