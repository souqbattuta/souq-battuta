import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Product, Shop } from "@/lib/data";
import { priceLabel } from "@/lib/data";
import { shuffled } from "@/lib/near";
import { useSession } from "@/lib/session";
import { DuckRating } from "@/components/duck-rating";
import { PlanStamp } from "@/components/plan-stamp";
import { HeartIcon } from "@/components/heart";
import { StallPeek } from "@/components/shop-shelf";
import { OptImg } from "@/components/opt-img";

type StoreDraw = { key: string; shop: Shop };
type ItemDraw = { key: string; shop: Shop; product: Product };

function freshSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 2147483646) + 1;
}

function diceFace(seed: number) {
  return (Math.abs(seed) % 6) + 1;
}

function Dice({ face, spin }: { face: number; spin: number }) {
  const spots: Record<number, Array<[number, number]>> = {
    1: [[32, 32]],
    2: [[20, 20], [44, 44]],
    3: [[20, 20], [32, 32], [44, 44]],
    4: [[20, 20], [44, 20], [20, 44], [44, 44]],
    5: [[20, 20], [44, 20], [32, 32], [20, 44], [44, 44]],
    6: [[20, 18], [44, 18], [20, 32], [44, 32], [20, 46], [44, 46]],
  };
  return (
    <svg key={spin} className={spin ? "draw-dice is-spin" : "draw-dice"} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="12" />
      {(spots[face] ?? spots[1]).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" />
      ))}
    </svg>
  );
}

