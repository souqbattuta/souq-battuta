import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PLANS, deliveryAmount, formatJod, priceLabel, type Product, type Shop } from "@/lib/data";
import { slugForSeller, useSession } from "@/lib/session";
import { copy, place } from "@/lib/i18n";
import { Crown } from "@/components/plan-stamp";
import { FramedImage } from "@/components/photo-frame";
import { DuckRating } from "@/components/duck-rating";
import { HeartIcon } from "@/components/heart";
import { AddressDialog } from "@/components/location-picker";
import { WhatsAppCta } from "@/components/wa-sheet";
import { cn } from "@/lib/cn";
import { OptImg } from "@/components/opt-img";
import { AnimalRule } from "@/components/animal-rule";
import { AnimalSaleNotice } from "@/components/animal-sale-notice";
import { photoControlName } from "@/lib/photo-label";
import { sectionsWithMatches } from "@/lib/shop-search";

function optionNote(option: { reason?: "unavailable" | "stock" | "sold"; back?: string }, ar: boolean) {
  const reason = { unavailable: ["Unavailable", "غير متاح"], stock: ["Out of stock", "نفدت الكمية"], sold: ["Sold out", "تم البيع"] }[option.reason ?? "sold"];
  const when = option.back === "soon" ? (ar ? "ترقبوا" : "Stay tuned") : option.back ? (ar ? `يرجع ${option.back}` : `Back ${option.back}`) : "";
  return `${ar ? reason[1] : reason[0]}${when ? ` · ${when}` : ""}`;
}

function useShopChrome(shop: Shop) {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const bookmarks = useSession((s) => s.bookmarks);
  const toggleBookmark = useSession((s) => s.toggleBookmark);
  const favorites = useSession((s) => s.favorites);
  const toggleFavorite = useSession((s) => s.toggleFavorite);
  const user = useSession((s) => s.user);
  const own = Boolean(user?.role === "seller" && (user.shopSlug === shop.slug || slugForSeller(user) === shop.slug));
  const seller = user?.role === "seller";
  const [active, setActive] = useState<Product | undefined>(shop.products[0]);
  const [photo, setPhoto] = useState(0);
  const [qty, setQty] = useState(1);
  const [reportOn, setReportOn] = useState(false);
  const [shot, setShot] = useState<{ src?: string; images?: string[]; index?: number; title: string; text?: string; label?: string } | null>(null);
  const images = active?.images ?? [];
  const name = lang === "ar" ? shop.nameAr : shop.name;
  const area = lang === "ar" ? shop.areaAr : shop.area;
  return {
    lang,
    t,
    name,
    area,
    active,
    setActive: (p: Product) => {
      setActive(p);
      setPhoto(0);
      setQty(1);
    },
    photo,
    setPhoto,
    images,
    qty,
    setQty,
    bookmarked: bookmarks.includes(shop.slug),
    toggleBookmark: () => toggleBookmark(shop.slug),
    fav: (id: string) => favorites.includes(id),
    toggleFavorite,
    own,
    seller,
    reportOn,
    setReportOn,
    shot,
    setShot,
  };
}

function BookmarkIcon({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 4h10a1 1 0 0 1 1 1v16l-6-3.5L6 21V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3v18" />
      <path d="M6 4h12l-2.5 4L18 12H6" />
    </svg>
  );
}

const actionBtn = "inline-flex h-11 items-center gap-1.5 rounded-md border border-sand-dark bg-sand px-3 text-sm text-ink";

function publicShopUrl(slug: string) {
  return new URL(`/shop/${slug}`, window.location.origin).href;
}

function WhatsAppMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      />
    </svg>
  );
}

function ShareStall({ title, slug, label, copiedLabel }: { title: string; slug: string; label: string; copiedLabel: string }) {
  const lang = useSession((s) => s.lang);
  const noteShare = useSession((s) => s.noteShare);
  const t = copy[lang];
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function copyLink() {
    const url = publicShopUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.top = "0";
      field.style.left = "0";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.focus();
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    noteShare(slug);
    window.setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 900);
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${title}\n${typeof window === "undefined" ? `/shop/${slug}` : publicShopUrl(slug)}`)}`;

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={actionBtn} aria-expanded={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="6" cy="12" r="2.2" />
          <circle cx="17" cy="7" r="2.2" />
          <circle cx="17" cy="17" r="2.2" />
          <path d="M8 11.1 14.8 8.1M8 12.9l6.8 3" />
        </svg>
        {label}
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-56 rounded-xl border border-line bg-cream p-2 shadow-md">
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center gap-2 rounded-md px-3 text-sm text-ink hover:bg-sand"
            onClick={() => {
              noteShare(slug);
              setOpen(false);
            }}
          >
            <WhatsAppMark />
            {t.shareWhatsapp}
          </a>
          <button type="button" className="flex h-11 w-full items-center gap-2 rounded-md px-3 text-sm text-ink hover:bg-sand" onClick={() => void copyLink()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5" />
              <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.41a5 5 0 0 0 7.07 7.07L14 19" />
            </svg>
            {copied ? copiedLabel : t.copyLink}
          </button>
        </div>
      )}
    </div>
  );
}

