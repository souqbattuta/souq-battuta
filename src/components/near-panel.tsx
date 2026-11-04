import { useMemo, useState } from "react";
import type { Shop } from "@/lib/data";
import { nearest } from "@/lib/near";
import { useSession } from "@/lib/session";
import { LocationPicker } from "@/components/location-picker";
import { ShopShelf } from "@/components/shop-shelf";

type Pin = { lat: number; lng: number; label?: string };

export function NearPanel({ shops, ar, shelf = "near", windowed = false }: { shops: Shop[]; ar: boolean; shelf?: string; windowed?: boolean }) {
  const addresses = useSession((s) => s.addresses);
  const saved = addresses.filter((item) => item.lat != null && item.lng != null);
  const [mode, setMode] = useState<"saved" | "pin">(saved.length ? "saved" : "pin");
  const [savedId, setSavedId] = useState(saved[0]?.id ?? "");
  const [here, setHere] = useState<Pin | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [gpsNote, setGpsNote] = useState("");

  const chosen = saved.find((item) => item.id === savedId) ?? saved[0];
  const origin: Pin | null =
    mode === "pin" ? pin : chosen ? { lat: chosen.lat!, lng: chosen.lng!, label: chosen.name } : here;

  const ranked = useMemo(() => (origin ? nearest(shops, origin) : []), [shops, origin?.lat, origin?.lng]);
  const distances = Object.fromEntries(ranked.map((item) => [item.shop.slug, item.km]));

  function useHere() {
    setGpsNote("");
    if (!navigator.geolocation) {
      setGpsNote(ar ? "الموقع غير متاح على هذا الجهاز." : "Location is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (geo) => {
        setHere({ lat: geo.coords.latitude, lng: geo.coords.longitude, label: ar ? "موقعي الآن" : "Where I am" });
        setGpsNote("");
      },
      () => setGpsNote(ar ? "اسمح بالموقع، أو ثبّت مكاناً جديداً." : "Allow location, or drop a new pin."),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  return (
    <div className="near-panel">
      <div className="near-modes" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "saved"} className={mode === "saved" ? "cat-pick is-on" : "cat-pick"} onClick={() => setMode("saved")}>
          <b>{ar ? "موقعي" : "My location"}</b>
        </button>
        <button type="button" role="tab" aria-selected={mode === "pin"} className={mode === "pin" ? "cat-pick is-on" : "cat-pick"} onClick={() => setMode("pin")}>
          <b>{ar ? "مكان جديد" : "New location"}</b>
        </button>
      </div>

      {mode === "saved" ? (
        <div className="near-saved">
          {saved.length > 1 && (
            <label>
              <span>{ar ? "العنوان المحفوظ" : "Saved address"}</span>
              <select value={chosen?.id ?? ""} onChange={(event) => setSavedId(event.target.value)}>
                {saved.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          )}
          {saved.length === 1 && <p className="home-note">{chosen?.name} · {chosen?.line}</p>}
          {saved.length === 0 && (
            <p className="home-note">{ar ? "ما في عنوان محفوظ. استخدم مكانك الآن، أو ثبّت مكاناً جديداً." : "No saved address. Use where you are, or drop a new pin."}</p>
          )}
          <button type="button" className="near-here" onClick={useHere}>{ar ? "موقعي الآن" : "Where I am now"}</button>
          {gpsNote && <p className="home-note">{gpsNote}</p>}
        </div>
      ) : (
        <LocationPicker
          mode="area"
          searchLabel={ar ? "ابحث عن المكان" : "Search a place"}
          locateLabel={ar ? "موقعي الآن" : "Where I am"}
          hint={ar ? "ثبّت الدبوس. ما ينحفظ على ملفك." : "Drop the pin. This is not saved on your profile."}
          onPick={(lat, lng, label) => setPin({ lat, lng, label })}
        />
      )}

      {!origin ? (
        <p className="home-note">{ar ? "اختَر مكاناً لترى القريب." : "Choose a place to see what is close."}</p>
      ) : ranked.length === 0 ? (
        <p className="home-note">{ar ? "ما في دكاكين بهالقسم بعد." : "No stalls in this aisle yet."}</p>
      ) : (
        <>
          <p className="home-shelf-note">{ar ? "الأقرب أولاً" : "Closest first"}{origin.label ? ` · ${origin.label}` : ""}</p>
          <ShopShelf id={shelf} shops={ranked.map((item) => item.shop)} ar={ar} distances={distances} windowed={windowed} />
        </>
      )}
    </div>
  );
}