export function DrawDeck({ shops, ar }: { shops: Shop[]; ar: boolean }) {
  const noteVisit = useSession((s) => s.noteVisit);
  const accounts = useSession((s) => s.accounts);
  const [mode, setMode] = useState<"store" | "item">("store");
  const [storeSeed, setStoreSeed] = useState(1);
  const [itemSeed, setItemSeed] = useState(2);
  const [open, setOpen] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [spin, setSpin] = useState(0);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setStoreSeed(freshSeed());
    setItemSeed(freshSeed());
  }, []);

  const stores = useMemo<StoreDraw[]>(
    () => shuffled(shops.map((shop) => ({ key: shop.slug, shop })), storeSeed),
    [shops, storeSeed],
  );
  const items = useMemo<ItemDraw[]>(() => {
    const deck = shops.flatMap((shop) =>
      shop.products.filter((product) => !product.paused).map((product) => ({ key: `${shop.slug}:${product.id}`, shop, product })),
    );
    return shuffled(deck, itemSeed);
  }, [shops, itemSeed]);

  const openSlug = open == null ? "" : ((mode === "store" ? stores[open]?.shop.slug : items[open]?.shop.slug) ?? "");
  useEffect(() => {
    if (openSlug) noteVisit(openSlug);
  }, [openSlug, noteVisit]);

  const hearts = useMemo(() => {
    const count: Record<string, number> = {};
    for (const account of Object.values(accounts)) {
      if (account.role === "seller") continue;
      for (const id of account.favorites ?? []) count[id] = (count[id] ?? 0) + 1;
    }
    return count;
  }, [accounts]);

  const deck = mode === "store" ? stores : items;
  const seed = mode === "store" ? storeSeed : itemSeed;
  const size = narrow ? 4 : 3;
  const pages = Math.max(1, Math.ceil(deck.length / size));
  const safePage = page % pages;
  const slice = deck.slice(safePage * size, safePage * size + size);
  const current = open != null ? deck[open] : null;
  const popped = open != null;
  const deckCount = useRef(0);
  deckCount.current = deck.length;

  useEffect(() => {
    if (!popped) return;
    const onKey = (event: KeyboardEvent) => {
      const total = deckCount.current;
      if (!total) return;
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight") setOpen((index) => (index == null ? index : (index + 1) % total));
      if (event.key === "ArrowLeft") setOpen((index) => (index == null ? index : (index - 1 + total) % total));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popped]);

  function shuffle(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    if (deck.length < 2) return;
    const first = deck[0]?.key;
    let next = freshSeed();
    const source = mode === "store" ? stores.map((card) => card.shop) : items;
    for (let guard = 0; guard < 8; guard += 1) {
      const trial = shuffled(mode === "store" ? shops : source, next);
      const lead = mode === "store" ? (trial[0] as Shop | undefined)?.slug : (trial[0] as ItemDraw | undefined)?.key;
      if (lead !== first) break;
      next += 1;
    }
    setPage(0);
    setOpen(null);
    setSpin((n) => n + 1);
    if (mode === "store") setStoreSeed(next);
    else setItemSeed(next);
  }

  function switchMode(next: "store" | "item") {
    setMode(next);
    setPage(0);
    setOpen(null);
  }

  return (
    <div className="draw-deck">
      <p className="draw-line">
        {mode === "store"
          ? ar ? "اخلط لترتيب جديد. كل دكان إله نفس الفرصة." : "Shuffle for a new order. Every stall has the same chance."
          : ar ? "اخلط لترتيب جديد. كل غرض إله نفس الفرصة." : "Shuffle for a new order. Every item has the same chance."}
      </p>
      <div className="draw-tools">
        <div className="near-modes" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "store"} className={mode === "store" ? "cat-pick is-draw" : "cat-pick"} onClick={() => switchMode("store")}>
            <b>{ar ? "حسب الدكان" : "By store"}</b>
          </button>
          <button type="button" role="tab" aria-selected={mode === "item"} className={mode === "item" ? "cat-pick is-draw" : "cat-pick"} onClick={() => switchMode("item")}>
            <b>{ar ? "حسب الغرض" : "By item"}</b>
          </button>
        </div>
        <button type="button" className="draw-shuffle" onClick={shuffle}>
          <Dice face={diceFace(seed)} spin={spin} />
          <span>{ar ? "اخلط" : "Shuffle"}</span>
        </button>
      </div>
      {deck.length === 0 ? (
        <p className="home-note">{ar ? "ما في شي بهالقسم بعد." : "Nothing in this aisle yet."}</p>
      ) : (
        <div className="draw-deal">
          <div className={narrow ? "draw-grid is-stalls" : "draw-grid"}>
            {slice.map((card, index) => {
              const at = safePage * size + index;
              const item = "product" in card ? card.product : null;
              const shop = card.shop;
              if (narrow) {
                const reviews = shop.reviews ?? [];
                const count = shop.reviewCount ?? reviews.length;
                const rating = shop.rating ?? (count ? Math.round((reviews.reduce((sum, review) => sum + review.score, 0) / count) * 10) / 10 : 0);
                const name = item ? (ar ? item.nameAr : item.name) : ar ? shop.nameAr : shop.name;
                const image = item ? item.images[0] || shop.avatar : leadPhoto(shop);
                return (
                  <button key={card.key} type="button" className="stall-card" onClick={() => setOpen(at)}>
                    <span className="stall-card-inner">
                      <span className="stall-face-phone">
                        <span className="stall-phone-shot">
                          <OptImg className="stall-phone-pic" src={image} alt="" />
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
                  </button>
                );
              }
              const title = item ? (ar ? item.nameAr : item.name) : ar ? shop.nameAr : shop.name;
              const image = item ? item.images[0] || shop.avatar : shop.cover || shop.avatar;
              return (
                <button key={card.key} type="button" className="stall-card draw-card" onClick={() => setOpen(at)}>
                  <span className="stall-card-catrow">
                    <PlanStamp plan={shop.plan} className="plan-badge" />
                  </span>
                  <OptImg src={image} alt="" />
                  <b className={ar ? "font-arabic" : undefined}>{title}</b>
                  {shop.plan !== "free" && (
                    <span className="stall-card-meta">
                      <Rating shop={shop} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {pages > 1 && (
            <button type="button" className="shelf-arrow" aria-label={ar ? "التالي" : "Next"} onClick={() => setPage((safePage + 1) % pages)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            </button>
          )}
        </div>
      )}
      {current && narrow ? (
        <StallPeek
          shops={(mode === "store" ? stores : items).map((card) => card.shop)}
          index={open ?? 0}
          ar={ar}
          onClose={() => setOpen(null)}
          onIndex={(next) => setOpen(next)}
          focus={
            "product" in current
              ? {
                  title: ar ? current.product.nameAr : current.product.name,
                  image: current.product.images[0] || current.shop.avatar,
                }
              : undefined
          }
        />
      ) : current ? (
        <DrawPop
          ar={ar}
          card={current}
          hearts={hearts}
          onClose={() => setOpen(null)}
          onPrev={() => setOpen((open! - 1 + deck.length) % deck.length)}
          onNext={() => setOpen((open! + 1) % deck.length)}
        />
      ) : null}
    </div>
  );
}

function leadPhoto(shop: Shop) {
  const placeholder = (src: string) => /default-duck|seller-duck|buyer-duck/.test(src);
  const real: string[] = [];
  for (const product of shop.products) {
    for (const image of product.images) {
      if (image && !placeholder(image) && image !== shop.avatar && !real.includes(image)) real.push(image);
    }
  }
  return real[0] || shop.avatar;
}

function Rating({ shop }: { shop: Shop }) {
  const reviews = shop.reviews ?? [];
  const count = shop.reviewCount ?? reviews.length;
  const rating = shop.rating ?? (count ? Math.round((reviews.reduce((sum, review) => sum + review.score, 0) / count) * 10) / 10 : 0);
  return (
    <span className="stall-card-rating">
      <DuckRating score={rating} size={16} />
      {count > 0 && <em>{rating}</em>}
    </span>
  );
}

function DrawPop({
  ar,
  card,
  hearts,
  onClose,
  onPrev,
  onNext,
}: {
  ar: boolean;
  card: StoreDraw | ItemDraw;
  hearts: Record<string, number>;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const shop = card.shop;
  const item = "product" in card ? card.product : null;
  const reviews = shop.reviews ?? [];
  const count = shop.reviewCount ?? reviews.length;
  const rating = shop.rating ?? (count ? Math.round((reviews.reduce((sum, review) => sum + review.score, 0) / count) * 10) / 10 : 0);
  const photo = item ? item.images[0] || shop.avatar : shop.cover || shop.avatar;
  const love = item ? hearts[item.id] ?? 0 : 0;
  return (
    <div className="draw-pop" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="draw-side draw-prev" aria-label={ar ? "السابق" : "Previous"} onClick={(event) => { event.stopPropagation(); onPrev(); }}>‹</button>
      <div className="draw-sheet" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="draw-x" aria-label={ar ? "إغلاق" : "Close"} onClick={onClose}>×</button>
        <Link to="/shop/$slug" params={{ slug: shop.slug }} className="draw-photo">
          <OptImg src={photo} alt="" />
        </Link>
        {item ? (
          <div className="draw-copy">
            <b>{ar ? item.nameAr : item.name}</b>
            {(item.desc || item.descAr) && <p className={ar ? "font-arabic" : undefined}>{ar ? item.descAr || item.desc : item.desc}</p>}
            <p>{priceLabel(item, ar ? "ar" : "en")}</p>
            {love > 0 && <p className="draw-hearts"><HeartIcon /> {love}</p>}
            <Link to="/shop/$slug" params={{ slug: shop.slug }} className="draw-stall">
              <OptImg src={shop.avatar} alt="" />
              <span>{ar ? shop.nameAr : shop.name}</span>
            </Link>
          </div>
        ) : (
          <div className="draw-copy">
            <b>{ar ? shop.nameAr : shop.name}</b>
            {(shop.bio || shop.bioAr) && <p>{ar ? shop.bioAr || shop.bio : shop.bio}</p>}
            {shop.plan !== "free" && (
              <p className="draw-rate">
                <DuckRating score={rating} size={18} />
                <span>{rating}</span>
              </p>
            )}
          </div>
        )}
      </div>
      <button type="button" className="draw-side draw-next" aria-label={ar ? "التالي" : "Next"} onClick={(event) => { event.stopPropagation(); onNext(); }}>›</button>
    </div>
  );
}
