import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CATEGORIES, PLANS, deliveryAmount, displayPlan, formatJod, priceLabel, type Product, type Shop } from "@/lib/data";
import { displayOpen, slugForSeller, useSession } from "@/lib/session";
import { copy, place } from "@/lib/i18n";
import { PlanBadge } from "@/components/plan-stamp";
import { FramedImage } from "@/components/photo-frame";
import { DuckRating } from "@/components/duck-rating";
import { HeartIcon } from "@/components/heart";
import { WhatsAppCta } from "@/components/wa-sheet";
import { cn } from "@/lib/cn";
import { OptImg } from "@/components/opt-img";
import { helloLive, type HelloPost } from "@/lib/hello";
import { isPublishable } from "@/lib/shelves";
import { shopTopItems } from "@/lib/souq-sync";
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
    <div className="shop-section-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={!active} className={cn(!active && "is-on")} onClick={() => onPick("")}>
        {lang === "ar" ? "الكل" : "ALL"}
      </button>
      {named.map((group) => (
        <button
          key={group.key}
          type="button"
          role="tab"
          aria-selected={active === group.key}
          className={cn(active === group.key && "is-on")}
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
  const open = displayOpen(shop);
  const note = open === false
    ? lang === "ar" ? shop.closedNoteAr || shop.closedNote : shop.closedNote || shop.closedNoteAr
    : lang === "ar" ? shop.openNoteAr || shop.openNote : shop.openNote || shop.openNoteAr;
  if (!note) return null;
  return <p className="mt-1 text-sm text-ink">{note}</p>;
}

function HoursStatus({ shop, lang }: { shop: Shop; lang: "en" | "ar" }) {
  const t = copy[lang];
  const open = displayOpen(shop);
  if (open == null && !shop.hours) return <StallNote shop={shop} lang={lang} />;
  return (
    <>
      {open == null ? (
        <p className="mt-2 text-sm text-mute">{shop.hours}</p>
      ) : (
        <p className={cn("mt-2 text-sm font-semibold", open ? "text-stamp-green" : "text-mute")}>
          {open ? `● ${t.open}` : `● ${t.closed}`}
          {shop.hours ? ` · ${shop.hours}` : ""}
        </p>
      )}
      {open === false && shop.contactWhenClosed !== false && !shop.closedNote && !shop.closedNoteAr && (
        <p className="mt-1 text-xs text-mute">{lang === "ar" ? "مغلق، والتواصل مفتوح." : "Closed, and you can still message them."}</p>
      )}
      <StallNote shop={shop} lang={lang} />
    </>
  );
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
  if (shop.plan !== "basic" && shop.plan !== "pro" && shop.plan !== "premium") return null;
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
  return (
    <div className="shop-view">
      <PublicStall shop={shop} />
    </div>
  );
}

function PublicStall({ shop }: { shop: Shop }) {
  const ui = useShopChrome(shop);
  const { t, name, area } = ui;
  const ar = ui.lang === "ar";
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
  const follows = useSession((s) => s.follows) ?? [];
  const toggleFollow = useSession((s) => s.toggleFollow);
  const navigate = useNavigate();
  const [tab, setTab] = useState<"menu" | "inquire" | "reviews" | "hello" | "top">("menu");
  const [sectionKey, setSectionKey] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<Record<string, number[]>>({});
  const [draft, setDraft] = useState<{ id: string; qty: number; note: string; picks: number[] } | null>(null);
  const [preview, setPreview] = useState(false);
  const [tops, setTops] = useState<{ id: string; name: string; score: number }[]>([]);
  const [videoOn, setVideoOn] = useState(false);
  const open = displayOpen(shop);
  const following = follows.includes(shop.slug);
  const followerCount = (shop.followers ?? 0) + Object.values(accounts).filter((account) => account.role !== "seller" && (account.follows ?? []).includes(shop.slug)).length;
  const reviewCount = shop.reviewCount ?? shop.reviews?.length ?? 0;
  const views = shop.views ?? 0;
  const cat = CATEGORIES.find((item) => item.id === shop.category);
  const catLabel = shop.offAisle || !cat || cat.id === "all" ? "" : ar ? cat.ar : cat.en;
  const posts = Object.values(accounts as Record<string, { helloPosts?: HelloPost[]; role?: string; follows?: string[] }>).flatMap((account) => account.helloPosts ?? []).filter((post) => post.shopSlug === shop.slug && helloLive(post));
  const video = shop.plan === "premium" ? (shop as Shop & { profileVideo?: string }).profileVideo : undefined;
  const sections = useMemo(() => menuGroups(shop.products).filter((group) => group.items.length > 0), [shop.products]);
  const shown = sectionKey ? sections.filter((group) => group.key === sectionKey) : sections;
  const visible = shop.products.filter((product) => !product.paused && !product.hideReason);
  const topProduct = visible.find((product) => product.id === tops[0]?.id) ?? visible[0];
  const helloPost = posts[0];
  const newest = shop.reviews?.[shop.reviews.length - 1];
  const mode = shop.plan === "premium" || shop.plan === "pro" ? "invoice" : "inquire";
  const lines = shop.products
    .filter((product) => !product.paused && !product.hideReason)
    .map((product) => {
      const qty = counts[product.id] ?? 0;
      const picks = chosen[product.id];
      const priced = !product.priceMode || product.priceMode === "price";
      return {
        product,
        qty,
        note: notes[product.id]?.trim() || "",
        detail: choiceLabel(product, picks, ui.lang),
        lineTotal: priced ? (product.price + choiceExtra(product, picks)) * qty : null,
      };
    })
    .filter((line) => line.qty > 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const orderTotal = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const priceOnRequest = lines.some((line) => line.lineTotal == null);
  useEffect(() => {
    setCounts({});
    setNotes({});
    setChosen({});
    setDraft(null);
    setPreview(false);
  }, [shop.slug]);
  useEffect(() => {
    let stop = false;
    void shopTopItems({ data: { slug: shop.slug } }).then((res) => {
      if (!stop && res.ok) setTops(res.items);
    }).catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [shop.slug]);

  function guard(run: () => void) {
    if (!user) {
      void navigate({ to: "/sign-in", search: { next: `/shop/${shop.slug}` } });
      return;
    }
    if (user.role === "seller" && !ui.own) return;
    run();
  }

  return (
    <>
      <div className="stall-cover">
        {shop.cover ? (
          <button type="button" className="stall-cover-photo" onClick={() => ui.setShot({ src: shop.cover, title: name, text: ar ? shop.bioAr : shop.bio, label: name })}>
            <FramedImage src={shop.cover} frameId={`cover:${shop.slug}`} className="absolute inset-0 h-full w-full" />
          </button>
        ) : (
          <div className="stall-cover-empty" aria-hidden="true" />
        )}
        <div className="stall-cover-bar">
          <Link to="/home" className="stall-back" aria-label={ar ? "رجوع" : "Back"}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link to="/home" className="stall-cover-brand">
            <img src="/brand/duck-mark.png" alt="" />
            <span>Souq Battuta</span>
          </Link>
          <div className="stall-cover-tools">
            <ShareStall title={name} slug={shop.slug} label={t.share} copiedLabel={t.copied} />
            {!ui.own && !ui.seller && <BookmarkMenu shop={shop} bookmarked={ui.bookmarked} />}
          </div>
        </div>
        <div className="stall-motif" aria-hidden="true" />
        <button type="button" className="stall-logo" onClick={() => ui.setShot({ src: shop.avatar, title: name, label: name })}>
          <FramedImage src={shop.avatar || "/brand/avatars/default-duck.jpg"} frameId={`avatar:${shop.slug}`} alt="" className="stall-logo-photo" />
        </button>
      </div>
      <main className="stall-sheet">
        {ui.own && !isPublishable(shop) && (
          <div className="mx-4 mt-4 rounded-md border-2 border-[#FFB705] bg-[#fff8e6] px-4 py-3 text-sm text-[#0B2A5B]">
            <p>Your shop is hidden until you add a WhatsApp number for orders. · دكانك مخفي لحد ما تضيف رقم واتساب للطلبات.</p>
            <Link to="/seller" search={{ tab: "edit" }} className="mt-2 inline-flex h-11 items-center rounded-md bg-ink px-4 font-semibold text-cream">Add WhatsApp · أضف واتساب</Link>
          </div>
        )}
        <p className="stall-kicker">{[catLabel, area].filter(Boolean).join(" · ")}</p>
        <h1 id="shop-name" className="stall-sign">
          {name}
          <PlanBadge plan={displayPlan(shop.plan)} size="profile" />
        </h1>
        {shop.nameAr && shop.nameAr !== name && <p className="stall-sign-ar" dir="rtl" lang="ar">{shop.nameAr}</p>}
        <div className="stall-rule" aria-hidden="true"><i /><b /><i /></div>
        {open != null && (
          <p className="stall-hours">
            <b className={open ? "is-open" : "is-closed"}>{open ? (ar ? "● مفتوح" : "● OPEN") : ar ? "● مغلق" : "● CLOSED"}</b>
            {shop.hours && <><span>|</span>{shop.hours}</>}
          </p>
        )}
        {(reviewCount > 0 || followerCount > 0 || views > 0) && (
          <div className="stall-counts">
            {reviewCount > 0 && <div><b>{reviewCount}</b><span>{t.reviews}</span></div>}
            {followerCount > 0 && <div><b>{followerCount}</b><span>{t.followers}</span></div>}
            {views > 0 && <div><b>{views.toLocaleString()}</b><span>{t.views}</span></div>}
          </div>
        )}
        {(shop.bio || shop.bioAr) && <p className="stall-about">“{ar ? shop.bioAr || shop.bio : shop.bio}”</p>}
        {!ui.seller && (
          <button type="button" className={cn("stall-follow", following && "is-on")} onClick={() => guard(() => toggleFollow(shop.slug))}>
            {following ? t.following : t.follow}
          </button>
        )}
        <div className="stall-circles">
          <button type="button" className={posts.length ? "is-live" : ""} onClick={() => setTab("hello")}>
            <i>{helloPost?.image && posts.length > 0 ? <img src={helloPost.image} alt="" /> : <img src="/brand/hello-motif-a-inactive.svg" alt="" />}</i>
            <span>Hello, World!</span>
          </button>
          <button type="button" onClick={() => setTab("reviews")}>
            <i><img src="/brand/duck-mark.png" alt="" /></i>
            <span>{t.reviews}</span>
          </button>
          {video && (
            <button type="button" className="is-video" onClick={() => setVideoOn(true)}>
              <i><span className="stall-play" /></i>
              <span>{ar ? "فيديو" : "Video"}</span>
            </button>
          )}
          {visible.length > 0 && (
            <button type="button" onClick={() => setTab("top")}>
              <i>{topProduct?.images[0] && <img src={topProduct.images[0]} alt="" />}<b className="stall-star" aria-hidden="true">★</b></i>
              <span>{ar ? "الأبرز" : "Top items"}</span>
            </button>
          )}
        </div>
        {tab === "hello" && posts.length === 0 && <p className="stall-note">{ar ? "ما في منشور اليوم." : "No post today."}</p>}
        {tab === "hello" && (
          <ul className="stall-hello">
            {posts.map((post) => (
              <li key={post.id}>
                {post.image && <OptImg src={post.image} alt="" />}
                <p>{post.text}</p>
              </li>
            ))}
          </ul>
        )}
        {tab === "reviews" && (
          <section id="shop-reviews">
            <ReviewList shop={shop} />
          </section>
        )}
        {tab === "top" && (
          <ul className="stall-tops">
            {tops.map((item) => (
              <li key={item.id}><b>{item.name}</b><span>{item.score}</span></li>
            ))}
          </ul>
        )}
        {open === false && shop.contactWhenClosed === false && !ui.own && (
          <p className="mb-3 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-mute">{ar ? "مغلق الآن، والتواصل مقفل لين يفتح." : "Closed now. Contact is off until they open."}</p>
        )}
        <div className="stall-tabs" role="tablist">
          <button type="button" className={tab === "menu" || tab === "reviews" || tab === "hello" || tab === "top" ? "is-on" : ""} onClick={() => setTab("menu")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            {t.menu}
          </button>
          <button type="button" className={tab === "inquire" ? "is-on" : ""} onClick={() => setTab("inquire")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            {t.orderInquireNow}
          </button>
        </div>
        <SectionTabs groups={sections} active={sectionKey} onPick={setSectionKey} lang={ui.lang} />
        {tab !== "inquire" ? (
          <div className="stall-grid">
            {shop.products.length === 0 && <NewOnSouq lang={ui.lang} />}
            {shown.flatMap((group) => group.items).map((product) => (
              <button key={product.id} type="button" className="stall-item" onClick={() => ui.setShot({ images: product.images, index: 0, title: ar ? product.nameAr : product.name, text: `${priceLabel(product, ui.lang)}\n${ar ? product.descAr : product.desc}`, label: ar ? product.nameAr : product.name })}>
                <OptImg src={product.images[0] || "/brand/avatars/default-duck.jpg"} alt="" />
                <b>{priceLabel(product, ui.lang)}</b>
                {product.images.length > 1 && (
                  <span className="stall-more-photos" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><rect x="7" y="7" width="12" height="12" rx="2" /><rect x="4" y="4" width="12" height="12" rx="2" /></svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="order-list">
            {shown.map((group) => {
              const items = group.items.filter((product) => !product.paused && !product.hideReason);
              if (!items.length) return null;
              return (
                <section key={group.key || "menu"}>
                  {group.title && <h3 className="order-group">{ar ? group.titleAr || group.title : group.title}</h3>}
                  <ul>
                    {items.map((product) => (
                      <OrderLine
                        key={product.id}
                        product={product}
                        lang={ui.lang}
                        qty={counts[product.id] ?? 0}
                        note={notes[product.id]}
                        onOpen={() => setDraft({ id: product.id, qty: counts[product.id] ?? 1, note: notes[product.id] ?? "", picks: chosen[product.id] ?? defaultPicks(product) })}
                        onInc={() => setCounts((c) => ({ ...c, [product.id]: (c[product.id] ?? 0) + 1 }))}
                        onDec={() => setCounts((c) => ({ ...c, [product.id]: Math.max(0, (c[product.id] ?? 0) - 1) }))}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
        <section className="stall-reviews">
          <h2>{t.reviews}</h2>
          {reviewCount > 0 ? (
            <>
              <div className="stall-reviews-meta">
                <DuckRating score={shop.rating ?? 0} />
                <span>{shop.rating ?? "–"} · {reviewCount}</span>
              </div>
              {newest && <p className="stall-reviews-quote">“{newest.comment}”</p>}
              {newest && (
                <div className="stall-reviews-by">
                  <img src="/brand/avatars/buyer-duck.jpg" alt="" />
                  <span>{newest.user}</span>
                  <button type="button" onClick={() => setTab("reviews")}>{ar ? "اقرأ التقييمات" : "Read reviews"}</button>
                </div>
              )}
            </>
          ) : (
            <p className="stall-note">{ar ? "لا تقييمات بعد." : "No reviews yet"}</p>
          )}
          {tab === "reviews" && <ReviewList shop={shop} />}
        </section>
        <div className="stall-actions">
          <ShareStall title={name} slug={shop.slug} label={t.share} copiedLabel={t.copied} />
          {!ui.own && !ui.seller && <BookmarkMenu shop={shop} bookmarked={ui.bookmarked} />}
          <button type="button" onClick={() => ui.setReportOn(true)}>{t.report}</button>
        </div>
        {(open !== false || shop.contactWhenClosed !== false) && shop.products[0] && (
          <div className={cn("stall-order-bar", tab === "inquire" && itemCount > 0 && "is-total")}>
            {tab === "inquire" && itemCount > 0 ? (
              <>
                <div className="order-total-copy">
                  <p>{itemCount} items · {itemCount} أصناف</p>
                  <b>{formatJod(orderTotal)}</b>
                  {priceOnRequest && <span>+ price on request</span>}
                </div>
                {!user ? (
                  <Link to="/sign-in" search={{ next: `/shop/${shop.slug}` }}>{t.loginToContact}</Link>
                ) : user.role === "seller" && !ui.own ? null : shop.hasWhatsapp ? (
                  <button type="button" onClick={() => setPreview(true)}>
                    <i />
                    Send via WhatsApp · أرسل عبر واتساب
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" onClick={() => setTab("inquire")}>
                <i />
                {t.orderInquireNow}
              </button>
            )}
          </div>
        )}
      </main>
      {draft && (
        <OrderDraft
          shop={shop}
          draft={draft}
          lang={ui.lang}
          onClose={() => {
            const id = draft.id;
            setDraft(null);
            window.setTimeout(() => document.getElementById(`order-row-${id}`)?.querySelector("button")?.focus(), 0);
          }}
          onSave={(next) => {
            setCounts((c) => ({ ...c, [next.id]: next.qty }));
            setNotes((n) => ({ ...n, [next.id]: next.note }));
            setChosen((c) => ({ ...c, [next.id]: next.picks }));
            setDraft(null);
            window.setTimeout(() => document.getElementById(`order-row-${next.id}`)?.querySelector("button")?.focus(), 0);
          }}
        />
      )}
      {preview && lines[0] && (
        <OrderPreview
          shop={shop}
          name={name}
          lines={lines}
          mode={mode}
          onClose={() => setPreview(false)}
          onSent={() => {
            setPreview(false);
            setCounts({});
            setNotes({});
            setChosen({});
            setDraft(null);
          }}
        />
      )}
      {videoOn && video && (
        <div className="stall-video" role="dialog">
          <button type="button" onClick={() => setVideoOn(false)}>×</button>
          <video src={video} controls playsInline />
        </div>
      )}
      <PhotoFrame shot={ui.shot} onClose={() => ui.setShot(null)} />
      <ReportNote on={ui.reportOn} onClose={() => ui.setReportOn(false)} />
    </>
  );
}

function PetRuleLine() {
  return (
    <p className="mx-4 mt-3 text-sm leading-snug text-ink sm:mx-8">
      <span lang="en">Animal sales are prohibited. Adopt, don't shop.</span>
      {" · "}
      <span lang="ar" dir="rtl">بيع الحيوانات غير مسموح. التبني أولاً.</span>
      {" · "}
      <Link to="/rules" className="font-semibold underline">
        Read rules
      </Link>
    </p>
  );
}

function NewOnSouq({ lang }: { lang: "en" | "ar" }) {
  return (
    <p className="rounded-xl border border-line bg-cream px-4 py-6 text-sm text-mute">
      {lang === "ar" ? "جدد على السوق، الأصناف قريباً." : "New on the Souq, items coming soon"}
    </p>
  );
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
      {product.video && (
        <video className="shop-tile-video" controls playsInline preload="metadata" src={product.video} />
      )}
      <div className="shop-tile-body">
        <button type="button" className="shop-tile-name" onClick={onOpen}>
          <b>{copy.title}</b>
        </button>
        <span className="menu-price">{priceLabel(product, lang)}</span>
        {product.paused && <span className="block text-xs text-red">{pauseText(product, lang)}</span>}
        <span className="shop-tile-meta">
          {likes > 0 && <span className="shop-tile-likes heart-count"><HeartIcon /> {likes}</span>}
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
  qty,
  note,
  onOpen,
  onInc,
  onDec,
}: {
  product: Product;
  lang: "en" | "ar";
  qty: number;
  note?: string;
  onOpen: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const name = lang === "ar" ? product.nameAr : product.name;
  return (
    <li id={`order-row-${product.id}`} className={cn("order-row", qty > 0 && "is-on")}>
      <button type="button" className="order-row-main" onClick={onOpen}>
        <OptImg src={product.images[0] || "/brand/avatars/default-duck.jpg"} alt="" className="order-row-photo" />
        <span className="min-w-0">
          <b>{name}</b>
          <span className="order-row-price">{priceLabel(product, lang)}</span>
          {note?.trim() && <span className="order-row-note">“{note.trim()}”</span>}
        </span>
      </button>
      {qty < 1 ? (
        <button type="button" className="order-plus" aria-label="+" onClick={onInc}>+</button>
      ) : (
        <span className="order-step">
          <button type="button" aria-label="−" onClick={onDec}>−</button>
          <b>{qty}</b>
          <button type="button" aria-label="+" onClick={onInc}>+</button>
        </span>
      )}
    </li>
  );
}

function useSheetTrap(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const node = ref.current;
    const items = () => [...(node?.querySelectorAll<HTMLElement>("button, a, input, select, textarea") ?? [])].filter((el) => !el.hasAttribute("disabled"));
    items()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return ref;
}

function OrderDraft({
  shop,
  draft,
  lang,
  onClose,
  onSave,
}: {
  shop: Shop;
  draft: { id: string; qty: number; note: string; picks: number[] };
  lang: "en" | "ar";
  onClose: () => void;
  onSave: (next: { id: string; qty: number; note: string; picks: number[] }) => void;
}) {
  const [local, setLocal] = useState(draft);
  const ref = useSheetTrap(onClose);
  const item = shop.products.find((product) => product.id === draft.id);
  if (!item) return null;
  const ar = lang === "ar";
  const unit = item.price + choiceExtra(item, local.picks);
  const priced = !item.priceMode || item.priceMode === "price";
  const ready = picksReady(item, local.picks);
  const lineTotal = priced ? formatJod(unit * local.qty) : priceLabel(item, lang);
  return (
    <div className="order-sheet" onClick={onClose}>
      <div ref={ref} className="order-sheet-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="order-handle" aria-hidden="true" />
        <button type="button" className="order-x" aria-label={ar ? "إغلاق" : "Close"} onClick={onClose}>×</button>
        <OptImg src={item.images[0] || "/brand/avatars/default-duck.jpg"} alt="" className="order-photo" />
        <h3>{ar ? item.nameAr : item.name}</h3>
        {item.nameAr && item.nameAr !== item.name && <p className="order-ar" dir="rtl" lang="ar">{item.nameAr}</p>}
        <p className="order-price">{priced ? formatJod(unit) : priceLabel(item, lang)}</p>
        {(item.choices ?? []).map((choice, index) => (
          <div key={`${choice.en}-${index}`} className="mt-4">
            <p className="text-sm font-semibold">{choiceLabelHeading(choice, ar)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {choice.options.map((option, optionIndex) => {
                const on = local.picks[index] === optionIndex;
                return (
                  <button
                    key={`${option.en}-${optionIndex}`}
                    type="button"
                    disabled={option.off}
                    className={cn("h-9 rounded-full px-3 text-sm", option.off ? "border border-line text-mute line-through" : on ? "bg-ink text-cream" : "border border-line bg-white")}
                    onClick={() => setLocal({ ...local, picks: local.picks.map((pick, pickIndex) => (pickIndex === index ? optionIndex : pick)) })}
                  >
                    {ar ? option.ar || option.en : option.en}
                    {option.off ? ` · ${optionNote(option, ar)}` : option.extra ? ` +${option.extra}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="order-amount">
          <span>Amount · العدد</span>
          <span>
            <button type="button" aria-label="−" onClick={() => setLocal({ ...local, qty: Math.max(0, local.qty - 1) })}>−</button>
            <b>{local.qty}</b>
            <button type="button" aria-label="+" onClick={() => setLocal({ ...local, qty: local.qty + 1 })}>+</button>
          </span>
        </div>
        <label className="order-note">
          <span>Comment · ملاحظة (optional · اختياري)</span>
          <textarea maxLength={200} value={local.note} onChange={(event) => setLocal({ ...local, note: event.target.value.slice(0, 200) })} />
        </label>
        <button
          type="button"
          className="order-add"
          disabled={local.qty > 0 && !ready}
          onClick={() => onSave({ ...local, qty: local.qty > 0 && ready ? local.qty : 0, note: local.note.trim() })}
        >
          {ar ? `أضف للطلب · ${lineTotal}` : `Add to order · ${lineTotal}`}
        </button>
      </div>
    </div>
  );
}

function choiceLabelHeading(choice: { en: string; ar?: string }, ar: boolean) {
  return ar ? choice.ar || choice.en : choice.en;
}

function OrderPreview({
  shop,
  name,
  lines,
  mode,
  onClose,
  onSent,
}: {
  shop: Shop;
  name: string;
  lines: { product: Product; qty: number; note?: string; detail?: string; lineTotal?: number | null }[];
  mode: "inquire" | "invoice";
  onClose: () => void;
  onSent: () => void;
}) {
  const ref = useSheetTrap(onClose);
  return (
    <div className="order-sheet" onClick={onClose}>
      <div ref={ref} className="order-sheet-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="order-handle" aria-hidden="true" />
        <button type="button" className="order-x" aria-label="Close" onClick={onClose}>×</button>
        <h3>Check your message / راجع رسالتك</h3>
        <p className="order-to">To {name} on WhatsApp · not sent until you tap send in WhatsApp</p>
        <WhatsAppCta shop={shop} product={lines[0].product} items={lines} mode={mode} preview onEdit={onClose} onSent={onSent} />
      </div>
    </div>
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
              {review.own && (
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
