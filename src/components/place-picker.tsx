import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Link } from "@tanstack/react-router";
import { areaLabel, matchAreas, nearestArea, type AmmanArea } from "@/lib/near";

type Pin = { lat: number; lng: number; label: string };

function shortPlace(props: { name?: string; district?: string; city?: string; county?: string }) {
  const name = props.name || "";
  const area = props.district || props.city || props.county || "";
  if (!name) return area;
  if (!area || area === name) return name;
  return `${name}, ${area}`;
}

async function lookup(lat: number, lng: number, ar: boolean) {
  const near = nearestArea(lat, lng);
  if (near) return areaLabel(near, ar);
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=${ar ? "ar" : "en"}`);
    const json = await res.json();
    const props = json.features?.[0]?.properties ?? {};
    return shortPlace(props) || (ar ? "عمّان" : "Amman");
  } catch {
    return ar ? "عمّان" : "Amman";
  }
}

export function FullscreenPicker({
  onClose,
  onUse,
  initial,
}: {
  onClose: () => void;
  onUse: (pin: Pin) => void;
  initial?: { lat: number; lng: number; label?: string } | null;
}) {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const timer = useRef<number | null>(null);
  const initialRef = useRef(initial);
  const [query, setQuery] = useState("");
  const [areas, setAreas] = useState<AmmanArea[]>([]);
  const [places, setPlaces] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [label, setLabel] = useState(initial?.label || (ar ? "عمّان" : "Amman"));
  const [note, setNote] = useState("");
  const [hint, setHint] = useState(false);
  const labelRef = useRef(label);
  labelRef.current = label;

  useEffect(() => {
    document.body.classList.add("picker-open");
    try {
      if (!sessionStorage.getItem("souq-pin-hint")) {
        setHint(true);
        sessionStorage.setItem("souq-pin-hint", "1");
      }
    } catch { /* private mode */ }
    return () => document.body.classList.remove("picker-open");
  }, []);

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    let map: Leaflet.Map | null = null;
    let dead = false;
    void (async () => {
      const leaflet = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (dead || !node.current) return;
      const start = initialRef.current ?? { lat: 31.9539, lng: 35.9106 };
      map = leaflet.map(node.current, {
        zoomControl: false,
        attributionControl: true,
        minZoom: 11,
        maxZoom: 18,
        doubleClickZoom: "center",
      }).setView([start.lat, start.lng], initialRef.current ? 15 : 12);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);
      mapRef.current = map;
      const read = () => {
        const center = map!.getCenter();
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          void lookup(center.lat, center.lng, ar).then((name) => {
            setLabel(name);
            setQuery("");
          });
        }, 400);
      };
      map.on("moveend", read);
      window.setTimeout(() => map?.invalidateSize(), 80);
      void lookup(start.lat, start.lng, ar).then(setLabel);
    })();
    return () => {
      dead = true;
      if (timer.current) window.clearTimeout(timer.current);
      map?.remove();
      mapRef.current = null;
    };
  }, [ar]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setAreas([]);
      setPlaces([]);
      return;
    }
    const wait = window.setTimeout(() => {
      setAreas(matchAreas(text).slice(0, 6));
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&lat=31.95&lon=35.91&limit=6&lang=${ar ? "ar" : "en"}`;
      void fetch(url)
        .then((res) => res.json())
        .then((json) => {
          const hits = (json.features ?? [])
            .filter((feature: { properties?: { countrycode?: string } }) => String(feature.properties?.countrycode ?? "").toLowerCase() === "jo")
            .map((feature: { properties?: { name?: string; district?: string; city?: string; county?: string }; geometry?: { coordinates?: number[] } }) => ({
              name: shortPlace(feature.properties ?? {}),
              lng: feature.geometry?.coordinates?.[0] ?? 0,
              lat: feature.geometry?.coordinates?.[1] ?? 0,
            }))
            .filter((hit: { name: string }) => hit.name);
          setPlaces(hits.slice(0, 6));
        })
        .catch(() => setPlaces([]));
    }, 250);
    return () => window.clearTimeout(wait);
  }, [query, ar]);

  function fly(lat: number, lng: number, zoom: number, name: string) {
    setLabel(name);
    setQuery("");
    setAreas([]);
    setPlaces([]);
    mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.6 });
  }

  function locate() {
    setNote("");
    if (!navigator.geolocation) {
      setNote(ar ? "الموقع مطفي. ابحث أو حرّك الخريطة." : "Location is off. Search or move the map.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (geo) => {
        const lat = geo.coords.latitude;
        const lng = geo.coords.longitude;
        mapRef.current?.flyTo([lat, lng], 16, { duration: 0.6 });
        void lookup(lat, lng, ar).then(setLabel);
      },
      () => setNote(ar ? "الموقع مطفي. ابحث أو حرّك الخريطة." : "Location is off. Search or move the map."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  function useHere() {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    onUse({ lat: center.lat, lng: center.lng, label: labelRef.current });
  }

  const searching = query.trim().length >= 2;

  return (
    <div className="place-picker" role="dialog" aria-modal="true" aria-label={ar ? "اختر منطقتك" : "Choose your area"}>
      <div className="place-picker-card">
        <div className="place-top">
          <button type="button" className="place-back" onClick={onClose} aria-label={ar ? "رجوع" : "Back"}>‹</button>
          <input
            value={query}
            placeholder={ar ? "ابحث عن حي" : "Search a neighbourhood"}
            aria-label={ar ? "ابحث عن حي" : "Search a neighbourhood"}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="place-map-wrap">
          <div ref={node} className="place-map" />
          <span className="place-pin" aria-hidden="true" />
          <button type="button" className="place-locate" onClick={locate}>{ar ? "موقعي" : "Use my location"}</button>
          <div className="place-zoom">
            <button type="button" aria-label={ar ? "تكبير" : "Zoom in"} onClick={() => mapRef.current?.zoomIn()}>+</button>
            <button type="button" aria-label={ar ? "تصغير" : "Zoom out"} onClick={() => mapRef.current?.zoomOut()}>−</button>
          </div>
          {hint && <p className="place-hint">Move the map to place the pin · حرّك الخريطة لتحريك الدبوس</p>}
          {searching && (
            <div className="place-results">
              <button type="button" onClick={locate}>{ar ? "موقعي" : "Use my location"}</button>
              {areas.length > 0 && <p>{ar ? "أحياء" : "Neighbourhoods"}</p>}
              {areas.map((area) => (
                <button key={area.en} type="button" onClick={() => fly(area.lat, area.lng, 15, areaLabel(area, ar))}>
                  {areaLabel(area, ar)}
                </button>
              ))}
              {places.length > 0 && <p>{ar ? "أماكن" : "Places"}</p>}
              {places.map((place) => (
                <button key={`${place.lat}-${place.lng}-${place.name}`} type="button" onClick={() => fly(place.lat, place.lng, 17, place.name)}>
                  {place.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="place-card">
          {note && <p className="place-note">{note}</p>}
          <b>{label}</b>
          <span>{ar ? "المنطقة فقط، مش باب بيتك بالضبط" : "Area only, not your exact door"}</span>
          <button type="button" className="place-use" onClick={useHere}>{ar ? "استخدم هذا الموقع" : "Use this location"}</button>
        </div>
      </div>
    </div>
  );
}

export function SavePlaceSheet({
  pin,
  startName,
  id,
  onClose,
  onDone,
}: {
  pin: Pin;
  startName?: string;
  id?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const user = useSession((s) => s.user);
  const addresses = useSession((s) => s.addresses);
  const addAddress = useSession((s) => s.addAddress);
  const updateAddress = useSession((s) => s.updateAddress);
  const known = startName === "Home" || startName === "Work" ? startName : startName ? "Other" : "";
  const [kind, setKind] = useState<"Home" | "Work" | "Other" | "">(known as "Home" | "Work" | "Other" | "");
  const [other, setOther] = useState(known === "Other" ? startName ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(false);
  const editing = addresses.find((item: { name: string }) => item.name === startName);
  const name = kind === "Other" ? other.trim() : kind;
  if (!user) {
    return (
      <div className="place-save" role="dialog" aria-modal="true">
        <div className="place-save-card">
          <Link to="/sign-in">{ar ? "سجّل دخولك لتحفظ أماكنك" : "Log in to save places"}</Link>
          <button type="button" onClick={onClose}>{ar ? "مش الآن" : "Not now"}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="place-save" role="dialog" aria-modal="true">
      <form
        className="place-save-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name || name.length > 30 || busy) return;
          if (!editing && addresses.length >= 10) {
            setLimit(true);
            return;
          }
          setBusy(true);
          const same = addresses.find((item: { id: string; name: string }) => item.name === name);
          const job = id
            ? updateAddress(id, name, pin.label, pin.lat, pin.lng)
            : same
              ? updateAddress(same.id, name, pin.label, pin.lat, pin.lng)
              : addAddress(name, pin.label, pin.lat, pin.lng);
          void Promise.resolve(job).then((id: string | undefined) => {
            setBusy(false);
            if (id === "") {
              setLimit(true);
              return;
            }
            onDone();
          });
        }}
      >
        <h3>{ar ? "احفظ المكان؟" : "Save this place?"}</h3>
        <div className="place-kinds">
          {(["Home", "Work", "Other"] as const).map((item) => (
            <button key={item} type="button" className={kind === item ? "is-on" : ""} onClick={() => setKind(item)}>
              {item === "Home" ? "Home · البيت" : item === "Work" ? "Work · الشغل" : "Other · غير"}
            </button>
          ))}
        </div>
        {kind === "Other" && (
          <input value={other} maxLength={30} placeholder={ar ? "الاسم" : "Name"} aria-label={ar ? "الاسم" : "Name"} onChange={(event) => setOther(event.target.value)} />
        )}
        {limit && <p className="place-note">{ar ? "عشرة أماكن بالكثير" : "10 places is the limit"}</p>}
        <p className="place-private">{ar ? "أماكنك المحفوظة ما بيشوفها غيرك" : "Only you can see your saved places"}</p>
        <div className="place-save-row">
          <button type="submit" disabled={!name || busy}>{ar ? "احفظ" : "Save"}</button>
          <button type="button" onClick={onClose}>{ar ? "مش الآن" : "Not now"}</button>
        </div>
      </form>
    </div>
  );
}
