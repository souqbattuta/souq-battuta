import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { geocoders as GeocoderNs } from "leaflet-control-geocoder";
import { copy } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Hit = { name: string; lat: number; lng: number; zoom: number };
type Coder = InstanceType<typeof GeocoderNs.Photon>;

function zoomFor(kind: string) {
  if (["house", "building", "address", "apartments", "residential", "yes"].includes(kind)) return 19;
  if (["street", "road", "neighbourhood", "suburb", "quarter"].includes(kind)) return 18;
  return 16;
}

export function LocationPicker({
  onPick,
  searchLabel,
  locateLabel,
  hint,
  mode = "exact",
  guided = false,
  bare = false,
  initial = null,
}: {
  onPick: (lat: number, lng: number, label?: string) => void;
  searchLabel: string;
  locateLabel: string;
  hint: string;
  mode?: "exact" | "area";
  guided?: boolean;
  bare?: boolean;
  initial?: { lat: number; lng: number; label?: string } | null;
}) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markerRef = useRef<Leaflet.Marker | null>(null);
  const iconRef = useRef<Leaflet.DivIcon | null>(null);
  const circleRef = useRef<Leaflet.Circle | null>(null);
  const libRef = useRef<typeof Leaflet | null>(null);
  const coderRef = useRef<Coder | null>(null);
  const watchRef = useRef<number | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const area = mode === "area";
  const areaRef = useRef(area);
  areaRef.current = area;
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [note, setNote] = useState("");
  const [mapOn, setMapOn] = useState(!guided || bare);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(initial?.label ?? "");
  const [coderOn, setCoderOn] = useState(false);
  const skipQuery = useRef("");
  const guidedRef = useRef(guided);
  guidedRef.current = guided;
  const bareRef = useRef(bare);
  bareRef.current = bare;
  const targetRef = useRef<{ lat: number; lng: number; zoom: number } | null>(
    initial ? { lat: initial.lat, lng: initial.lng, zoom: 18 } : null,
  );
  const initialLabelRef = useRef(initial?.label);

  function ensureMarker(lat: number, lng: number) {
    const leaflet = libRef.current;
    const map = mapRef.current;
    const icon = iconRef.current;
    if (!leaflet || !map || !icon) return;
    if (!markerRef.current) {
      const marker = leaflet.marker([lat, lng], { draggable: true, icon, alt: "Map marker" }).addTo(map);
      marker.on("dragend", () => {
        const next = marker.getLatLng();
        onPickRef.current(next.lat, next.lng);
        void labelPin(next.lat, next.lng);
      });
      markerRef.current = marker;
      return;
    }
    markerRef.current.setLatLng([lat, lng]);
  }

  function place(lat: number, lng: number, zoom?: number, label?: string) {
    if (zoom != null) targetRef.current = { lat, lng, zoom };
    if (label) setFound(label);
    ensureMarker(lat, lng);
    const map = mapRef.current;
    if (zoom != null && map) {
      map.invalidateSize();
      map.flyTo([lat, lng], areaRef.current ? Math.min(zoom, 14) : zoom, { duration: 0.6 });
    }
    onPickRef.current(lat, lng, label);
  }

  async function labelPin(lat: number, lng: number) {
    try {
      const found = await coderRef.current?.reverse({ lat, lng }, 18);
      const name = found?.[0]?.name;
      if (name) {
        setFound(name);
        onPickRef.current(lat, lng, name);
      }
    } catch {
      /* coordinates still save */
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { geocoders } = await import("leaflet-control-geocoder");
      if (cancelled) return;
      coderRef.current = new geocoders.Photon({
        geocodingQueryParams: { lat: 31.9539, lon: 35.9106, limit: 6, lang: "en" },
      });
      setCoderOn(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = node.current;
    if (!el || typeof window === "undefined" || !mapOn) return;
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    void (async () => {
      const leaflet = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      const { geocoders } = await import("leaflet-control-geocoder");
      if (cancelled || !node.current) return;
      libRef.current = leaflet;
      coderRef.current = new geocoders.Photon({
        geocodingQueryParams: { lat: 31.9539, lon: 35.9106, limit: 6, lang: "en" },
      });
      const pin = leaflet.divIcon({
        className: "map-pin",
        html: `<span role="img" aria-label="Map marker" style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#128c7e;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      iconRef.current = pin;
      const start = targetRef.current ?? { lat: 31.9539, lng: 35.9106, zoom: areaRef.current ? 12 : 13 };
      map = leaflet.map(node.current).setView([start.lat, start.lng], start.zoom);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      const holdPin = bareRef.current && !targetRef.current;
      if (!holdPin) {
        const marker = leaflet.marker([start.lat, start.lng], { draggable: true, icon: pin, alt: "Map marker" }).addTo(map);
        markerRef.current = marker;
        marker.on("dragend", () => {
          const next = marker.getLatLng();
          onPickRef.current(next.lat, next.lng);
          void labelPin(next.lat, next.lng);
        });
        if (!guidedRef.current && !bareRef.current) onPickRef.current(start.lat, start.lng);
        if (bareRef.current && targetRef.current) onPickRef.current(start.lat, start.lng, initialLabelRef.current);
      }
      map.on("click", (event: Leaflet.LeafletMouseEvent) => {
        ensureMarker(event.latlng.lat, event.latlng.lng);
        onPickRef.current(event.latlng.lat, event.latlng.lng);
        void labelPin(event.latlng.lat, event.latlng.lng);
      });
      window.setTimeout(() => map?.invalidateSize(), 120);
    })();
    return () => {
      cancelled = true;
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [mapOn]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3 || text === skipQuery.current) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const coder = coderRef.current;
      if (!coder) return;
      void coder
        .geocode(text, mapRef.current ? { map: mapRef.current } : undefined)
        .then((results) => {
          const local = results.filter((result) => result.properties?.countrycode === "jo");
          const list = (local.length ? local : results).slice(0, 6);
          setHits(
            list.map((result) => ({
              name: result.name,
              lat: result.center.lat,
              lng: result.center.lng,
              zoom: zoomFor(String(result.properties?.osm_value ?? result.properties?.type ?? "")),
            })),
          );
        })
        .catch(() => setHits([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, coderOn]);

  function locate() {
    setNote("");
    const leaflet = libRef.current;
    if (!navigator.geolocation || !leaflet) {
      setNote("Location is not available on this device.");
      return;
    }
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    let best = Infinity;
    watchRef.current = navigator.geolocation.watchPosition(
      (geo) => {
        const acc = geo.coords.accuracy;
        if (acc > best) return;
        best = acc;
        const lat = geo.coords.latitude;
        const lng = geo.coords.longitude;
        place(lat, lng, areaRef.current ? 14 : acc <= 25 ? 19 : 18);
        const map = mapRef.current;
        if (map && !areaRef.current) {
          if (!circleRef.current) {
            circleRef.current = leaflet.circle([lat, lng], {
              radius: acc,
              color: "#128c7e",
              weight: 1,
              fillColor: "#128c7e",
              fillOpacity: 0.12,
            }).addTo(map);
          } else {
            circleRef.current.setLatLng([lat, lng]);
            circleRef.current.setRadius(acc);
          }
        }
        setNote(
          areaRef.current
            ? "Area only. This is not your exact door."
            : `Within ${Math.round(acc)} m. Drag the pin if the building is wrong.`,
        );
        if (acc <= 20 && watchRef.current != null) {
          navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
        void labelPin(lat, lng);
      },
      () => setNote("Allow location, then drag the pin onto the right building."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    window.setTimeout(() => {
      if (watchRef.current == null) return;
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }, 8000);
  }

  function chooseHit(hit: Hit) {
    targetRef.current = { lat: hit.lat, lng: hit.lng, zoom: hit.zoom };
    setFound(hit.name);
    setMapOn(true);
    setSearching(false);
    setHits([]);
    skipQuery.current = hit.name;
    setQuery(hit.name);
    window.setTimeout(() => place(hit.lat, hit.lng, hit.zoom, hit.name), 80);
  }

  function askHere() {
    setSearching(false);
    setMapOn(true);
    window.setTimeout(() => locate(), 80);
  }

  if (guided) {
    return (
      <div>
        <div className={bare ? "loc-actions is-navy" : "loc-actions"}>
          <button type="button" onClick={askHere}>{locateLabel}</button>
          <button type="button" className={searching ? "is-on" : ""} onClick={() => setSearching((open) => !open)}>{searchLabel}</button>
        </div>
        {searching && (
          <>
            <div className="loc-bar">
              <input
                value={query}
                placeholder={searchLabel}
                aria-label={searchLabel}
                onChange={(event) => {
                  skipQuery.current = "";
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
            </div>
            {hits.length > 0 && (
              <div className="loc-results">
                {hits.map((hit) => (
                  <button key={`${hit.lat}-${hit.lng}-${hit.name}`} type="button" onClick={() => chooseHit(hit)}>
                    {hit.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {mapOn && <div ref={node} className="loc-map is-sheet" />}
        {bare ? (
          <div className="loc-address" aria-live="polite">{found}</div>
        ) : (
          mapOn && <p className="mt-2 text-xs text-mute">{found ? `${found}. ${hint}` : hint}</p>
        )}
        {note && !bare && <p className="text-xs text-mute">{note}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="loc-bar">
        <input
          value={query}
          placeholder={searchLabel}
          aria-label={searchLabel}
          onChange={(event) => {
            skipQuery.current = "";
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
        />
        <button type="button" className="loc-here" onClick={locate}>
          {locateLabel}
        </button>
      </div>
      {hits.length > 0 && (
        <div className="loc-results">
          {hits.map((hit) => (
            <button
              key={`${hit.lat}-${hit.lng}-${hit.name}`}
              type="button"
              onClick={() => {
                place(hit.lat, hit.lng, hit.zoom, hit.name);
                skipQuery.current = hit.name;
                setQuery(hit.name);
                setHits([]);
              }}
            >
              {hit.name}
            </button>
          ))}
        </div>
      )}
      <div ref={node} className="loc-map" />
      <p className="mt-2 text-xs text-mute">{hint}</p>
      {note && <p className="text-xs text-mute">{note}</p>}
    </div>
  );
}

export function AddressDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const addAddress = useSession((s) => s.addAddress);
  const [name, setName] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  function close() {
    setName("");
    setPin(null);
    onClose();
  }
  if (!open) return null;
  const ready = Boolean(name.trim() && pin);
  return (
    <div className="list-modal" onClick={close}>
      <form
        className="address-sheet"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!pin || !name.trim()) return;
          const id = addAddress(name, pin.label || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`, pin.lat, pin.lng);
          if (id) onSaved?.(id);
          setName("");
          setPin(null);
          onClose();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-xl">{t.addAddress}</h3>
          <button type="button" className="size-10 text-xl" aria-label={t.back} onClick={close}>×</button>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          {t.namePlace}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.nameExample}
            aria-label={t.namePlace}
            className="h-11 rounded-md border border-line bg-white px-3 text-sm font-normal"
            required
          />
        </label>
        <LocationPicker
          guided
          searchLabel={t.searchAction}
          locateLabel={t.useWhere}
          hint={t.dragPin}
          onPick={(lat, lng, label) => setPin((prev) => ({ lat, lng, label: label ?? prev?.label }))}
        />
        <button type="submit" className="address-save" disabled={!ready}>{t.savePlace}</button>
      </form>
    </div>
  );
}
