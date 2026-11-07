import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Product, Shop } from "@/lib/data";
import { priceLabel } from "@/lib/data";
import { cryptoSeed, shuffled } from "@/lib/near";
import { DEFAULT_ALGO_ORDER, type AlgoLever } from "@/lib/shelves";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { DuckRating } from "@/components/duck-rating";
import { PlanStamp } from "@/components/plan-stamp";
import { HeartIcon } from "@/components/heart";
import { StallPeek } from "@/components/shop-shelf";
import { OptImg } from "@/components/opt-img";
import { photoControlName } from "@/lib/photo-label";

type StoreDraw = { key: string; shop: Shop };
type ItemDraw = { key: string; shop: Shop; product: Product };
type DrawCard = StoreDraw | ItemDraw;
type DrawMode = "mix" | "store" | "item";

const SEEN_KEY = "souq-random-seen";

function readSeen() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((item) => typeof item === "string").slice(0, 20) : [];
  } catch {
    return [];
  }
}

function remember(keys: string[]) {
  const next = [...keys, ...readSeen().filter((key) => !keys.includes(key))].slice(0, 20);
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

function baseCards(shops: Shop[], mode: DrawMode): DrawCard[] {
  const stalls: StoreDraw[] = shops.map((shop) => ({ key: `stall:${shop.slug}`, shop }));
  const items: ItemDraw[] = shops.flatMap((shop) =>
    shop.products.filter((product) => !product.paused).map((product) => ({ key: `item:${shop.slug}:${product.id}`, shop, product })),
  );
  if (mode === "store") return stalls;
  if (mode === "item") return items;
  return [...stalls, ...items];
}

function deal(shops: Shop[], mode: DrawMode, seed: Uint32Array) {
  return shuffled(baseCards(shops, mode), seed);
}

function randomWords(shops: Shop[], seed: Uint32Array) {
  const bag = new Set<string>();
  for (const shop of shops) {
    for (const word of shop.keywords ?? []) if (word.trim().length >= 2) bag.add(word.trim().toLowerCase());
    if (shop.category && shop.category !== "all" && shop.category !== "misc") bag.add(shop.category);
  }
  const count = 3 + (seed[0] % 3);
  return shuffled([...bag], seed).slice(0, count);
}

function diceFace(seed: Uint32Array | null) {
  return ((seed?.[0] ?? 1) % 6) + 1;
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
  const saveAlgorithm = useSession((s) => s.saveAlgorithm);
  const lang = useSession((s) => s.lang);
  const labels = copy[lang === "ar" ? "ar" : "en"];
  const [mode, setMode] = useState<DrawMode>("mix");
  const [seed, setSeed] = useState<Uint32Array | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [spin, setSpin] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [saved, setSaved] = useState(false);

  useLayoutEffect(() => {
    setSeed(cryptoSeed());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const deck = useMemo(() => (seed ? deal(shops, mode, seed) : []), [shops, mode, seed]);
  const algo = useMemo(() => {
    if (!seed) return { order: [] as AlgoLever[], words: [] as string[] };
    return { order: shuffled([...DEFAULT_ALGO_ORDER], seed), words: randomWords(shops, seed) };
  }, [seed, shops]);

  useEffect(() => {
    if (deck.length) remember(deck.slice(0, 8).map((card) => card.key));
  }, [deck]);

  const openSlug = open == null ? "" : deck[open]?.shop.slug ?? "";
  useEffect(() => {
    if (openSlug) noteVisit(openSlug);
  }, [openSlug, noteVisit]);

  const hearts = useMemo(() => {
    const count: Record<string, number> = {};
    for (const account of Object.values(accounts as Record<string, { role?: string; favorites?: string[] }>)) {
      if (account.role === "seller") continue;
      for (const id of account.favorites ?? []) count[id] = (count[id] ?? 0) + 1;
    }
    return count;
  }, [accounts]);

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
    if (baseCards(shops, mode).length < 2) return;
    const first = deck[0]?.key;
    let next = cryptoSeed();
    let trial = deal(shops, mode, next);
    for (let guard = 0; guard < 6 && trial[0]?.key === first; guard += 1) {
      next = cryptoSeed();
      trial = deal(shops, mode, next);
    }
    setPage(0);
    setOpen(null);
    setSaved(false);
    setSpin((n) => n + 1);
    setSeed(next);
  }

  function switchMode(next: DrawMode) {
    setMode(next);
    setPage(0);
    setOpen(null);
    setSaved(false);
    setSeed(cryptoSeed());
  }

  const leverName: Record<AlgoLever, string> = {
    words: labels.algoWords,
    ordered: labels.algoOrdered,
    follow: labels.algoFollow,
    shared: labels.algoShared,
    bookmarks: labels.algoBookmarks,
    liked: labels.algoLiked,
    visited: labels.algoVisited,
    likeSimilar: labels.algoLikeSimilar,
    followSimilar: labels.algoFollowSimilar,
    fresh: labels.algoNew,
  };

  if (!seed) {
    return (
      <div className="draw-deck" aria-busy="true">
        <p className="home-note">{ar ? "…" : "…"}</p>
      </div>
    );
  }

  return (
    <div className="draw-deck">
      <p className="draw-line">
        {mode === "mix"
          ? ar ? "اخلط. الدكاكين والأغراض سوا، وكل واحد إله نفس الفرصة." : "Shuffle. Stalls and items are mixed, and each one has the same chance."
          : mode === "store"
            ? ar ? "اخلط لترتيب جديد. كل دكان إله نفس الفرصة." : "Shuffle for a new order. Every stall has the same chance."
            : ar ? "اخلط لترتيب جديد. كل غرض إله نفس الفرصة." : "Shuffle for a new order. Every item has the same chance."}
      </p>
      <div className="draw-tools">
        <div className="near-modes" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "mix"} className={mode === "mix" ? "cat-pick is-draw" : "cat-pick"} onClick={() => switchMode("mix")}>
            <b>{ar ? "مختلط" : "Mixed"}</b>
          </button>
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
      {algo.words.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-mute">{ar ? "خوارزميتك العشوائية:" : "Your random algo:"}</p>
          {algo.words.map((word) => (
            <span key={word} className="rounded-full bg-sand px-2 py-1 text-xs">{word}</span>
          ))}
          {algo.order.slice(0, 3).map((lever) => (
            <span key={lever} className="rounded-full border border-line px-2 py-1 text-xs">{leverName[lever]}</span>
          ))}
          <button
            type="button"
            className="text-xs font-semibold underline"
            onClick={() => {
              saveAlgorithm({ order: algo.order, words: algo.words });
              setSaved(true);
            }}
          >
            {saved ? (ar ? "تم الحفظ" : "Saved") : ar ? "احفظها خوارزميتي" : "Save as my algorithm"}
          </button>
        </div>
      )}
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
                  <button key={card.key} type="button" className="stall-card photo-open" aria-label={photoControlName(ar ? "ar" : "en", ar ? shop.nameAr : shop.name, item ? (ar ? item.nameAr : item.name) : undefined)} onClick={() => setOpen(at)}>
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
                <button key={card.key} type="button" className="stall-card draw-card photo-open" aria-label={photoControlName(ar ? "ar" : "en", ar ? shop.nameAr : shop.name, item ? (ar ? item.nameAr : item.name) : undefined)} onClick={() => setOpen(at)}>
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
              <span className="shelf-arrow-face">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
              </span>
            </button>
          )}
        </div>
      )}
      {current && narrow ? (
        <StallPeek
          shops={deck.map((card) => card.shop)}
          index={open ?? 0}
          ar={ar}
          onClose={() => setOpen(null)}
          onIndex={(next) => setOpen(next)}
          focus={
            "product" in current
              ? {
                  title: ar ? (current as ItemDraw).product.nameAr : (current as ItemDraw).product.name,
                  image: (current as ItemDraw).product.images[0] || current.shop.avatar,
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
        <Link to="/shop/$slug" params={{ slug: shop.slug }} className="draw-photo photo-open" aria-label={photoControlName(ar ? "ar" : "en", ar ? shop.nameAr : shop.name, item ? (ar ? item.nameAr : item.name) : undefined)}>
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
