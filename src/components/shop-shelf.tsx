import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { CATEGORIES, type Shop } from "@/lib/data";
import { PlanStamp } from "@/components/plan-stamp";
import { HeartIcon } from "@/components/heart";
import { DuckRating } from "@/components/duck-rating";
import { OptImg } from "@/components/opt-img";
import { useSession } from "@/lib/session";

const PEEK_KEY = "souq-peek";

type PeekMemory = {
  path: string;
  shelf: string;
  slug: string;
  scroll: number;
  y: number;
};

function readPeek(): PeekMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PEEK_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PeekMemory;
    if (!data?.slug || data.path !== window.location.pathname) return null;
    return data;
  } catch {
    return null;
  }
}

function writePeek(memory: PeekMemory | null) {
  if (memory) sessionStorage.setItem(PEEK_KEY, JSON.stringify(memory));
  else sessionStorage.removeItem(PEEK_KEY);
}

function useReturnPeek(id: string, shops: Shop[]) {
  const memory = useRef(readPeek());
  const [index, setIndex] = useState<number | null>(() => {
    const saved = memory.current;
    if (!saved || saved.shelf !== id) return null;
    const at = shops.findIndex((shop) => shop.slug === saved.slug);
    return at >= 0 ? at : null;
  });
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    const saved = memory.current;
    if (!saved || saved.shelf !== id) return;
    const apply = () => window.scrollTo(0, saved.y || 0);
    apply();
    const timers = [0, 120, 280].map((ms) => window.setTimeout(apply, ms));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [id]);

  function remember(at: number | null, scroll?: number) {
    if (at == null || !shops[at]) {
      if (readPeek()?.shelf === id) writePeek(null);
      setIndex(null);
      return;
    }
    const slug = shops[at].slug;
    const prev = readPeek();
    const same = prev?.shelf === id && prev.slug === slug;
    writePeek({
      path: window.location.pathname,
      shelf: id,
      slug,
      scroll: scroll ?? (same ? prev?.scroll ?? 0 : 0),
      y: scroll == null ? window.scrollY : prev?.y ?? window.scrollY,
    });
    if (indexRef.current !== at) setIndex(at);
  }

  const savedScroll = memory.current?.shelf === id ? memory.current.scroll : 0;
  return { index, remember, savedScroll };
}

const CAT_IDS = ["food", "crafts", "plants", "beauty", "pets", "clothes", "misc", "all"] as const;

