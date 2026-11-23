import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Shop } from "@/lib/data";
import { nearest } from "@/lib/near";
import { useSession } from "@/lib/session";
import { LocationPicker } from "@/components/location-picker";
import { SavePlaceSheet } from "@/components/place-picker";
import { ShopShelf } from "@/components/shop-shelf";

type Pin = { lat: number; lng: number; label: string };
const VISIT = "souq-near-visit";
const LAST = "souq-last-place";

function readPin(): Pin | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = JSON.parse(sessionStorage.getItem(VISIT) || "null");
    if (raw && typeof raw.lat === "number" && typeof raw.lng === "number" && raw.label) return raw;
  } catch { /* ignore */ }
  return null;
}

function placeName(name: string) {
  if (name === "Home") return "Home · البيت";
  if (name === "Work") return "Work · الشغل";
  return name;
}

export function NearPanel({ shops, ar, shelf = "near", windowed = false }: { shops: Shop[]; ar: boolean; shelf?: string; windowed?: boolean }) {
  const user = useSession((s) => s.user);
  const addresses = useSession((s) => s.addresses);
  const saved = addresses.filter((item: { lat?: number }) => item.lat != null);
  const [origin, setOrigin] = useState<Pin | null>(null);
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState<Pin | null>(null);
  const [guestLink, setGuestLink] = useState(false);
  const signedIn = user?.role === "buyer";
  const ready = useRef(false);

  useEffect(() => {
    if (ready.current) return;
    const visit = readPin();
    if (!signedIn) {
      setOrigin(visit);
      ready.current = true;
      return;
    }
    let last = "";
    try { last = sessionStorage.getItem(LAST) || ""; } catch { /* ignore */ }
    if (!last) {
      setOrigin(visit);
      ready.current = true;
      return;
    }
    const place = saved.find((item: { id: string }) => item.id === last);
    if (!place) return;
    setOrigin({ lat: place.lat, lng: place.lng, label: place.line || place.name });
    ready.current = true;
  }, [signedIn, saved]);

  const ranked = useMemo(() => (origin ? nearest(shops, origin) : []), [shops, origin]);
  const distances = Object.fromEntries(ranked.map((item) => [item.shop.slug, item.km]));

  function choose(pin: Pin, placeId?: string) {
    setOrigin(pin);
    try {
      sessionStorage.setItem(VISIT, JSON.stringify(pin));
      if (placeId) sessionStorage.setItem(LAST, placeId);
    } catch { /* ignore */ }
  }

  return (
    <div className="near-panel">
      {!origin ? (
        <button type="button" className="near-choose" onClick={() => setPicker(true)}>
          <b>Choose your area · اختر منطقتك</b>
          <span>See shops close to you · شوف المحلات القريبة منك</span>
        </button>
      ) : (
        <div className="near-chosen">
          <button type="button" className="near-chip" onClick={() => setPicker(true)}>📍 {origin.label} ▾</button>
          {signedIn && (
            <div className="near-places">
              {saved.map((item: { id: string; name: string; line?: string; lat: number; lng: number }) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.line === origin.label || item.name === origin.label ? "is-on" : ""}
                  onClick={() => choose({ lat: item.lat, lng: item.lng, label: item.line || item.name }, item.id)}
                >
                  {placeName(item.name)}
                </button>
              ))}
              <button type="button" onClick={() => setPicker(true)}>+ {ar ? "أضف" : "Add"}</button>
            </div>
          )}
        </div>
      )}

      {origin && ranked.length > 0 && (
        <>
          <p className="home-shelf-note">{ar ? "الأقرب أولاً" : "Closest first"} · {origin.label}</p>
          <ShopShelf id={shelf} shops={ranked.map((item) => item.shop)} ar={ar} distances={distances} windowed={windowed} />
        </>
      )}

      {picker && (
        <LocationPicker
          mode="fullscreen"
          searchLabel=""
          locateLabel=""
          hint=""
          onClose={() => setPicker(false)}
          onPick={(lat, lng, label) => {
            const pin = { lat, lng, label: label || (ar ? "عمّان" : "Amman") };
            choose(pin);
            setPicker(false);
            if (signedIn) setDraft(pin);
            else setGuestLink(true);
          }}
        />
      )}
      {draft && signedIn && (
        <SavePlaceSheet pin={draft} onClose={() => setDraft(null)} onDone={() => setDraft(null)} />
      )}
      {guestLink && !signedIn && (
        <p className="home-note"><Link to="/sign-in">{ar ? "سجّل دخولك لتحفظ أماكنك" : "Log in to save places"}</Link></p>
      )}
    </div>
  );
}