function SellerNameNote({ slug }: { slug: string }) {
  const lang = useSession((s) => s.lang);
  const accounts = useSession((s) => s.accounts);
  const t = copy[lang];
  const owner = Object.values(accounts).find((account) => account.role === "seller" && account.shopSlug === slug);
  const changes = owner?.usernameChanges ?? [];
  if (!changes.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs italic text-mute">
      {changes.map((change) => (
        <li key={change.at}>
          {t.usernameChanged} · {new Date(change.at).toLocaleDateString(lang === "ar" ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" })} · {change.name}
        </li>
      ))}
    </ul>
  );
}

function menuGroups(products: Shop["products"]) {
  const buckets = new Map<string, { key: string; title: string; titleAr: string; items: Shop["products"] }>();
  for (const product of products) {
    const raw = (product.group || "").trim();
    const key = raw.toLocaleLowerCase();
    const current = buckets.get(key);
    if (!current) {
      buckets.set(key, {
        key: key || "menu",
        title: raw,
        titleAr: (product.groupAr || "").trim(),
        items: [product],
      });
      continue;
    }
    current.items.push(product);
    if (raw && preferredLabel(raw, current.title) === raw) current.title = raw;
    const arabic = (product.groupAr || "").trim();
    if (arabic && !current.titleAr) current.titleAr = arabic;
  }
  const groups = [...buckets.values()];
  if (groups.length === 1 && !groups[0].title) return [{ key: "", title: "", titleAr: "", items: products }];
  return groups.map((group) => ({
    ...group,
    title: group.title || "Menu",
    titleAr: group.titleAr || (group.title ? group.title : "القائمة"),
  }));
}

function preferredLabel(next: string, current: string) {
  const score = (value: string) => [...value].filter((letter) => letter !== letter.toLocaleLowerCase()).length;
  return score(next) > score(current) ? next : current;
}

function SectionTabs({
  groups,
  active,
  onPick,
  lang,
}: {
  groups: { key: string; title: string; titleAr: string }[];
  active: string;
  onPick: (key: string) => void;
  lang: "en" | "ar";
}) {
  const named = groups.filter((group) => group.title && group.title !== "Menu");
  if (named.length === 0) return null;
  return (
    <div className="shop-section-tabs mt-4 flex gap-1 overflow-x-auto" role="tablist">
      <button type="button" role="tab" aria-selected={!active} className={cn("h-10 shrink-0 rounded-lg px-4 text-sm font-semibold", !active ? "bg-ink text-cream" : "bg-cream text-ink")} onClick={() => onPick("")}>
        {lang === "ar" ? "الكل" : "ALL"}
      </button>
      {named.map((group) => (
        <button
          key={group.key}
          type="button"
          role="tab"
          aria-selected={active === group.key}
          className={cn("h-10 shrink-0 rounded-lg px-4 text-sm font-semibold tracking-wide", active === group.key ? "bg-ink text-cream" : "bg-cream text-ink")}
          onClick={() => onPick(group.key)}
        >
          {lang === "ar" ? group.titleAr || group.title : group.title.toLocaleUpperCase()}
        </button>
      ))}
    </div>
  );
}

function pauseText(product: Product, lang: "en" | "ar") {
  if (!product.paused) return "";
  const reason =
    product.hideReason === "stock"
      ? lang === "ar" ? "نفدت الكمية" : "Out of stock"
      : product.hideReason === "sold"
        ? lang === "ar" ? "تم البيع" : "Sold out"
        : lang === "ar" ? "غير متاح" : "Unavailable";
  const back = product.hideBack === "soon" ? (lang === "ar" ? "يرجع قريب" : "Back soon") : product.hideBack || "";
  return back ? `${reason} · ${back}` : reason;
}

function choiceLabel(product: Product, picks: number[] | undefined, lang: "en" | "ar") {
  if (!picks?.length) return "";
  return (product.choices ?? [])
    .map((choice, index) => {
      const option = choice.options[picks[index] ?? -1];
      if (!option || option.off) return "";
      return lang === "ar" ? option.ar || option.en : option.en;
    })
    .filter(Boolean)
    .join(", ");
}

function choiceExtra(product: Product, picks: number[] | undefined) {
  return (product.choices ?? []).reduce((sum, choice, index) => {
    const option = choice.options[picks?.[index] ?? -1];
    return sum + (option && !option.off ? option.extra || 0 : 0);
  }, 0);
}

function defaultPicks(product: Product) {
  return (product.choices ?? []).map((choice) => choice.options.findIndex((option) => !option.off));
}

function picksReady(product: Product, picks: number[]) {
  return (product.choices ?? []).every((choice, index) => {
    const option = choice.options[picks[index] ?? -1];
    return Boolean(option && !option.off);
  });
}

function StallNote({ shop, lang }: { shop: Shop; lang: "en" | "ar" }) {
  const note = shop.isOpen === false
    ? lang === "ar" ? shop.closedNoteAr || shop.closedNote : shop.closedNote || shop.closedNoteAr
    : lang === "ar" ? shop.openNoteAr || shop.openNote : shop.openNote || shop.openNoteAr;
  if (!note) return null;
  return <p className="mt-1 text-sm text-ink">{note}</p>;
}

function BookmarkMenu({ shop, bookmarked }: { shop: Shop; bookmarked: boolean }) {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const lists = useSession((s) => s.bookmarkLists ?? []);
  const saveBookmark = useSession((s) => s.saveBookmark);
  const removeBookmark = useSession((s) => s.removeBookmark);
  const addBookmarkToList = useSession((s) => s.addBookmarkToList);
  const createBookmarkList = useSession((s) => s.createBookmarkList);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  if (shop.plan !== "basic" && shop.plan !== "grow" && shop.plan !== "premium") return null;
  return (
    <div className="relative">
      <button type="button" className={actionBtn} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <BookmarkIcon on={bookmarked} /> {t.bookmark}
      </button>
      {open && (
        <div className="bookmark-pop" role="dialog" aria-label={t.bookmark}>
          <button type="button" onClick={() => { saveBookmark(shop.slug); setOpen(false); }}>{t.bookmarkSave}</button>
          <p>{t.saveUnder}</p>
          {lists.map((list) => (
            <button key={list.id} type="button" onClick={() => addBookmarkToList(shop.slug, list.id)}>
              {list.name}{list.slugs.includes(shop.slug) ? " ✓" : ""}
            </button>
          ))}
          <button type="button" onClick={() => { setVisibility("private"); setCreating(true); }}>{t.createList}</button>
          {bookmarked && (
            <button type="button" onClick={() => { removeBookmark(shop.slug); setOpen(false); }}>{t.removeBookmark}</button>
          )}
        </div>
      )}
      {creating && (
        <div className="list-modal" role="dialog" aria-label={t.createList}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createBookmarkList(name, shop.slug, visibility);
              setName("");
              setVisibility("private");
              setCreating(false);
              setOpen(false);
            }}
          >
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.listName} aria-label={t.listName} required />
            <div className="list-visibility">
              <label><input type="radio" name="list-visibility" checked={visibility === "private"} onChange={() => setVisibility("private")} /> {t.listPrivate}</label>
              <label><input type="radio" name="list-visibility" checked={visibility === "public"} onChange={() => setVisibility("public")} /> {t.listPublic}</label>
            </div>
            <button type="submit" className={actionBtn}>{t.createAndSave}</button>
            <button type="button" onClick={() => setCreating(false)}>{t.back}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function TopBar({
  t,
  shop,
  bookmarked,
  onReport,
  shareTitle,
  shareSlug,
  own,
  seller,
}: {
  t: { back: string; bookmark: string; report: string; share: string; copied: string };
  shop: Shop;
  bookmarked: boolean;
  onReport: () => void;
  shareTitle: string;
  shareSlug: string;
  own?: boolean;
  seller?: boolean;
}) {
  return (
    <div className="flex items-center justify-end px-4 py-3 sm:px-6">
      <div className="shop-actions">
        <ShareStall title={shareTitle} slug={shareSlug} label={t.share} copiedLabel={t.copied} />
        {!own && !seller && <BookmarkMenu shop={shop} bookmarked={bookmarked} />}
        {!own && (
          <button type="button" onClick={onReport} className={actionBtn}>
            <FlagIcon /> {t.report}
          </button>
        )}
      </div>
    </div>
  );
}

function ReportNote({
  on,
  onClose,
}: {
  on: boolean;
  onClose: () => void;
}) {
  const [sent, setSent] = useState(false);
  if (!on) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl bg-paper p-5">
        <div className="flex justify-between">
          <h3 className="font-display text-lg">Report this stall</h3>
          <button type="button" onClick={onClose} className="size-10" aria-label="Close">
            ×
          </button>
        </div>
        {sent ? (
          <p className="mt-3 text-sm">Noted. We do not vouch for sellers — this flags the listing for review.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-mute">
              Souq Battuta does not vouch for sellers. Buyer diligence still applies.
            </p>
            <button
              type="button"
              className="mt-4 h-11 w-full rounded-md bg-ink text-cream"
              onClick={() => setSent(true)}
            >
              Send report
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PhotoFrame({
  shot,
  onClose,
}: {
  shot: { src?: string; images?: string[]; index?: number; title: string; text?: string; label?: string } | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const images = shot?.images?.length ? shot.images : shot?.src ? [shot.src] : [];
  const [index, setIndex] = useState(shot?.index ?? 0);
  const open = Boolean(shot && images.length);
  useEffect(() => setIndex(shot?.index ?? 0), [shot]);
  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      restore.current?.focus?.();
    };
  }, [open]);
  if (!shot || images.length === 0) return null;
  const n = images.length;
  const src = images[index] ?? images[0];
  const label = shot.label || photoControlName("en", shot.title);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-xl bg-paper shadow-md"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 pt-2">
          <p className="text-xs text-mute">
            {index + 1} / {n}
          </p>
          <button type="button" ref={closeRef} onClick={onClose} className="photo-open size-11 text-xl" aria-label="Close">
            ×
          </button>
        </div>
        <div className="relative">
          <OptImg src={src} alt={shot.title} className="max-h-[70vh] w-full bg-cream object-contain" />
          {n > 1 && (
            <>
              <button
                type="button"
                className="photo-open absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-cream text-xl text-ink shadow-md"
                aria-label="Previous photo"
                onClick={() => setIndex((index + n - 1) % n)}
              >
                ‹
              </button>
              <button
                type="button"
                className="photo-open absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-cream text-xl text-ink shadow-md"
                aria-label="Next photo"
                onClick={() => setIndex((index + 1) % n)}
              >
                ›
              </button>
            </>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-display text-2xl text-ink">{shot.title}</h3>
          {shot.text && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{shot.text}</p>}
        </div>
      </div>
    </div>
  );
}
function Gallery({
  images,
  photo,
  setPhoto,
  title,
  label,
  onOpen,
}: {
  images: string[];
  photo: number;
  setPhoto: (n: number) => void;
  title: string;
  label: string;
  onOpen: (src: string) => void;
}) {
  const n = images.length || 1;
  return (
    <div>
      <div className="relative overflow-hidden rounded-lg bg-[#2a261f]">
        {images[photo] ? (
          <button type="button" className="photo-open block w-full" aria-label={label} onClick={() => onOpen(images[photo])}>
            <OptImg src={images[photo]} alt={title} className="aspect-[4/3] w-full object-cover" />
          </button>
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-sand">No photo</div>
        )}
        {n > 1 && (
          <>
            <button
              type="button"
              className="absolute start-2 top-1/2 size-10 -translate-y-1/2 rounded-full bg-cream"
              aria-label="Previous photo"
              onClick={() => setPhoto((photo + n - 1) % n)}
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute end-2 top-1/2 size-10 -translate-y-1/2 rounded-full bg-cream"
              aria-label="Next photo"
              onClick={() => setPhoto((photo + 1) % n)}
            >
              ›
            </button>
            <button
              type="button"
              className="absolute end-2 top-2 size-8 rounded-full bg-cream text-sm"
              aria-label="Close"
              onClick={() => setPhoto(0)}
            >
              ×
            </button>
          </>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-mute">
        {Math.min(photo + 1, n)} / {n}
      </p>
    </div>
  );
}

export function ShopView({ shop }: { shop: Shop }) {
  const page = shop.plan === "free" ? <FreeShop shop={shop} /> : shop.plan === "basic" ? <BasicShop shop={shop} /> : shop.plan === "grow" || shop.plan === "premium" ? <GrowShop shop={shop} /> : <PremiumShop shop={shop} />;
  return <div className="shop-view">{page}</div>;
}

function productCopy(product: Product, lang: "en" | "ar") {
  const arabicName = /[\u0600-\u06FF]/.test(product.nameAr) && product.nameAr !== product.name ? product.nameAr : "";
  const arabicDesc = /[\u0600-\u06FF]/.test(product.descAr) && product.descAr !== product.desc ? product.descAr : "";
  if (lang === "ar") {
    return { title: arabicName || product.name, titleAlt: "", body: arabicDesc || product.desc, bodyAlt: "" };
  }
  return { title: product.name, titleAlt: arabicName, body: product.desc, bodyAlt: arabicDesc };
}

function ProductShots({ images }: { images: string[] }) {
  const [main, ...subs] = images.filter(Boolean);
  if (!main) return null;
  return (
    <div className="bg-paper">
      <OptImg src={main} alt="" className="aspect-[4/3] max-h-80 w-full object-cover" />
      {subs.length > 0 && (
        <div className="grid grid-cols-4 gap-2 p-3">
          {subs.map((src, index) => (
            <OptImg key={`${index}-${src}`} src={src} alt="" className="aspect-square w-full rounded-md object-cover ring-1 ring-line" />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemEdit({
  id,
  own,
  seller,
  loved,
  lang,
  onLove,
}: {
  id: string;
  own: boolean;
  seller: boolean;
  loved: boolean;
  lang: "en" | "ar";
  onLove: () => void;
}) {
  if (own) {
    return (
      <Link
        to="/seller"
        search={{ item: id, tab: "edit", order: "", note: "" }}
        className="inline-flex h-10 shrink-0 items-center rounded-md border border-ink px-3 text-sm font-semibold text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        {lang === "ar" ? "تعديل" : "Edit"}
      </Link>
    );
  }
  if (seller) return null;
  return (
    <button
      type="button"
      className="heart-btn shrink-0"
      data-on={loved}
      aria-pressed={loved}
      aria-label={lang === "ar" ? "إعجاب" : "Like"}
      onClick={(event) => {
        event.stopPropagation();
        onLove();
      }}
    >
      <HeartIcon />
    </button>
  );
}

function MenuTile({
  product,
  lang,
  sellerName,
  own,
  seller,
  loved,
  onOpen,
  onLove,
  onNotify,
  watching,
}: {
  product: Product;
  lang: "en" | "ar";
  sellerName: string;
  own: boolean;
  seller: boolean;
  loved: boolean;
  onOpen: () => void;
  onLove: () => void;
  onNotify?: () => void;
  watching?: boolean;
}) {
  const accounts = useSession((s) => s.accounts);
  const likes = Object.values(accounts).filter((account) => account.role !== "seller" && (account.favorites ?? []).includes(product.id)).length;
  const copy = productCopy(product, lang);
  const [main, ...rest] = product.images.filter(Boolean);
  const subs = rest.slice(0, 3);
  return (
    <article className="shop-tile">
      <button type="button" className="shop-tile-media photo-open" aria-label={photoControlName(lang, sellerName, copy.title)} onClick={onOpen}>
        <OptImg src={main || "/brand/avatars/default-duck.jpg"} alt="" />
      </button>
      {subs.length > 0 && (
        <span className="shop-tile-subs">
          {subs.map((src, index) => (
            <OptImg key={`${index}-${src}`} src={src} alt="" />
          ))}
        </span>
      )}
      <div className="shop-tile-body">
        <button type="button" className="shop-tile-name" onClick={onOpen}>
          <b>{copy.title}</b>
        </button>
        <span className="menu-price">{priceLabel(product, lang)}</span>
        {product.paused && <span className="block text-xs text-red">{pauseText(product, lang)}</span>}
        <span className="shop-tile-meta">
          <span className="shop-tile-likes heart-count"><HeartIcon /> {likes}</span>
          {own ? (
            <ItemEdit id={product.id} own seller={seller} loved={loved} lang={lang} onLove={onLove} />
          ) : !seller ? (
            <button type="button" className="heart-btn" data-on={loved} aria-pressed={loved} aria-label={lang === "ar" ? "إعجاب" : "Like"} onClick={onLove}>
              <HeartIcon />
            </button>
          ) : null}
          {product.paused && onNotify && (
            <button type="button" className="text-xs font-semibold underline" disabled={watching} onClick={onNotify}>
              {watching ? (lang === "ar" ? "بنخبرك" : "We'll tell you") : lang === "ar" ? "خبرني إذا رجع" : "Notify me"}
            </button>
          )}
        </span>
      </div>
    </article>
  );
}

function OrderLine({
  product,
  lang,
  sellerName,
  qty,
  onOpen,
  onAdd,
  onNotify,
  watching,
}: {
  product: Product;
  lang: "en" | "ar";
  sellerName: string;
  qty: number;
  onOpen: () => void;
  onAdd: () => void;
  onNotify?: () => void;
  watching?: boolean;
}) {
  const name = lang === "ar" ? product.nameAr : product.name;
  return (
    <li id={`item-${product.id}`} className="flex items-center gap-3 px-3 py-2.5">
      <button type="button" className="photo-open shrink-0" aria-label={photoControlName(lang, sellerName, name)} onClick={onOpen}>
        <OptImg src={product.images[0] || "/brand/avatars/default-duck.jpg"} alt="" className="size-14 rounded-md object-cover" />
      </button>
      <button type="button" className="min-w-0 flex-1 text-start" onClick={onOpen}>
        <span className="block truncate font-display text-lg leading-tight text-ink">{name}</span>
        <span className="text-sm font-semibold text-gold">{priceLabel(product, lang)}</span>
        {product.paused && <span className="block text-xs text-red">{pauseText(product, lang)}</span>}
      </button>
      {product.paused ? (
        <button type="button" className="h-9 shrink-0 rounded-full border border-ink px-4 text-sm font-semibold text-ink disabled:opacity-50" disabled={watching} onClick={onNotify}>
          {watching ? (lang === "ar" ? "بنخبرك" : "We'll tell you") : lang === "ar" ? "خبرني" : "Notify me"}
        </button>
      ) : (
      <button type="button" className="h-9 shrink-0 rounded-full border border-ink px-4 text-sm font-semibold text-ink hover:bg-ink hover:text-cream" onClick={onAdd}>
        {qty > 0 ? qty : lang === "ar" ? "أضف" : "Add"}
      </button>
      )}
    </li>
  );
}

function FreeShop({ shop }: { shop: Shop }) {
  const ui = useShopChrome(shop);
  const { t, name, area } = ui;
  const [tab, setTab] = useState<"menu" | "inquire">("menu");
  const [picked, setPicked] = useState<string[]>([]);
  const [sectionKey, setSectionKey] = useState("");
  const groups = menuGroups(shop.products);
  const shown = sectionKey ? groups.filter((group) => group.key === sectionKey) : groups;
  const lines = shop.products.filter((p) => picked.includes(p.id)).map((product) => ({ product, qty: 1 }));
  function openItem(p: Product, index = 0) {
    const pname = ui.lang === "ar" ? p.nameAr : p.name;
    const pdesc = ui.lang === "ar" ? p.descAr : p.desc;
    ui.setActive(p);
    ui.setShot({
      images: p.images,
      index,
      title: pname,
      text: `${priceLabel(p, ui.lang)}\n${pdesc}`,
      label: photoControlName(ui.lang, name, pname),
    });
  }
  return (
    <>
      <TopBar t={t} shareTitle={name} shareSlug={shop.slug} shop={shop} bookmarked={ui.bookmarked} onReport={() => ui.setReportOn(true)} own={ui.own} seller={ui.seller} />
      <main className="grid items-start gap-6 px-4 pb-16 pt-2 sm:px-8 lg:grid-cols-3">
        <aside className="overflow-hidden rounded-xl border border-line bg-cream shadow-sm lg:sticky lg:top-4 lg:col-span-1">
          <div className="bg-sand px-5 pb-6 pt-5">
            <button
              type="button"
              className="photo-open block rounded-full"
              aria-label={photoControlName(ui.lang, name)}
              onClick={() => ui.setShot({ src: shop.avatar, title: name, text: `${area} · ${t.cityName}`, label: photoControlName(ui.lang, name) })}
            >
              <FramedImage src={shop.avatar} frameId={`avatar:${shop.slug}`} alt="" className="size-28 rounded-full bg-paper object-cover ring-4 ring-cream" />
            </button>
          </div>
          <div className="border-t-4 border-gold px-5 py-5">
            <h1 id="shop-name" className="font-display text-4xl leading-none text-ink">{name}</h1>
            <AnimalSaleNotice />
            <div className="mt-3"><AnimalRule ar={ui.lang === "ar"} /></div>
            <p className="mt-2 text-sm tracking-wide text-mute">{area} · {t.cityName}</p>
            {!ui.own && (
              <>
                <p className="mt-4 font-display text-lg text-ink">{ui.lang === "ar" ? "استفسار" : "Inquiry"}</p>
                <p className="mt-1 text-sm leading-relaxed text-mute">
                  {ui.lang === "ar" ? "اختر من القائمة، ثم أرسل على واتساب." : "Choose from the menu, then send on WhatsApp."}
                </p>
              </>
            )}
          </div>
        </aside>
        <section className="lg:col-span-2">
          {ui.own ? null : (
          <div className="flex gap-1 rounded-xl bg-sand p-1" role="tablist">
            <button
              type="button"
              role="tab"
              className={cn("h-11 flex-1 rounded-lg text-sm font-semibold", tab === "menu" ? "bg-ink text-cream" : "text-ink")}
              onClick={() => setTab("menu")}
            >
              {t.menu}
            </button>
            <button
              type="button"
              role="tab"
              className={cn("h-11 flex-1 rounded-lg text-sm font-semibold", tab === "inquire" ? "bg-ink text-cream" : "text-ink")}
              onClick={() => setTab("inquire")}
            >
              {t.orderInquireNow}
            </button>
          </div>
          )}
          <SectionTabs groups={groups} active={sectionKey} onPick={setSectionKey} lang={ui.lang} />
          {tab === "menu" || ui.own ? (
            <div className="mt-4 space-y-6">
              {shop.products.length === 0 && (
                <p className="rounded-xl border border-line bg-cream px-4 py-6 text-sm text-mute">
                  {ui.lang === "ar" ? "ما في منتجات بعد." : "No products yet."}
                </p>
              )}
              {shown.map((group) => (
                <section key={group.key}>
                  {group.title && !sectionKey && <h3 className="mb-3 font-display text-2xl text-ink">{ui.lang === "ar" ? group.titleAr : group.title}</h3>}
                  <ul className="menu-grid">
              {group.items.map((p) => (
                  <li key={p.id} id={`item-${p.id}`}>
                    <MenuTile
                      product={p}
                      lang={ui.lang}
                      sellerName={name}
                      own={ui.own}
                      seller={ui.seller}
                      loved={ui.fav(p.id)}
                      onOpen={() => openItem(p, 0)}
                      onLove={() => ui.toggleFavorite(p.id)}
                    />
                  </li>
              ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {shown.flatMap((group) => group.items).map((p) => {
                const pname = ui.lang === "ar" ? p.nameAr : p.name;
                const on = picked.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked((ids) => (on ? ids.filter((id) => id !== p.id) : [...ids, p.id]))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-start shadow-sm",
                      on ? "border-ink bg-sand" : "border-line bg-cream",
                    )}
                  >
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-sm border text-xs", on ? "border-ink bg-ink text-cream" : "border-line bg-paper")}>
                      {on ? "✓" : ""}
                    </span>
                    <OptImg src={p.images[0]} alt="" className="size-16 rounded-md object-cover ring-1 ring-line" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-xl text-ink">{pname}</span>
                      <span className="text-sm font-semibold text-gold">{priceLabel(p, ui.lang)}</span>
                    </span>
                  </button>
                );
              })}
              {lines[0] && <WhatsAppCta shop={shop} product={lines[0].product} items={lines} mode="inquire" />}
            </div>
          )}
        </section>
      </main>
      <PhotoFrame shot={ui.shot} onClose={() => ui.setShot(null)} />
      <ReportNote on={ui.reportOn} onClose={() => ui.setReportOn(false)} />
    </>
  );
}

function BasicShop({ shop }: { shop: Shop }) {
  const ui = useShopChrome(shop);
  const { t, name, area } = ui;
  const [tab, setTab] = useState<"menu" | "inquire">("menu");
  const [picked, setPicked] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sectionKey, setSectionKey] = useState("");
  const groups = menuGroups(shop.products);
  const shown = sectionKey ? groups.filter((group) => group.key === sectionKey) : groups;
  const askQty = !!shop.askQty;
  const canMessage = shop.isOpen !== false || shop.contactWhenClosed !== false;
  const lines = askQty
    ? shop.products.map((product) => ({ product, qty: counts[product.id] ?? 0 })).filter((line) => line.qty > 0)
    : shop.products.filter((p) => picked.includes(p.id)).map((product) => ({ product, qty: 1 }));
  const total = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  function openItem(p: Product, index = 0) {
    const pname = ui.lang === "ar" ? p.nameAr : p.name;
    const pdesc = ui.lang === "ar" ? p.descAr : p.desc;
    ui.setActive(p);
    ui.setShot({ images: p.images, index, title: pname, text: `${priceLabel(p, ui.lang)}\n${pdesc}`, label: photoControlName(ui.lang, name, pname) });
  }
  return (
    <>
      <TopBar t={t} shareTitle={name} shareSlug={shop.slug} shop={shop} bookmarked={ui.bookmarked} onReport={() => ui.setReportOn(true)} own={ui.own} seller={ui.seller} />
      {(shop.cover || shop.avatar) && (
        <div className="px-4 sm:px-8">
          <button
            type="button"
            className="photo-open relative block h-40 w-full overflow-hidden rounded-xl border border-line sm:h-52"
            aria-label={photoControlName(ui.lang, name)}
            onClick={() => ui.setShot({ src: shop.cover ?? shop.avatar, title: name, text: ui.lang === "ar" ? shop.bioAr : shop.bio, label: photoControlName(ui.lang, name) })}
          >
            <FramedImage src={shop.cover ?? shop.avatar} frameId={`cover:${shop.slug}`} className="absolute inset-0 h-full w-full" />
          </button>
        </div>
      )}
      <main className="grid items-start gap-6 px-4 pb-16 pt-6 sm:px-8 lg:grid-cols-3">
        <aside className="overflow-hidden rounded-xl border border-line bg-cream shadow-sm lg:sticky lg:top-4 lg:col-span-1">
          <div className="bg-sand px-5 pb-6 pt-5">
            <button
              type="button"
              className="photo-open block rounded-full"
              aria-label={photoControlName(ui.lang, name)}
              onClick={() => ui.setShot({ src: shop.avatar, title: name, text: `${area} · ${t.cityName}`, label: photoControlName(ui.lang, name) })}
            >
              <FramedImage src={shop.avatar} frameId={`avatar:${shop.slug}`} alt="" className="size-28 rounded-full bg-paper object-cover ring-4 ring-cream" />
            </button>
          </div>
          <div className="border-t-4 border-gold px-5 py-5">
            <div className="flex items-center gap-2">
              <h1 id="shop-name" className="font-display text-4xl leading-none text-ink">{name}</h1>
              <Crown plan="basic" className="plan-badge profile-badge" />
            </div>
            <AnimalSaleNotice />
            <p className="mt-2 text-sm tracking-wide text-mute">{area} · {t.cityName}</p>
            <p className={cn("mt-2 text-sm font-semibold", shop.isOpen ? "text-stamp-green" : "text-mute")}>
              {shop.isOpen ? `● ${t.open}` : `● ${t.closed}`}
              {shop.hours ? ` · ${shop.hours}` : ""}
            </p>
            {!shop.isOpen && shop.contactWhenClosed !== false && !shop.closedNote && !shop.closedNoteAr && (
              <p className="mt-1 text-xs text-mute">{ui.lang === "ar" ? "مغلق، والتواصل مفتوح." : "Closed, and you can still message them."}</p>
            )}
            <StallNote shop={shop} lang={ui.lang} />
            {shop.views != null && (
              <p className="mt-1 text-xs text-mute">
                {t.views}: {shop.views.toLocaleString()}
              </p>
            )}
            {(shop.bio || shop.bioAr) && (
              <p className="mt-4 text-sm leading-relaxed text-mute">{ui.lang === "ar" ? shop.bioAr : shop.bio}</p>
            )}
            <div className="mt-4"><AnimalRule ar={ui.lang === "ar"} /></div>
            <SellerNameNote slug={shop.slug} />
            {shop.socials && shop.socials.length > 0 && (
              <div className="mt-4 flex gap-2">
                {shop.socials.map((item) => (
                  <SocialMark key={item.href} label={item.label} href={item.href} />
                ))}
              </div>
            )}
          </div>
        </aside>
        <section className="lg:col-span-2">
          {!canMessage && !ui.own && (
            <p className="mb-3 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-mute">
              {ui.lang === "ar" ? "مغلق الآن، والتواصل مقفل لين يفتح." : "Closed now. Contact is off until they open."}
            </p>
          )}
          {ui.own || !canMessage ? null : (
          <div className="flex gap-1 rounded-xl bg-sand p-1" role="tablist">
            <button
              type="button"
              role="tab"
              className={cn("h-11 flex-1 rounded-lg text-sm font-semibold", tab === "menu" ? "bg-ink text-cream" : "text-ink")}
              onClick={() => setTab("menu")}
            >
              {t.menu}
            </button>
            <button
              type="button"
              role="tab"
              className={cn("h-11 flex-1 rounded-lg text-sm font-semibold", tab === "inquire" ? "bg-ink text-cream" : "text-ink")}
              onClick={() => setTab("inquire")}
            >
              {t.orderInquireNow}
            </button>
          </div>
          )}
          <SectionTabs groups={groups} active={sectionKey} onPick={setSectionKey} lang={ui.lang} />
          {tab === "menu" || ui.own || !canMessage ? (
            <div className="mt-4 space-y-6">
              {shown.map((group) => (
                <section key={group.key}>
                  {group.title && !sectionKey && <h3 className="mb-3 font-display text-2xl text-ink">{ui.lang === "ar" ? group.titleAr : group.title}</h3>}
                  <ul className="menu-grid">
              {group.items.map((p) => (
                  <li key={p.id} id={`item-${p.id}`}>
                    <MenuTile
                      product={p}
                      lang={ui.lang}
                      sellerName={name}
                      own={ui.own}
                      seller={ui.seller}
                      loved={ui.fav(p.id)}
                      onOpen={() => openItem(p, 0)}
                      onLove={() => ui.toggleFavorite(p.id)}
                    />
                  </li>
              ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {shown.flatMap((group) => group.items).map((p) => {
                const pname = ui.lang === "ar" ? p.nameAr : p.name;
                const qty = counts[p.id] ?? 0;
                const on = askQty ? qty > 0 : picked.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-start shadow-sm",
                      on ? "border-ink bg-sand" : "border-line bg-cream",
                    )}
                  >
                    {askQty ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="size-9 rounded-md border border-line bg-paper"
                          aria-label="Less"
                          onClick={() => setCounts((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] ?? 0) - 1) }))}
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                        <button
                          type="button"
                          className="size-9 rounded-md border border-line bg-paper"
                          aria-label="More"
                          onClick={() => setCounts((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }))}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={on}
                        className={cn("grid size-6 shrink-0 place-items-center rounded-sm border text-xs", on ? "border-ink bg-ink text-cream" : "border-line bg-paper")}
                        onClick={() => setPicked((ids) => (on ? ids.filter((id) => id !== p.id) : [...ids, p.id]))}
                      >
                        {on ? "✓" : ""}
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-start"
                      onClick={() => {
                        if (askQty) setCounts((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) > 0 ? 0 : 1 }));
                        else setPicked((ids) => (on ? ids.filter((id) => id !== p.id) : [...ids, p.id]));
                      }}
                    >
                      <OptImg src={p.images[0]} alt="" className="size-16 rounded-md object-cover ring-1 ring-line" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-xl text-ink">{pname}</span>
                        <span className="text-sm font-semibold text-gold">{priceLabel(p, ui.lang)}</span>
                      </span>
                    </button>
                  </div>
                );
              })}
              {askQty && lines.length > 0 && (
                <p className="text-end font-display text-2xl text-ink">
                  {t.orderTotal} {formatJod(total)}
                </p>
              )}
              {lines[0] && <WhatsAppCta shop={shop} product={lines[0].product} items={lines} mode="inquire" />}
            </div>
          )}
        </section>
      </main>
      <PhotoFrame shot={ui.shot} onClose={() => ui.setShot(null)} />
      <ReportNote on={ui.reportOn} onClose={() => ui.setReportOn(false)} />
    </>
  );
}

function SocialMark({ label, href }: { label: string; href: string }) {
  const kind = label.toLowerCase();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid size-11 place-items-center rounded-full border border-line bg-paper text-ink hover:border-ink"
    >
      {kind === "instagram" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
        </svg>
      ) : kind === "facebook" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-1c0-.6.4-1 1-1z" />
        </svg>
      ) : kind === "tiktok" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14 4h2.2a5 5 0 0 0 3.8 3.6V10a7 7 0 0 1-3.8-1.1v6.2a5.6 5.6 0 1 1-5.6-5.6c.2 0 .5 0 .7.1v2.4a3.2 3.2 0 1 0 2.2 3V4Z" />
        </svg>
      ) : kind === "snapchat" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3c2.6 0 4.2 2 4.2 5.2 0 .7.2 1.3.6 1.8.5.6 1.3.8 2 .7-.2.8-1.2 1.4-1.8 1.8-.3.2-.4.6-.2 1 .4.7 1.4 1.1 1.4 1.8 0 .5-.6.8-1.3.7-.8 0-1.3.4-1.5 1.1-.2.6-.8 1-1.6.9-.7-.1-1.2.2-1.4.8-.2.5-.8.8-1.4.8s-1.2-.3-1.4-.8c-.2-.6-.7-.9-1.4-.8-.8.1-1.4-.3-1.6-.9-.2-.7-.7-1.1-1.5-1.1-.7.1-1.3-.2-1.3-.7 0-.7 1-1.1 1.4-1.8.2-.4.1-.8-.2-1-.6-.4-1.6-1-1.8-1.8.7.1 1.5-.1 2-.7.4-.5.6-1.1.6-1.8C7.8 5 9.4 3 12 3Z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10 8.5v7l6-3.5-6-3.5ZM12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
        </svg>
      )}
    </a>
  );
}

function GrowShop({ shop }: { shop: Shop }) {
  const ui = useShopChrome(shop);
  const { t, name, area } = ui;
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
  const pageLikes = useSession((s) => s.pageLikes) ?? [];
  const togglePageLike = useSession((s) => s.togglePageLike);
  const follows = useSession((s) => s.follows) ?? [];
  const restocks = useSession((s) => s.restocks) ?? [];
  const watchRestock = useSession((s) => s.watchRestock);
  const toggleFollow = useSession((s) => s.toggleFollow);
  const waTaps = useSession((s) => s.waTaps) ?? {};
  const addresses = useSession((s) => s.addresses);
  const [tab, setTab] = useState<"menu" | "order">("menu");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<{ id: string; qty: number; note: string; picks: number[] } | null>(null);
  const [chosen, setChosen] = useState<Record<string, number[]>>({});
  const [itemQuery, setItemQuery] = useState("");
  const [addressId, setAddressId] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [zone, setZone] = useState<"amman" | "outside" | "intl">("amman");
  const [method, setMethod] = useState<"delivery" | "pickup">(shop.handoff === "pickup" ? "pickup" : "delivery");
  const query = itemQuery.trim().toLowerCase();
  const lines = shop.products
    .map((product) => {
      const picks = chosen[product.id];
      const detail = choiceLabel(product, picks, ui.lang);
      return {
        product: { ...product, price: product.price + choiceExtra(product, picks) },
        qty: counts[product.id] ?? 0,
        note: notes[product.id],
        detail,
      };
    })
    .filter((line) => line.qty > 0);
  const itemsTotal = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const handoff = shop.handoff ?? "both";
  const delivering = method === "delivery" && handoff !== "pickup";
  const feeRaw = !delivering ? null : zone === "outside" ? shop.delivery?.outside : zone === "intl" ? shop.delivery?.intl : shop.delivery?.amman;
  const feeAmount = feeRaw ? deliveryAmount(feeRaw) : null;
  const total = itemsTotal + (feeAmount ?? 0);
  const saved = addresses.find((item) => item.id === addressId);
  const addressPick = saved ? { name: saved.name, line: saved.line, lat: saved.lat, lng: saved.lng } : null;
  const [sectionKey, setSectionKey] = useState("");
  const sections = useMemo(() => menuGroups(shop.products).filter((group) => group.items.length > 0), [shop.products]);
  const shown = sectionKey ? sections.filter((group) => group.key === sectionKey) : sections;
  const matched = sectionsWithMatches(shown, query);
  const productIds = useMemo(() => new Set(shop.products.map((p) => p.id)), [shop.products]);
  const liveLikers = Object.values(accounts).filter(
    (account) =>
      account.role !== "seller" &&
      ((account.pageLikes ?? []).includes(shop.slug) || (account.favorites ?? []).some((id) => productIds.has(id))),
  ).length;
  const totalLikes = (shop.likes ?? 0) + liveLikers;
  const pageOn = pageLikes.includes(shop.slug);
  const pro = shop.plan === "premium";
  const following = follows.includes(shop.slug);
  const followerCount =
    (shop.followers ?? 0) +
    Object.values(accounts).filter((account) => account.role !== "seller" && (account.follows ?? []).includes(shop.slug)).length;
  const orderCount = (shop.waOrders ?? 0) + (waTaps[shop.slug] ?? 0);
  const orderLabel = shop.mode === "inquire" ? t.inquiriesMade : shop.mode === "both" ? t.ordersAndInquiries : t.ordersMade;
  const ar = ui.lang === "ar";

  function notify(product: Product) {
    if (!user) {
      void navigate({ to: "/sign-in", search: { next: `/shop/${shop.slug}` } });
      return;
    }
    if (user.role === "seller") return;
    watchRestock({ productId: product.id, shopSlug: shop.slug, name: product.name, nameAr: product.nameAr });
  }

  function guardLike(run: () => void) {
    if (!user) {
      void navigate({ to: "/sign-in", search: { next: `/shop/${shop.slug}` } });
      return;
    }
    if (user.role === "seller") return;
    run();
  }

  function openItem(p: Product) {
    ui.setActive(p);
    ui.setShot({
      images: p.images,
      index: 0,
      title: ar ? p.nameAr : p.name,
      text: `${priceLabel(p, ui.lang)}\n${ar ? p.descAr : p.desc}`,
      label: photoControlName(ui.lang, name, ar ? p.nameAr : p.name),
    });
  }

  return (
    <>
      <TopBar t={t} shareTitle={name} shareSlug={shop.slug} shop={shop} bookmarked={ui.bookmarked} onReport={() => ui.setReportOn(true)} own={ui.own} seller={ui.seller} />
      <div className="px-4 sm:px-8">
        <button
          type="button"
          className="photo-open relative block h-52 w-full overflow-hidden rounded-2xl border border-ink/10 shadow-sm sm:h-64"
          aria-label={photoControlName(ui.lang, name)}
          onClick={() => ui.setShot({ src: shop.cover ?? shop.avatar, title: name, text: ar ? shop.bioAr : shop.bio, label: photoControlName(ui.lang, name) })}
        >
          <FramedImage src={shop.cover ?? shop.avatar} frameId={`cover:${shop.slug}`} className="absolute inset-0 h-full w-full" />
          <span className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
          <span className="absolute bottom-4 start-4 end-4 text-start text-cream">
            <span className="block font-display text-3xl leading-none sm:text-4xl">{name}</span>
            <span className="mt-1 block text-sm text-cream/80">{area} · {t.cityName}</span>
          </span>
        </button>
      </div>
      <main className="grid items-start gap-8 px-4 pb-16 pt-6 sm:px-8 lg:grid-cols-3">
        <aside className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm lg:sticky lg:top-4 lg:col-span-1">
          <div className="flex items-end justify-between bg-ink px-5 pb-5 pt-5 text-cream">
            <button
              type="button"
              className="photo-open -mb-10 block rounded-full"
              aria-label={photoControlName(ui.lang, name)}
              onClick={() => ui.setShot({ src: shop.avatar, title: name, text: `${area} · ${t.cityName}`, label: photoControlName(ui.lang, name) })}
            >
              <FramedImage src={shop.avatar} frameId={`avatar:${shop.slug}`} className="size-24 rounded-full bg-paper object-cover ring-4 ring-gold" />
            </button>
            {!ui.seller && (
            <span className="flex items-center gap-2 rounded-full bg-cream px-2 py-1 text-ink">
              <button
                type="button"
                aria-pressed={pageOn}
                aria-label={ar ? "إعجاب بالصفحة" : "Like this stall"}
                className="heart-btn"
                data-on={pageOn}
                onClick={() => guardLike(() => togglePageLike(shop.slug))}
              >
                <HeartIcon />
              </button>
              <span className="pe-2 text-sm font-semibold">{totalLikes.toLocaleString()}</span>
            </span>
            )}
          </div>
          <div className="px-5 pb-5 pt-12">
            <h1 id="shop-name" className="flex items-center gap-2 font-display text-3xl leading-none text-ink">
              {name}
              <Crown plan={shop.plan} className="plan-badge profile-badge" />
            </h1>
            <AnimalSaleNotice />
            <div className="mt-4 overflow-hidden rounded-lg border-2 border-ink bg-ink text-center text-cream">
              <div className="flex items-center justify-center gap-2 px-3 py-3">
                <span
                  className={cn(
                    "size-3 rounded-full",
                    shop.isOpen ? "bg-[#3ddc84] shadow-[0_0_12px_#3ddc84]" : "bg-[#ff3b3b] shadow-[0_0_12px_#ff3b3b]",
                  )}
                  aria-hidden="true"
                />
                <span className="font-display text-xl tracking-[0.2em]">{shop.isOpen ? (ar ? "مفتوح" : "OPEN") : ar ? "مغلق" : "CLOSED"}</span>
              </div>
              {shop.hours && <p className="border-t border-cream/20 px-3 py-2 text-xs tracking-wide text-cream">{shop.hours}</p>}
            </div>
            <p className="mt-2 text-xs text-mute">{t.views} · {shop.views?.toLocaleString() ?? 0}</p>
            <StallNote shop={shop} lang={ui.lang} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sand px-3 py-1 text-xs text-ink">{t.followers} {followerCount.toLocaleString()}</span>
                {pro && <span className="rounded-full bg-sand px-3 py-1 text-xs text-ink">{orderLabel} {orderCount.toLocaleString()}</span>}
                <button
                  type="button"
                  aria-pressed={following}
                  className={cn("h-9 rounded-full px-4 text-sm font-semibold", following ? "border border-ink bg-paper text-ink" : "bg-ink text-cream")}
                  onClick={() => guardLike(() => toggleFollow(shop.slug))}
                >
                  {following ? t.following : t.follow}
                </button>
              </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <DuckRating score={shop.rating ?? 0} />
              <p className="text-sm text-ink">
                {shop.rating ?? "–"} · {shop.reviewCount ?? 0} {t.reviews}
              </p>
              <button
                type="button"
                className="text-sm font-semibold text-ink underline decoration-gold underline-offset-4"
                onClick={() => document.getElementById("shop-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {ar ? "اقرأ التقييمات" : "Read reviews"}
              </button>
            </div>
            <div className="mt-5 rounded-xl bg-cream px-4 py-4 ring-1 ring-line">
              <p className="text-xs font-semibold tracking-[0.16em] text-ink">{ar ? "عن الدكان" : "ABOUT"}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{ar ? shop.bioAr : shop.bio}</p>
              <div className="mt-3"><AnimalRule ar={ar} /></div>
            </div>
            <SellerNameNote slug={shop.slug} />
            {shop.socials && (
              <div className="mt-4 flex gap-2">
                {shop.socials.map((item) => (
                  <SocialMark key={item.href} label={item.label} href={item.href} />
                ))}
              </div>
            )}
          </div>
        </aside>
        <section className="lg:col-span-2">
          <div className="flex gap-1 rounded-xl bg-sand p-1" role="tablist">
            <button type="button" role="tab" className={cn("h-11 flex-1 rounded-lg text-sm font-semibold", tab === "menu" || ui.own ? "bg-ink text-cream" : "text-ink")} onClick={() => setTab("menu")}>
              {t.menu}
            </button>
            {!ui.own && (
            <button type="button" role="tab" className={cn("h-11 flex-1 rounded-lg text-sm font-semibold", tab === "order" ? "bg-ink text-cream" : "text-ink")} onClick={() => setTab("order")}>
              {t.orderInquireNow}
            </button>
            )}
          </div>
          <SectionTabs groups={sections} active={sectionKey} onPick={setSectionKey} lang={ui.lang} />
          {shop.plan === "premium" && (
            <input
              value={itemQuery}
              onChange={(event) => setItemQuery(event.target.value)}
              placeholder={ar ? "ابحث في هذا الدكان" : "Search this stall"}
              aria-label={ar ? "ابحث في هذا الدكان" : "Search this stall"}
              className="mt-4 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm"
            />
          )}
          <div className="mt-6 space-y-8">
            {query && matched.length === 0 ? (
              <div className="shop-search-empty" role="status">
                <p lang="en">No matching items</p>
                <p lang="ar" dir="rtl">لا توجد منتجات مطابقة</p>
                <button type="button" onClick={() => setItemQuery("")}>
                  <span lang="en">Clear search</span>
                  <span lang="ar" dir="rtl">مسح البحث</span>
                </button>
              </div>
            ) : matched.map((section) => (
              <div key={section.key} id={`cat-${section.key}`}>
                {!sectionKey && <h2 className="font-display text-2xl text-ink">{ar ? section.titleAr : section.title}</h2>}
                {!sectionKey && <div className="mt-2 h-px bg-line" />}
                {tab === "order" && !ui.own ? (
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
                  {section.items.map((p) => (
                    <OrderLine
                      key={p.id}
                      product={p}
                      lang={ui.lang}
                      sellerName={name}
                      qty={counts[p.id] ?? 0}
                      onOpen={() => openItem(p)}
                      onAdd={() => setDraft({ id: p.id, qty: Math.max(1, counts[p.id] ?? 1), note: notes[p.id] ?? "", picks: chosen[p.id] ?? defaultPicks(p) })}
                      onNotify={() => notify(p)}
                      watching={restocks.some((watch) => watch.productId === p.id)}
                    />
                  ))}
                </ul>
                ) : (
                <ul className="menu-grid mt-3">
                  {section.items.map((p) => (
                    <li key={p.id} id={`item-${p.id}`}>
                      <MenuTile
                        product={p}
                        lang={ui.lang}
                        sellerName={name}
                        own={!!ui.own}
                        seller={!!ui.seller}
                        loved={ui.fav(p.id)}
                        onOpen={() => openItem(p)}
                        onLove={() => guardLike(() => ui.toggleFavorite(p.id))}
                        onNotify={() => notify(p)}
                        watching={restocks.some((watch) => watch.productId === p.id)}
                      />
                    </li>
                  ))}
                </ul>
                )}
              </div>
            ))}
          </div>
          {pro && tab === "menu" && shop.custom && !ui.own && (
            <div className="mt-8 rounded-xl border border-line bg-sand p-4">
              <h2 className="font-display text-2xl text-ink">{t.customize}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink">{ar ? shop.custom.ar : shop.custom.en}</p>
              <div className="mt-4">
                <WhatsAppCta
                  shop={shop}
                  mode="inquire"
                  product={{
                    id: `${shop.slug}-custom`,
                    name: "Custom order",
                    nameAr: "طلب خاص",
                    price: 0,
                    desc: shop.custom.en,
                    descAr: shop.custom.ar,
                    images: [shop.avatar],
                  }}
                  items={[
                    {
                      product: {
                        id: `${shop.slug}-custom`,
                        name: "Custom order",
                        nameAr: "طلب خاص",
                        price: 0,
                        desc: shop.custom.en,
                        descAr: shop.custom.ar,
                        images: [shop.avatar],
                      },
                      qty: 1,
                      note: ar ? shop.custom.ar : shop.custom.en,
                    },
                  ]}
                />
              </div>
            </div>
          )}
          {tab === "order" && !ui.own && (
            <div className="mt-6 space-y-4 rounded-xl border border-line bg-cream p-4">
              <div className="flex gap-2">
                {handoff !== "pickup" && (
                  <button type="button" className={cn("h-11 flex-1 rounded-lg text-sm font-semibold", method === "delivery" ? "bg-ink text-cream" : "border border-line bg-paper")} onClick={() => setMethod("delivery")}>
                    {t.delivery}
                  </button>
                )}
                {handoff !== "delivery" && (
                  <button type="button" className={cn("h-11 flex-1 rounded-lg text-sm font-semibold", method === "pickup" ? "bg-ink text-cream" : "border border-line bg-paper")} onClick={() => setMethod("pickup")}>
                    {t.pickup}
                  </button>
                )}
              </div>
              {delivering && shop.delivery && (
                <div className="text-sm">
                  <p className="font-semibold text-ink">{t.deliveryFees}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        { id: "amman" as const, label: `${t.cityName} · ${shop.delivery.amman}` },
                        { id: "outside" as const, label: `${t.outside} · ${shop.delivery.outside}` },
                        ...(shop.delivery.intl ? [{ id: "intl" as const, label: `${ar ? "دولي" : "International"} · ${place(shop.delivery.intl, ui.lang)}` }] : []),
                      ]
                    ).map((item) => (
                      <button key={item.id} type="button" className={cn("h-10 rounded-full border px-3 text-sm", zone === item.id ? "border-ink bg-ink text-cream" : "border-line bg-paper")} onClick={() => setZone(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {delivering && (
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">{t.deliveryLocation}</span>
                <select
                  className="h-11 w-full rounded-md border border-line bg-white px-3"
                  value={addressId}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "add") {
                      setAddressOpen(true);
                      return;
                    }
                    setAddressId(next);
                  }}
                >
                  <option value="">{t.addressWord}</option>
                  {addresses.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                  <option value="add">{t.addAddress}</option>
                </select>
              </label>
              )}
              <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-cream">
                <span className="text-sm">{lines.reduce((sum, line) => sum + line.qty, 0)} {ar ? "أصناف" : "items"}</span>
                <span className="font-display text-xl">{t.orderTotal} {formatJod(total)}</span>
              </div>
              {lines[0] && (
                <WhatsAppCta shop={shop} product={lines[0].product} items={lines} mode="invoice" lockAddress addressPick={delivering ? addressPick : null} deliveryFee={delivering && feeRaw ? { label: feeRaw, amount: feeAmount } : null} fulfillment={delivering ? "delivery" : "pickup"} />
              )}
            </div>
          )}
          <section id="shop-reviews" className="mt-12 scroll-mt-6 border-t border-gold pt-6">
            <h2 className="font-display text-2xl text-ink">{t.reviews}</h2>
            <div className="mt-2 flex items-center gap-2">
              <DuckRating score={shop.rating ?? 0} />
              <span className="text-sm text-mute">{shop.rating} · {shop.reviewCount}</span>
            </div>
            <ReviewList shop={shop} />
          </section>
        </section>
      </main>
      <PhotoFrame shot={ui.shot} onClose={() => ui.setShot(null)} />
      <ReportNote on={ui.reportOn} onClose={() => ui.setReportOn(false)} />
      {addressOpen && (
        <AddressDialog
          open
          onClose={() => setAddressOpen(false)}
          onSaved={(id) => setAddressId(id)}
        />
      )}
      {draft &&
        shop.products
          .filter((item) => item.id === draft.id)
          .map((item) => {
            const title = ar ? item.nameAr : item.name;
            const about = ar ? item.descAr : item.desc;
            const unit = item.price + choiceExtra(item, draft.picks);
            const ready = picksReady(item, draft.picks);
            return (
              <div key={item.id} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" onClick={() => setDraft(null)}>
                <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-paper p-4 shadow-md" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end">
                    <button type="button" className="size-10 text-xl" aria-label="Close" onClick={() => setDraft(null)}>
                      ×
                    </button>
                  </div>
                  <OptImg src={item.images[0]} alt="" className="h-44 w-full rounded-lg object-cover" />
                  <h3 className="mt-3 font-display text-2xl text-ink">{title}</h3>
                  <p className="mt-1 text-sm font-semibold text-gold">{item.priceMode && item.priceMode !== "price" ? priceLabel(item, ui.lang) : formatJod(unit)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-mute">{about}</p>
                  {(item.choices ?? []).map((choice, index) => (
                    <div key={`${choice.en}-${index}`} className="mt-4">
                      <p className="text-sm font-semibold">{ar ? choice.ar || choice.en : choice.en}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {choice.options.map((option, optionIndex) => {
                          const on = draft.picks[index] === optionIndex;
                          return (
                            <button
                              key={`${option.en}-${optionIndex}`}
                              type="button"
                              disabled={option.off}
                              className={cn(
                                "h-9 rounded-full px-3 text-sm",
                                option.off ? "border border-line text-mute line-through" : on ? "bg-ink text-cream" : "border border-line bg-white",
                              )}
                              onClick={() => setDraft({ ...draft, picks: draft.picks.map((pick, pickIndex) => (pickIndex === index ? optionIndex : pick)) })}
                            >
                              {ar ? option.ar || option.en : option.en}
                              {option.off ? ` · ${optionNote(option, ar)}` : option.extra ? ` +${option.extra}` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {item.chart && (
                    <button type="button" className="photo-open mt-4 block" aria-label={photoControlName(ui.lang, name, ar ? "الجدول" : "Chart")} onClick={() => ui.setShot({ src: item.chart, title: ar ? "الجدول" : "Chart", label: photoControlName(ui.lang, name, ar ? "الجدول" : "Chart") })}>
                      <OptImg src={item.chart} alt="" className="h-24 rounded-md border border-line object-cover" />
                      <span className="mt-1 block text-xs font-semibold underline">{ar ? "شوف الجدول" : "View chart"}</span>
                    </button>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold">{ar ? "العدد" : "Amount"}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" className="size-11 rounded-md border border-line" onClick={() => setDraft({ ...draft, qty: Math.max(0, draft.qty - 1) })}>
                        −
                      </button>
                      <span className="w-6 text-center tabular-nums">{draft.qty}</span>
                      <button type="button" className="size-11 rounded-md border border-line" onClick={() => setDraft({ ...draft, qty: draft.qty + 1 })}>
                        +
                      </button>
                    </div>
                  </div>
                  <label className="mt-4 block text-sm">
                    <span className="mb-1 block font-semibold">{ar ? "ملاحظة" : "Comment"}</span>
                    <textarea
                      className="h-24 w-full rounded-md border border-line bg-white p-3 text-sm"
                      value={draft.note}
                      placeholder={ar ? "اختياري" : "Optional"}
                      onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!ready || draft.qty < 1}
                    className="mt-4 h-12 w-full rounded-md bg-ink font-semibold text-cream disabled:opacity-40"
                    onClick={() => {
                      setCounts((c) => ({ ...c, [item.id]: draft.qty }));
                      setNotes((n) => ({ ...n, [item.id]: draft.note.trim() }));
                      setChosen((c) => ({ ...c, [item.id]: draft.picks }));
                      setDraft(null);
                    }}
                  >
                    {ar ? "حسناً" : "OK"}
                  </button>
                </div>
              </div>
            );
          })}
    </>
  );
}

function PremiumShop({ shop }: { shop: Shop }) {
  const ui = useShopChrome(shop);
  const { t, name, area, active } = ui;
  return (
    <>
      <div className="relative">
        <button
          type="button"
          className="photo-open block w-full"
          aria-label={photoControlName(ui.lang, name)}
          onClick={() => ui.setShot({ src: shop.cover ?? shop.avatar, title: name, text: ui.lang === "ar" ? shop.bioAr : shop.bio, label: photoControlName(ui.lang, name) })}
        >
          <FramedImage src={shop.cover ?? shop.avatar} frameId={`cover:${shop.slug}`} className="h-56 w-full sm:h-80" />
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-end justify-end px-4 py-4 sm:px-8">
          <div className="shop-actions">
            <ShareStall title={name} slug={shop.slug} label={t.share} copiedLabel={t.copied} />
            {!ui.own && !ui.seller && <BookmarkMenu shop={shop} bookmarked={ui.bookmarked} />}
            {!ui.own && (
            <button type="button" onClick={() => ui.setReportOn(true)} className={actionBtn}>
              <FlagIcon /> {t.report}
            </button>
            )}
          </div>
        </div>
      </div>
      <main className="grid items-start gap-8 px-4 pb-16 sm:px-8 lg:grid-cols-3">
        <aside className="lg:col-span-1">
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          <button type="button" className="photo-open" aria-label={photoControlName(ui.lang, name)} onClick={() => ui.setShot({ src: shop.avatar, title: name, text: `${area} · ${t.cityName}`, label: photoControlName(ui.lang, name) })}>
            <FramedImage src={shop.avatar} frameId={`avatar:${shop.slug}`} className="size-28 rounded-md border-4 border-paper object-cover shadow-md" />
          </button>
          <div>
            <h1 id="shop-name" className="mt-1 flex items-center gap-2 font-display text-4xl tracking-tight">
              {name}
              <Crown plan="premium" className="plan-badge profile-badge" />
            </h1>
            <AnimalSaleNotice />
            <p className="text-mute">
              {area} · {t.cityName} · {shop.since}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            shop.isOpen ? t.open : t.closed,
            `${shop.views?.toLocaleString()} ${t.views}`,
            `${shop.rating} · ${shop.reviewCount} ${t.reviews}`,
            shop.hours ?? "",
          ].map((s) => (
            <div key={s} className="rounded-lg border border-line bg-cream px-3 py-3 text-sm">
              {s}
            </div>
          ))}
        </div>
        <StallNote shop={shop} lang={ui.lang} />
        <p className="mt-6 max-w-2xl text-base leading-relaxed">{ui.lang === "ar" ? shop.bioAr : shop.bio}</p>
        <div className="mt-4 max-w-2xl"><AnimalRule ar={ui.lang === "ar"} /></div>
        <SellerNameNote slug={shop.slug} />
        {shop.keywords && (
          <div className="mt-4 flex flex-wrap gap-2">
            {shop.keywords.map((k) => (
              <span key={k} className="rounded-full border border-line px-3 py-1 text-xs text-mute">
                {k}
              </span>
            ))}
          </div>
        )}
        {shop.socials && shop.socials.length > 0 && (
          <div className="mt-4 flex gap-2">
            {shop.socials.map((item) => (
              <SocialMark key={item.href} label={item.label} href={item.href} />
            ))}
          </div>
        )}
        {shop.delivery && (
          <p className="mt-2 text-sm text-mute">
            {t.delivery}: {t.cityName} {shop.delivery.amman} · {t.outside} {shop.delivery.outside}
          </p>
        )}

        </aside>
        <section className="lg:col-span-2">
        <h2 className="font-display text-2xl">Collection</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {shop.products.map((p) => (
            <div
              key={p.id}
              className={cn(
                "grid grid-cols-[140px_1fr] overflow-hidden rounded-xl border border-line bg-cream text-start",
                active?.id === p.id && "ring-2 ring-stamp-blue",
              )}
            >
              <button
                type="button"
                className="photo-open"
                aria-label={photoControlName(ui.lang, name, ui.lang === "ar" ? p.nameAr : p.name)}
                onClick={() =>
                  ui.setShot({
                    src: p.images[0],
                    title: ui.lang === "ar" ? p.nameAr : p.name,
                    text: `${priceLabel(p, ui.lang)}\n${ui.lang === "ar" ? p.descAr : p.desc}`,
                    label: photoControlName(ui.lang, name, ui.lang === "ar" ? p.nameAr : p.name),
                  })
                }
              >
                <OptImg src={p.images[0]} alt="" className="h-full min-h-32 w-full object-cover" />
              </button>
              <button type="button" className="p-4 text-start" onClick={() => ui.setActive(p)}>
                <h3 className="font-display text-xl">{ui.lang === "ar" ? p.nameAr : p.name}</h3>
                <p className="text-sm text-mute">{priceLabel(p, ui.lang)}</p>
                <p className="mt-2 line-clamp-2 text-sm">{ui.lang === "ar" ? p.descAr : p.desc}</p>
              </button>
              {ui.own && <div className="col-span-2 px-4 pb-3"><ItemEdit id={p.id} own seller={ui.seller} loved={ui.fav(p.id)} lang={ui.lang} onLove={() => ui.toggleFavorite(p.id)} /></div>}
            </div>
          ))}
        </div>

        {active && !ui.own && (
        <div className="mt-8 rounded-xl bg-ink p-5 text-cream">
          <h3 className="font-display text-2xl">{ui.lang === "ar" ? active.nameAr : active.name}</h3>
          <p className="text-sand">{priceLabel(active, ui.lang)}</p>
          <div className="mt-4 max-w-md">
            <Gallery
              images={ui.images}
              photo={ui.photo}
              setPhoto={ui.setPhoto}
              title={active.name}
              label={photoControlName(ui.lang, name, ui.lang === "ar" ? active.nameAr : active.name)}
              onOpen={(src) =>
                ui.setShot({
                  src,
                  title: ui.lang === "ar" ? active.nameAr : active.name,
                  text: `${priceLabel(active, ui.lang)}\n${ui.lang === "ar" ? active.descAr : active.desc}`,
                  label: photoControlName(ui.lang, name, ui.lang === "ar" ? active.nameAr : active.name),
                })
              }
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="size-10 rounded-md bg-cream text-ink" onClick={() => ui.setQty(Math.max(1, ui.qty - 1))}>
              −
            </button>
            <span className="tabular-nums">{ui.qty}</span>
            <button type="button" className="size-10 rounded-md bg-cream text-ink" onClick={() => ui.setQty(ui.qty + 1)}>
              +
            </button>
          </div>
          <div className="mt-4">
            <WhatsAppCta shop={shop} product={active} qty={ui.qty} mode="invoice" />
          </div>
        </div>
        )}

        <section className="mt-10">
          <h2 className="font-display text-xl">{t.reviews}</h2>
          <DuckRating score={shop.rating ?? 0} />
          <ReviewList shop={shop} />
        </section>
        </section>
      </main>
      <PhotoFrame shot={ui.shot} onClose={() => ui.setShot(null)} />
      <ReportNote on={ui.reportOn} onClose={() => ui.setReportOn(false)} />
    </>
  );
}

function ReviewList({ shop }: { shop: Shop }) {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const ownReviews = useSession((s) => s.ownReviews);
  const votes = useSession((s) => s.reviewVotes);
  const removed = useSession((s) => s.removedReviews);
  const voteReview = useSession((s) => s.voteReview);
  const reportReview = useSession((s) => s.reportReview);
  const deleteReview = useSession((s) => s.deleteReview);
  const rows = [
    ...(shop.reviews ?? []).map((review, index) => ({
      ...review,
      key: `${shop.slug}:${index}`,
      own: false,
      id: "",
      authorPhone: "",
    })),
    ...ownReviews
      .filter((review) => review.shopSlug === shop.slug)
      .map((review) => ({ ...review, key: `${shop.slug}:${review.id}`, own: true, reply: undefined as string | undefined })),
  ].filter((review) => !removed.includes(review.key));

  return (
    <ul className="mt-4 divide-y divide-line">
      {rows.map((review) => {
        const tally = votes[review.key] ?? { up: [], down: [] };
        const mine = user?.phone;
        const upOn = mine ? tally.up.includes(mine) : false;
        const downOn = mine ? tally.down.includes(mine) : false;
        return (
          <li key={review.key} className="py-3">
            <p className="text-sm font-semibold">
              <Link to="/buyer/$username" params={{ username: review.user }} className="inline-flex items-center gap-2 text-ink underline">
                <OptImg src="/brand/avatars/buyer-duck.jpg?v=7" alt="" className="size-7 rounded-full object-cover" />
                {review.user}
              </Link>
              {" · "}
              {place(review.area, lang)}
            </p>
            <DuckRating score={review.score} size={22} />
            <p className="mt-1 text-sm">“{review.comment}”</p>
            {review.reply && <p className="mt-1 text-xs text-mute">Seller: {review.reply}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <button type="button" className={cn("h-8 rounded-md border px-2", upOn ? "border-ink bg-ink text-cream" : "border-line")} onClick={() => user && voteReview(review.key, "up")}>
                {t.useful} {tally.up.length}
              </button>
              <button type="button" className={cn("h-8 rounded-md border px-2", downOn ? "border-ink bg-ink text-cream" : "border-line")} onClick={() => user && voteReview(review.key, "down")}>
                {t.notUseful} {tally.down.length}
              </button>
              <button
                type="button"
                className="h-8 rounded-md border border-line px-2"
                onClick={() => {
                  if (!user) return;
                  reportReview(review.key, review.comment);
                }}
              >
                {t.report}
              </button>
              {review.own && review.authorPhone === user?.phone && (
                <button type="button" className="h-8 rounded-md border border-line px-2 text-red" onClick={() => deleteReview(review.id)}>
                  {t.deleteReview}
                </button>
              )}
            </div>
          </li>
        );
      })}
      <li className="py-3 text-xs italic leading-relaxed text-mute">{t.reviewNote}</li>
    </ul>
  );
}

export { PLANS };