export function CategoryRail({ ar, active }: { ar: boolean; active?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  function step(dir: number) {
    const el = scroller.current;
    if (!el) return;
    const toward = (ar ? -1 : 1) * dir;
    el.scrollBy({ left: toward * Math.max(160, el.clientWidth * 0.72), behavior: "smooth" });
  }
  return (
    <div className="cat-rail">
      <button type="button" className="shelf-arrow is-prev cat-rail-arrow" aria-label={ar ? "السابق" : "Previous"} onClick={() => step(-1)}>
        <Chevron />
      </button>
      <div className="home-cats" ref={scroller}>
        {CAT_IDS.map((id) => {
          const c = CATEGORIES.find((item) => item.id === id)!;
          return (
            <Link key={c.id} to="/category/$id" params={{ id: c.id }} className={c.id === active ? "home-cat is-on" : "home-cat"}>
              <span className="home-cat-frame">
                <OptImg src={c.icon} alt="" />
              </span>
              <span className="home-cat-copy">
                <b className={ar ? "font-arabic" : undefined}>{ar ? c.ar : c.en}</b>
                <span className={ar ? undefined : "font-arabic"}>{ar ? c.en : c.ar}</span>
              </span>
            </Link>
          );
        })}
      </div>
      <button type="button" className="shelf-arrow cat-rail-arrow" aria-label={ar ? "التالي" : "Next"} onClick={() => step(1)}>
        <Chevron />
      </button>
    </div>
  );
}

export function ShopTiles({
  shops,
  ar,
  distances,
  className = "shelf-grid",
  scroller,
  onPhoto,
  shelf = "tiles",
}: {
  shops: Shop[];
  ar: boolean;
  distances?: Record<string, number>;
  className?: string;
  scroller?: RefObject<HTMLDivElement | null>;
  onPhoto?: (index: number) => void;
  shelf?: string;
}) {
  const peek = useReturnPeek(shelf, shops);
  const open = onPhoto ? null : peek.index;
  return (
    <div className={className} ref={scroller}>
      {shops.map((shop, index) => {
        const reviews = shop.reviews ?? [];
        const count = shop.reviewCount ?? reviews.length;
        const rating =
          shop.rating ?? (count ? Math.round((reviews.reduce((sum, review) => sum + review.score, 0) / count) * 10) / 10 : 0);
        const category = CATEGORIES.find((item) => item.id === shop.category);
        const pics = sideThumbs(shop);
        const lead = pics.find((pic) => !pic.missing)?.src || shop.avatar;
        const name = ar ? shop.nameAr : shop.name;
        return (
          <article
            key={shop.slug}
            className="stall-card"
            role="button"
            tabIndex={0}
            onClick={() => (onPhoto ? onPhoto(index) : peek.remember(index))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPhoto ? onPhoto(index) : peek.remember(index);
              }
            }}
          >
            <span className="stall-card-inner">
              <span className="stall-face-desk">
              <span className="stall-card-catrow">
                {category && <span className="stall-card-cat">{ar ? category.ar : category.en}</span>}
                <PlanStamp plan={shop.plan} className="plan-badge" />
              </span>
              <span className="stall-card-photos">
                <OptImg className="stall-card-photo" src={shop.avatar} alt="" />
                <span className="stall-card-side">
                  {pics.map((pic, index) => (
                    <span key={`${pic.src}-${index}`} className={pic.missing ? "stall-sub is-missing" : "stall-sub"}>
                      <OptImg src={pic.src} alt="" />
                      {pic.missing && (
                        <span className="stall-missing">
                          <b>Image not available</b>
                          <b className="font-arabic">الصورة غير متاحة</b>
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              </span>
              <span className="stall-card-foot">
                <span className={ar ? "stall-card-name font-arabic" : "stall-card-name"}>
                  {name}
                </span>
                <span className="stall-card-meta">
                  {shop.plan !== "free" && (
                    <span className="stall-card-rating">
                      <DuckRating score={rating} size={16} />
                      {count > 0 && <em>{rating}</em>}
                    </span>
                  )}
                  <span className="stall-card-likes">
                    <HeartIcon />
                    {shop.likes ?? 0}
                    {distances?.[shop.slug] != null && (
                      <span className="stall-card-km">{distances[shop.slug] < 1 ? distances[shop.slug].toFixed(1) : Math.round(distances[shop.slug])} {ar ? "كم" : "km"}</span>
                    )}
                  </span>
                </span>
              </span>
              </span>
              <span className="stall-face-phone">
                <span className="stall-phone-shot">
                  <OptImg className="stall-phone-pic" src={lead} alt="" />
                  <OptImg className="stall-phone-avatar" src={shop.avatar} alt="" />
                  <PlanStamp plan={shop.plan} className="plan-badge stall-phone-crown" />
                </span>
                <span className={ar ? "stall-card-name font-arabic" : "stall-card-name"}>{name}</span>
                <span className="stall-card-meta">
                  {shop.plan !== "free" && (
                    <span className="stall-card-rating">
                      <DuckRating score={rating} size={12} />
                      {count > 0 && <em>{rating}</em>}
                    </span>
                  )}
                </span>
              </span>
            </span>
          </article>
        );
      })}
      {onPhoto == null && open != null && (
        <StallPeek
          shops={shops}
          index={open}
          ar={ar}
          scroll={peek.savedScroll}
          onClose={() => peek.remember(null)}
          onIndex={(next) => peek.remember(next)}
          onSheetScroll={(top) => peek.remember(open, top)}
        />
      )}
    </div>
  );
}

export function ShopShelf({ id, shops, ar, distances, windowed = false }: { id: string; shops: Shop[]; ar: boolean; distances?: Record<string, number>; windowed?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const perPage = usePairCount();
  const [limit, setLimit] = useState(windowed ? 8 : shops.length);
  useEffect(() => {
    setLimit(windowed ? 8 : shops.length);
  }, [windowed, shops.length, id]);
  const visible = windowed ? shops.slice(0, limit) : shops;
  const peek = useReturnPeek(id, visible);
  const pages: Shop[][] = [];
  for (let i = 0; i < visible.length; i += perPage) pages.push(visible.slice(i, i + perPage));
  function step(dir: number) {
    const el = scroller.current;
    if (!el) return;
    const width = el.clientWidth;
    const max = el.scrollWidth - width - 8;
    const pos = Math.abs(el.scrollLeft);
    const toward = (ar ? -1 : 1) * dir;
    if (dir > 0 && pos >= max) {
      if (windowed && limit < shops.length) {
        setLimit((count) => Math.min(shops.length, count + 8));
        return;
      }
      el.scrollTo({ left: 0, behavior: "smooth" });
    }
    else if (dir < 0 && pos <= 8) el.scrollTo({ left: (ar ? -1 : 1) * el.scrollWidth, behavior: "smooth" });
    else el.scrollBy({ left: toward * width, behavior: "smooth" });
  }
  return (
    <div className="shelf-frame is-pairs">
      {pages.length > 1 && (
        <button type="button" className="shelf-arrow is-prev" aria-label={ar ? "السابق" : "Previous"} onClick={() => step(-1)}>
          <Chevron />
        </button>
      )}
      <div className="shelf-viewport is-side" ref={scroller}>
        {pages.map((group, index) => (
          <ShopTiles key={group.map((shop) => shop.slug).join("-") || index} className="shelf-page" shops={group} ar={ar} distances={distances} shelf={`${id}-page`} onPhoto={(at) => peek.remember(index * perPage + at)} />
        ))}
      </div>
      {pages.length > 1 && (
        <button type="button" className="shelf-arrow" aria-label={ar ? "التالي" : "Next"} onClick={() => step(1)}>
          <Chevron />
        </button>
      )}
      {peek.index != null && (
        <StallPeek
          shops={visible}
          index={peek.index}
          ar={ar}
          scroll={peek.savedScroll}
          onClose={() => peek.remember(null)}
          onIndex={(next) => peek.remember(next)}
          onSheetScroll={(top) => peek.remember(peek.index, top)}
        />
      )}
    </div>
  );
}

function usePairCount() {
  const [count, setCount] = useState(2);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 760px)");
    const apply = () => setCount(narrow.matches ? 4 : 2);
    apply();
    narrow.addEventListener("change", apply);
    return () => narrow.removeEventListener("change", apply);
  }, []);
  return count;
}

function useShelfSize() {
  const [size, setSize] = useState(3);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 760px)");
    const apply = () => setSize(narrow.matches ? 1 : 4);
    apply();
    narrow.addEventListener("change", apply);
    return () => narrow.removeEventListener("change", apply);
  }, []);
  return size;
}

