import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { formatJod, type Product, type Shop } from "@/lib/data";
import { cn } from "@/lib/cn";
import { OptImg } from "@/components/opt-img";

const ORDER_PHONE = "962795636663";
const GREET = "★★★ *Hala Beak from Souq Battuta* ★★★";
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

type OrderLine = { product: Product; qty: number; note?: string; detail?: string };
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
}) {
  const lang = useSession((s) => s.lang);
  const user = useSession((s) => s.user);
  const addresses = useSession((s) => s.addresses);
  const placeOrder = useSession((s) => s.placeOrder);
  const recordWa = useSession((s) => s.recordWa);
  const t = copy[lang];
  const [step, setStep] = useState<"idle" | "confirm" | "wa">("idle");
  const [addressId, setAddressId] = useState("");
  const [live, setLive] = useState<{ lat: number; lng: number } | null>(null);
  const [locNote, setLocNote] = useState("");

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
  const itemsTotal = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const grand = itemsTotal + (deliveryFee?.amount ?? 0);
  const picked = lockAddress ? addressPick : addresses.find((item) => item.id === addressId) ?? null;
  const pin =
    !lockAddress && addressId === "current"
      ? live
      : picked?.lat != null && picked.lng != null
        ? { lat: picked.lat, lng: picked.lng }
        : null;
  const mapUrl = pin ? `https://www.google.com/maps?q=${pin.lat},${pin.lng}` : "";
  const addressName = !lockAddress && addressId === "current" ? t.currentLocation : picked?.name;
  const orderText = lines
    .map((line) => {
      const label = lang === "ar" ? line.product.nameAr : line.product.name;
      const note = line.note?.trim();
      const row = mode === "inquire" ? `${label} — ${formatJod(line.product.price)}` : `${line.qty} × ${label}${line.detail ? ` (${line.detail})` : ""} — ${formatJod(line.product.price * line.qty)}`;
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
  const photos = lines.map((line) => line.product.images[0]).filter(Boolean).slice(0, 3);

  function sendBoth() {
    const phone = ORDER_PHONE;
    placeOrder({
      shopSlug: shop.slug,
      shopName: shop.name,
      productName: lines.map((line) => `${line.qty} × ${line.product.name}${line.detail ? ` (${line.detail})` : ""}`).join(", "),
      addressName,
      total: grand,
    });
    recordWa(shop.slug);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(orderMessage)}`, "_blank", "noopener");
  }

  if (step === "wa") {
    return (
      <div className="overflow-hidden rounded-lg border border-line bg-[#ece5dd]">
        <div className="flex items-center gap-2 bg-wa-deep px-3 py-2.5 text-white">
          <button type="button" className="px-2 text-lg" onClick={() => setStep("idle")} aria-label={t.back}>
            ‹
          </button>
          <OptImg src={shop.avatar} alt="" className="size-9 rounded-full object-cover" />
          <div>
            <div className="text-sm font-semibold">{shop.name}</div>
            <div className="text-[11px] opacity-80">{ORDER_PHONE}</div>
          </div>
        </div>
        <div className="p-4">
          <div className="ms-auto max-w-[86%] space-y-2">
            <div className="rounded-lg rounded-ee-sm bg-[#dcf8c6] p-3 text-sm leading-relaxed text-ink-soft shadow-sm">
              {photos.length > 0 && (
                <div className="mb-2 flex gap-1">
                  {photos.map((src) => (
                    <OptImg key={src} src={src} alt="" className="h-16 w-16 rounded-md object-cover" />
                  ))}
                </div>
              )}
              <OrderText text={orderMessage} />
            </div>
          </div>
          <p className="mt-2 text-end text-[11px] text-mute">now · not sent until they tap send</p>
          <p className="mt-4 rounded-md bg-[#fff8d5] p-3 text-xs text-[#5a4a20]">
            This is the seller’s WhatsApp. Souq is no longer in the middle. Send when you are ready.
          </p>
          <a
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-md bg-wa font-semibold text-white"
            href={`https://wa.me/${ORDER_PHONE}?text=${encodeURIComponent(orderMessage)}`}
            target="_blank"
            rel="noreferrer"
          >
            {t.openWa}
          </a>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="rounded-xl border border-line bg-[#ece5dd] p-4">
        <div className="space-y-2">
          <div className="rounded-md bg-[#dcf8c6] p-3 text-sm leading-relaxed text-ink shadow-sm">
            <OrderText text={orderMessage} />
          </div>
        </div>
        {!lockAddress && (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-semibold">{t.addAddress}</span>
            <select
              className="h-11 w-full rounded-md border border-line bg-white px-3"
              value={addressId}
              onChange={(e) => {
                const next = e.target.value;
                setAddressId(next);
                setLocNote("");
                if (next !== "current") return;
                if (!navigator.geolocation) {
                  setLocNote("Location is not available on this device.");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (geo) => setLive({ lat: geo.coords.latitude, lng: geo.coords.longitude }),
                  () => setLocNote("Allow location to add where you are."),
                  { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
                );
              }}
            >
              <option value="">{t.address}</option>
              {addresses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              <option value="current">{t.currentLocation}</option>
            </select>
            {locNote && <p className="mt-1 text-xs text-red">{locNote}</p>}
          </label>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="h-12 flex-1 rounded-md bg-sand font-semibold text-ink"
            onClick={() => setStep("idle")}
          >
            {t.editOrder}
          </button>
          <button
            type="button"
            className="h-12 flex-1 rounded-md bg-wa font-semibold text-white"
            onClick={sendBoth}
          >
            {t.sendOrder}
          </button>
        </div>
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