function sideThumbs(shop: Shop) {
  const placeholder = (src: string) => /default-duck|seller-duck|buyer-duck/.test(src);
  const real: string[] = [];
  for (const product of shop.products) {
    for (const image of product.images) {
      if (image && !placeholder(image) && image !== shop.avatar && !real.includes(image)) real.push(image);
    }
  }
  if (real.length === 0 && shop.avatar && !placeholder(shop.avatar)) {
    return [0, 1].map(() => ({ src: shop.avatar, missing: false }));
  }
  if (real.length === 0) return [0, 1].map(() => ({ src: "/brand/avatars/default-duck.jpg", missing: true }));
  return [0, 1].map((index) => ({ src: real[index % real.length], missing: false }));
}

function gallery(shop: Shop) {
  const placeholder = (src: string) => /default-duck|seller-duck|buyer-duck/.test(src);
  const real: string[] = [];
  for (const product of shop.products) {
    for (const image of product.images) {
      if (image && !placeholder(image) && !real.includes(image)) real.push(image);
    }
  }
  const miss = { src: "/brand/avatars/default-duck.jpg", missing: true };
  if (real.length === 0) return { lead: shop.avatar, side: [miss, miss] };
  return {
    lead: real[0],
    side: [0, 1].map((index) => ({ src: real[(index + 1) % real.length], missing: false })),
  };
}

function PeekMenu({ shop, ar, bar = false }: { shop: Shop; ar: boolean; bar?: boolean }) {
  const user = useSession((s) => s.user);
  const follows = useSession((s) => s.follows) ?? [];
  const bookmarks = useSession((s) => s.bookmarks);
  const lists = useSession((s) => s.bookmarkLists ?? []);
  const reports = useSession((s) => s.reports) ?? [];
  const toggleFollow = useSession((s) => s.toggleFollow);
  const saveBookmark = useSession((s) => s.saveBookmark);
  const removeBookmark = useSession((s) => s.removeBookmark);
  const addBookmarkToList = useSession((s) => s.addBookmarkToList);
  const createBookmarkList = useSession((s) => s.createBookmarkList);
  const noteShare = useSession((s) => s.noteShare);
  const reportStall = useSession((s) => s.reportStall);
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"main" | "share" | "bookmark" | "list">("main");
  const [copied, setCopied] = useState(false);
  const [listName, setListName] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const seller = user?.role === "seller";
  const own = Boolean(user?.shopSlug && user.shopSlug === shop.slug);
  const canFollow = !seller && !own && (shop.plan === "grow" || shop.plan === "premium");
  const canBookmark = !seller && !own && (shop.plan === "basic" || shop.plan === "grow" || shop.plan === "premium");
  const canReport = !own && !seller;
  const following = follows.includes(shop.slug);
  const saved = bookmarks.includes(shop.slug);
  const reported = reports.some((item) => item.key === `stall:${shop.slug}`);

  function needAccount() {
    if (user && user.role !== "seller") return false;
    navigate({ to: "/sign-in", search: { next: "/home" } });
    return true;
  }

  function shopUrl() {
    return new URL(`/shop/${shop.slug}`, window.location.origin).href;
  }

  async function copyLink() {
    const url = shopUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "0";
      field.style.top = "0";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.focus();
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    noteShare(shop.slug);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 900);
  }

  return (
    <div className={bar ? "peek-actions" : "peek-menu-wrap"} ref={box}>
      {bar ? (
        <>
          {canFollow && (
            <button type="button" onClick={() => { if (needAccount()) return; toggleFollow(shop.slug); }}>
              {following ? (ar ? "متابَع" : "Following") : (ar ? "تابع" : "Follow")}
            </button>
          )}
          <button type="button" onClick={() => { setPanel("share"); setOpen(true); }}>
            {ar ? "شارك" : "Share"}
          </button>
          {canBookmark && (
            <button type="button" onClick={() => { if (needAccount()) return; setPanel("bookmark"); setOpen(true); }}>
              {ar ? "احفظ" : "Bookmark"}
            </button>
          )}
          {canReport && (
            <button
              type="button"
              onClick={() => {
                if (needAccount() || reported) return;
                reportStall(shop.slug);
              }}
            >
              {reported ? (ar ? "تم الإبلاغ" : "Reported") : (ar ? "أبلغ" : "Report")}
            </button>
          )}
        </>
      ) : (
      <button
        type="button"
        className="peek-more"
        aria-label={ar ? "المزيد" : "More"}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setPanel("main");
          setOpen((value) => !value);
        }}
      >
        ···
      </button>
      )}
      {open && (bar ? panel !== "main" : true) && (
        <div className="peek-menu" role="menu" onClick={(event) => event.stopPropagation()}>
          {panel === "main" && (
            <>
              {canFollow && (
                <button type="button" role="menuitem" onClick={() => { if (needAccount()) return; toggleFollow(shop.slug); }}>
                  {following ? (ar ? "متابَع" : "Following") : (ar ? "تابع" : "Follow")}
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => setPanel("share")}>{ar ? "شارك" : "Share"}</button>
              {canBookmark && (
                <button type="button" role="menuitem" onClick={() => { if (needAccount()) return; setPanel("bookmark"); }}>
                  {ar ? "احفظ" : "Bookmark"}
                </button>
              )}
              {canReport && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (needAccount() || reported) return;
                    reportStall(shop.slug);
                  }}
                >
                  {reported ? (ar ? "تم الإبلاغ" : "Reported") : (ar ? "أبلغ" : "Report")}
                </button>
              )}
            </>
          )}
          {panel === "share" && (
            <>
              <a
                role="menuitem"
                href={`https://wa.me/?text=${encodeURIComponent(`${ar ? shop.nameAr : shop.name}\n${shopUrl()}`)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => noteShare(shop.slug)}
              >
                {ar ? "واتساب" : "WhatsApp"}
              </a>
              <button type="button" role="menuitem" onClick={() => void copyLink()}>
                {copied ? (ar ? "تم النسخ" : "Copied") : (ar ? "انسخ الرابط" : "Copy link")}
              </button>
              <button type="button" className="peek-back" onClick={() => setPanel("main")}>{ar ? "رجوع" : "Back"}</button>
            </>
          )}
          {panel === "bookmark" && (
            <>
              <button type="button" role="menuitem" onClick={() => saveBookmark(shop.slug)}>
                {saved ? (ar ? "محفوظ" : "Saved") : (ar ? "احفظ" : "Save bookmark")}
              </button>
              {lists.map((list) => (
                <button key={list.id} type="button" role="menuitem" onClick={() => addBookmarkToList(shop.slug, list.id)}>
                  {list.name}{list.slugs.includes(shop.slug) ? " ✓" : ""}
                </button>
              ))}
              <button type="button" role="menuitem" onClick={() => setPanel("list")}>{ar ? "قائمة جديدة" : "Create list"}</button>
              {saved && (
                <button type="button" role="menuitem" onClick={() => { removeBookmark(shop.slug); setPanel("main"); }}>
                  {ar ? "أزل الحفظ" : "Remove bookmark"}
                </button>
              )}
              <button type="button" className="peek-back" onClick={() => setPanel("main")}>{ar ? "رجوع" : "Back"}</button>
            </>
          )}
          {panel === "list" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                createBookmarkList(listName, shop.slug, visibility);
                setListName("");
                setVisibility("private");
                setPanel("bookmark");
              }}
            >
              <input value={listName} onChange={(event) => setListName(event.target.value)} placeholder={ar ? "اسم القائمة" : "List name"} aria-label={ar ? "اسم القائمة" : "List name"} required />
              <button type="button" onClick={() => setVisibility("private")}>{visibility === "private" ? "✓ " : ""}{ar ? "خاصة" : "Private"}</button>
              <button type="button" onClick={() => setVisibility("public")}>{visibility === "public" ? "✓ " : ""}{ar ? "عامة" : "Public"}</button>
              <button type="submit">{ar ? "أنشئ واحفظ" : "Create and save"}</button>
              <button type="button" className="peek-back" onClick={() => setPanel("bookmark")}>{ar ? "رجوع" : "Back"}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function StallPeek({
  shops,
  index,
  ar,
  scroll = 0,
  onClose,
  onIndex,
  onSheetScroll,
  focus,
}: {
  shops: Shop[];
  index: number;
  ar: boolean;
  scroll?: number;
  onClose: () => void;
  onIndex: (next: number) => void;
  onSheetScroll?: (top: number) => void;
  focus?: { title: string; image: string };
}) {
  const shop = shops[index];
  const start = useRef(0);
  const swiped = useRef(false);
  const sheet = useRef<HTMLDivElement>(null);
  const place = useRef<Record<string, number>>({});
  const seeded = useRef(false);
  const restoring = useRef(true);
  if (shop && !seeded.current) {
    place.current[shop.slug] = scroll;
    seeded.current = true;
  }
  useEffect(() => {
    const el = sheet.current;
    if (!el || !shop) return;
    restoring.current = true;
    const top = place.current[shop.slug] ?? 0;
    const apply = () => {
      el.scrollTop = top;
    };
    apply();
    const timer = window.setTimeout(() => {
      apply();
      restoring.current = false;
    }, 50);
    return () => window.clearTimeout(timer);
  }, [shop?.slug]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (!shop) return null;
  const reviews = shop.reviews ?? [];
  const count = shop.reviewCount ?? reviews.length;
  const rating = shop.rating ?? (count ? Math.round((reviews.reduce((sum, review) => sum + review.score, 0) / count) * 10) / 10 : 0);
  const pics = gallery(shop);
  const cats = (shop.categories?.length ? shop.categories : [shop.category])
    .map((id) => CATEGORIES.find((item) => item.id === id))
    .filter((item) => item != null);
  function step(dir: number) {
    if (shops.length < 2) return;
    onIndex((index + dir + shops.length) % shops.length);
  }
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="draw-pop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onTouchStart={(event) => {
        start.current = event.changedTouches[0]?.clientX ?? 0;
      }}
      onTouchEnd={(event) => {
        const delta = (event.changedTouches[0]?.clientX ?? 0) - start.current;
        if (Math.abs(delta) > 40) swiped.current = true;
        if (delta > 40) step(-1);
        if (delta < -40) step(1);
      }}
    >
      <button type="button" className="shelf-arrow is-prev peek-nav" aria-label={ar ? "السابق" : "Previous"} onClick={(event) => { event.stopPropagation(); step(-1); }}>
        <Chevron />
      </button>
      <div
        className="draw-sheet peek-sheet"
        onClick={(event) => {
          event.stopPropagation();
          if (swiped.current) {
            event.preventDefault();
            swiped.current = false;
          }
        }}
      >
        <div
          className="peek-body"
          ref={sheet}
          onScroll={(event) => {
            if (!shop || restoring.current) return;
            place.current[shop.slug] = event.currentTarget.scrollTop;
            onSheetScroll?.(event.currentTarget.scrollTop);
          }}
        >
        <div className="peek-head">
          <Link to="/shop/$slug" params={{ slug: shop.slug }} className="peek-id">
            <OptImg className="peek-logo" src={shop.avatar} alt="" />
            <span className={ar ? "peek-name font-arabic" : "peek-name"}>{ar ? shop.nameAr : shop.name}</span>
            <PlanStamp plan={shop.plan} className="plan-badge" />
          </Link>
          <span className="peek-tools">
            <PeekMenu shop={shop} ar={ar} />
            <button type="button" className="draw-x" aria-label={ar ? "إغلاق" : "Close"} onClick={onClose}>×</button>
          </span>
        </div>
        {focus ? (
          <>
            <Link to="/shop/$slug" params={{ slug: shop.slug }} className="peek-one">
              <OptImg src={focus.image} alt="" />
            </Link>
            <p className={ar ? "peek-product font-arabic" : "peek-product"}>{focus.title}</p>
          </>
        ) : (
        <Link to="/shop/$slug" params={{ slug: shop.slug }} className="stall-card-photos peek-photos">
          <OptImg className="stall-card-photo" src={pics.lead} alt="" />
          <span className="stall-card-side">
            {pics.side.map((pic, picIndex) => (
              <span key={`${pic.src}-${picIndex}`} className={pic.missing ? "stall-sub is-missing" : "stall-sub"}>
                <OptImg src={pic.src} alt="" />
                {pic.missing && (
                  <span className="stall-missing">
                    <b>Image not available</b>
                    <b className="font-arabic">الصورة غير متاحة</b>
                  </span>
                )}
              </span>
            ))}
          </span>
        </Link>
        )}
        {cats.length > 0 && (
          <p className="peek-cats">
            {cats.map((item) => (
              <span key={item.id}>
                <b className={ar ? "font-arabic" : undefined}>{ar ? item.ar : item.en}</b>
                <span className={ar ? undefined : "font-arabic"}>{ar ? item.en : item.ar}</span>
              </span>
            ))}
          </p>
        )}
        <div className="peek-review">
          {shop.plan !== "free" && (
            <span className="stall-card-rating">
              <DuckRating score={rating} size={18} />
              <em>{rating}</em>
              <span className={ar ? "font-arabic" : undefined}>{count} {ar ? "تقييم" : count === 1 ? "review" : "reviews"}</span>
            </span>
          )}
          <span className="stall-card-likes">
            <HeartIcon />
            {shop.likes ?? 0}
          </span>
        </div>
        </div>
      </div>
      <button type="button" className="shelf-arrow peek-nav" aria-label={ar ? "التالي" : "Next"} onClick={(event) => { event.stopPropagation(); step(1); }}>
        <Chevron />
      </button>
    </div>,
    document.body,
  );
}

export function PromoViewTracker({ ids }: { ids: string[] }) {
  const bumpPromotionViews = useSession((s) => s.bumpPromotionViews);
  const key = ids.join("|");
  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    const fresh = key.split("|").filter((id) => {
      const mark = `promo-view:${id}`;
      if (sessionStorage.getItem(mark)) return false;
      sessionStorage.setItem(mark, "1");
      return true;
    });
    if (fresh.length) bumpPromotionViews(fresh);
  }, [bumpPromotionViews, key]);
  return null;
}

export function PromoShelf({
  promos,
  ar,
}: {
  promos: { id: string; shopSlug: string; shopName: string; title: string; titleAr: string; detail: string; detailAr: string; off: string; images?: string[] }[];
  ar: boolean;
}) {
  const size = useShelfSize();
  const bumpPromotionClick = useSession((s) => s.bumpPromotionClick);
  const pages = Math.max(1, Math.ceil(promos.length / size));
  const [page, setPage] = useState(0);
  const safe = page % pages;
  const slice = promos.slice(safe * size, safe * size + size);
  return (
    <div className="shelf-frame">
      <PromoViewTracker ids={slice.map((promo) => promo.id)} />
      <div className="shelf-grid">
        {slice.map((promo) => (
          <Link key={promo.id} to="/shop/$slug" params={{ slug: promo.shopSlug }} className="overflow-hidden rounded-xl border border-line bg-cream" onClick={() => bumpPromotionClick(promo.id)}>
            {promo.images?.[0] && <OptImg src={promo.images[0]} alt="" className="shelf-promo-img" />}
            <span className="block px-2 py-1.5">
              <p className="truncate text-[0.62rem] uppercase tracking-wide text-mute">{promo.shopName}{promo.off ? ` · ${promo.off}` : ""}</p>
              <b className="mt-0.5 block truncate font-display text-sm">{ar ? promo.titleAr : promo.title}</b>
            </span>
          </Link>
        ))}
      </div>
      {promos.length > size && (
        <button type="button" className="shelf-arrow" aria-label={ar ? "التالي" : "Next"} onClick={() => setPage((safe + 1) % pages)}>
          <Chevron />
        </button>
      )}
      <ShelfDots pages={pages} page={safe} onPick={setPage} ar={ar} />
    </div>
  );
}

function ShelfDots({ pages, page, onPick, ar }: { pages: number; page: number; onPick: (page: number) => void; ar: boolean }) {
  if (pages < 2) return null;
  return (
    <div className="shelf-dots">
      {Array.from({ length: pages }, (_, index) => (
        <button
          key={index}
          type="button"
          className={index === page ? "is-on" : undefined}
          aria-label={ar ? `مجموعة ${index + 1}` : `Group ${index + 1}`}
          aria-current={index === page ? "true" : undefined}
          onClick={() => onPick(index)}
        />
      ))}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M7 4.5 12 9l-5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
