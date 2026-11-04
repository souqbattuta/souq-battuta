import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Shop } from "@/lib/data";
import {
  HELLO_CAP,
  ammanDay,
  billedLength,
  boardHandles,
  boardPosts,
  homeHello,
  postsToday,
  rankHello,
  splitHandles,
  suggestHandles,
  toHandle,
  type HelloHandle,
  type HelloPost,
} from "@/lib/hello";
import { directoryShops, useSession } from "@/lib/session";
import { SquareCrop } from "@/components/photo-frame";
import { OptImg } from "@/components/opt-img";
import { PlanStamp } from "@/components/plan-stamp";
import { HeartIcon } from "@/components/heart";

export function helloStamp(at: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Amman",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

function postedAgo(at: number, now: number, ar: boolean) {
  const mins = Math.max(0, Math.floor((now - at) / 60_000));
  if (mins < 1) return ar ? "الآن" : "just now";
  if (mins < 60) return ar ? `قبل ${mins} د` : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return ar ? "قبل ساعة" : "1 hour ago";
  return ar ? `قبل ${hours} س` : `${hours} hours ago`;
}

function hoursLeft(at: number, now: number, today: boolean, ar: boolean) {
  if (today) {
    const day = ammanDay(now);
    const midnight = new Date(`${day}T00:00:00+03:00`).getTime() + 864e5;
    const left = Math.max(0, midnight - now);
    if (left < 3600e3) {
      const mins = Math.max(1, Math.ceil(left / 60e3));
      return ar ? `${mins} دقيقة وبتختفي` : `${mins} min left`;
    }
    const hours = Math.ceil(left / 3600e3);
    return ar ? `${hours} ساعة وبتختفي` : `${hours} hours left`;
  }
  const days = Math.max(1, Math.ceil((at + 30 * 864e5 - now) / 864e5));
  return ar ? `${days} يوم بالحفظ` : `${days} days in history`;
}

function HistoryRow({ post, ar, now, today = false, onDelete }: { post: HelloPost; ar: boolean; now: number; today?: boolean; onDelete?: (id: string) => void }) {
  return (
    <li>
      <OptImg src={post.image} alt="" />
      <span>{post.text}</span>
      <small>
        {post.views} {ar ? "مشاهدة" : "views"} · {helloStamp(post.at)} · {hoursLeft(post.at, now, today, ar)}
      </small>
      {onDelete && (
        <button type="button" className="hw-delete" onClick={() => onDelete(post.id)}>
          {ar ? "حذف" : "Delete"}
        </button>
      )}
    </li>
  );
}

function heartCount(post: HelloPost, accounts: Record<string, { role?: string; helloHearts?: string[] }>) {
  return (post.hearts ?? 0) + Object.values(accounts).filter((account) => account.role !== "seller" && (account.helloHearts ?? []).includes(post.id)).length;
}

function helloUrl(id: string) {
  const path = `/hello?tab=for-you&post=${encodeURIComponent(id)}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function SharePost({ id }: { id: string }) {
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
    const url = helloUrl(id);
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
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
      ok = document.execCommand("copy");
      field.remove();
    }
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 900);
  }

  return (
    <div className="hw-share hw-share-desktop" ref={box}>
      <button type="button" className="hw-share-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Share
      </button>
      {open && (
        <div className="hw-share-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const url = helloUrl(id);
              if (typeof navigator.share === "function") void navigator.share({ title: "Hello, World!", url });
              else void copyLink();
              setOpen(false);
            }}
          >
            Share
          </button>
        </div>
      )}
    </div>
  );
}

function PostMenu({
  reported,
  onReport,
  postId,
  follow,
  className,
}: {
  reported: boolean;
  onReport: () => void;
  postId: string;
  follow?: { following: boolean; onFollow: () => void };
  className?: string;
}) {
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
    const url = helloUrl(postId);
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
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
      ok = document.execCommand("copy");
      field.remove();
    }
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 900);
  }
  return (
    <div className={className ? `hw-share ${className}` : "hw-share"} ref={box}>
      <button type="button" className="hw-more" aria-label="More" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        ···
      </button>
      {open && (
        <div className="hw-share-menu" role="menu">
          {follow && (
            <button
              type="button"
              role="menuitem"
              className="hw-menu-phone"
              onClick={() => {
                follow.onFollow();
                setOpen(false);
              }}
            >
              {follow.following ? "Following" : "Follow"}
            </button>
          )}
          <button type="button" role="menuitem" className="hw-menu-phone" onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="hw-menu-phone"
            onClick={() => {
              const url = helloUrl(postId);
              if (typeof navigator.share === "function") void navigator.share({ title: "Hello, World!", url });
              else void copyLink();
              setOpen(false);
            }}
          >
            Share
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onReport();
              setOpen(false);
            }}
          >
            {reported ? "Reported" : "Report"}
          </button>
        </div>
      )}
    </div>
  );
}

function shopBySlug(shops: Shop[], slug: string) {
  return shops.find((shop) => shop.slug === slug);
}

function HelloText({ text, lang, handles, onAt }: { text: string; lang: "en" | "ar"; handles: HelloHandle[]; onAt: (handle: string) => void }) {
  const ar = lang === "ar";
  return (
    <p className={ar ? "hw-copy is-ar" : "hw-copy"} dir={ar ? "rtl" : "ltr"} lang={lang}>
      {splitHandles(text, handles.map((item) => item.handle)).map((part, index) =>
        part.handle ? (
          <button key={index} type="button" className="hw-at" onClick={() => onAt(part.handle!)}>
            {part.text}
          </button>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function HelloViewer({
  posts,
  index,
  shops,
  handles,
  accounts,
  hearts,
  ui,
  now,
  onClose,
  onStep,
  onHeart,
  onAt,
  reportedIds,
  onReport,
}: {
  posts: HelloPost[];
  index: number;
  shops: Shop[];
  handles: HelloHandle[];
  accounts: Record<string, { role?: string; helloHearts?: string[] }>;
  hearts: string[];
  ui: "en" | "ar";
  now: number;
  onClose: () => void;
  onStep: (next: number) => void;
  onHeart: (id: string) => void;
  onAt: (handle: string) => void;
  reportedIds: string[];
  onReport: (id: string) => void;
}) {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const follows = useSession((s) => s.follows) ?? [];
  const toggleFollow = useSession((s) => s.toggleFollow);
  const post = posts[index];
  const start = useRef(0);
  const stepRef = useRef(onStep);
  const closeRef = useRef(onClose);
  const ignorePop = useRef(false);
  const remain = useRef(5000);
  const stamp = useRef(0);
  const holdTimer = useRef(0);
  const holding = useRef(false);
  const downY = useRef(0);
  const tracking = useRef(false);
  const [held, setHeld] = useState(false);
  stepRef.current = onStep;
  closeRef.current = onClose;
  useEffect(() => {
    remain.current = 5000;
    setHeld(false);
  }, [index]);
  useEffect(() => {
    window.history.pushState({ helloStory: 1 }, "");
    const onPop = () => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function leave() {
    if (window.history.state?.helloStory) {
      ignorePop.current = true;
      window.history.back();
    }
    closeRef.current();
  }
  function forward() {
    if (index >= posts.length - 1) leave();
    else stepRef.current(index + 1);
  }
  useEffect(() => {
    if (held) return;
    stamp.current = performance.now();
    const timer = window.setTimeout(forward, remain.current);
    return () => {
      window.clearTimeout(timer);
      remain.current = Math.max(200, remain.current - (performance.now() - stamp.current));
    };
  }, [index, posts.length, held]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
      if (event.key === "ArrowRight") forward();
      if (event.key === "ArrowLeft" && index > 0) stepRef.current(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, posts.length]);
  if (!post) return null;
  function storyDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, .hw-corner, .hw-actions, .hw-stat, .hw-translate, .hw-share")) return;
    tracking.current = true;
    start.current = event.clientX;
    downY.current = event.clientY;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the story still receives the release */
    }
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holding.current = true;
      setHeld(true);
    }, 220);
  }
  function storyUp(event: React.PointerEvent<HTMLDivElement>) {
    window.clearTimeout(holdTimer.current);
    if (!tracking.current) return;
    tracking.current = false;
    const dx = event.clientX - start.current;
    const dy = event.clientY - downY.current;
    if (holding.current) {
      holding.current = false;
      setHeld(false);
      return;
    }
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        if (index > 0) stepRef.current(index - 1);
      } else forward();
      return;
    }
    if (Math.abs(dy) > 64) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    if (x < box.width * 0.3) {
      if (index > 0) stepRef.current(index - 1);
    } else forward();
  }
  function storyCancel() {
    window.clearTimeout(holdTimer.current);
    tracking.current = false;
    if (!holding.current) return;
    holding.current = false;
    setHeld(false);
  }
  const shop = shopBySlug(shops, post.shopSlug);
  const ar = ui === "ar";
  const canFollow = shop?.plan === "grow" || shop?.plan === "premium";
  const following = follows.includes(post.shopSlug);
  const follow =
    canFollow && user?.role !== "seller"
      ? {
          following,
          onFollow: () => (user ? toggleFollow(post.shopSlug) : navigate({ to: "/sign-in", search: { next: "/hello" } })),
        }
      : undefined;
  return (
    <div
      className={held ? "hw-view hw-story is-held" : "hw-view hw-story"}
      role="dialog"
      aria-modal="true"
      aria-label="Hello, World!"
      style={{ touchAction: "none" }}
      onPointerDown={storyDown}
      onPointerUp={storyUp}
      onPointerCancel={storyCancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="hw-story-bar" key={post.id} aria-hidden="true">
        <span />
      </div>
      <button type="button" className="hw-x" onClick={leave} aria-label={ar ? "إغلاق" : "Close"}>
        ×
      </button>
      <button type="button" className="hw-arrow is-prev" aria-label="Previous" onClick={() => index > 0 && stepRef.current(index - 1)} disabled={index === 0}>
        ‹
      </button>
      <figure>
        <div className="hw-top">
          <Link
            to="/shop/$slug"
            params={{ slug: post.shopSlug }}
            onClick={() => {
              if (window.history.state?.helloStory) window.history.replaceState({}, "");
              onClose();
            }}
          >
            <OptImg className="hw-logo" src={shop?.avatar || "/brand/avatars/default-duck.jpg"} alt="" />
            <b>{shop?.name ?? post.shopSlug}</b>
            <small className="hw-ago">{postedAgo(post.at, now, ar)}</small>
          </Link>
          <div className="hw-actions">
            {follow && (
              <button type="button" className={follow.following ? "hw-follow is-following" : "hw-follow"} onClick={follow.onFollow}>
                {follow.following ? "Following" : "Follow"}
              </button>
            )}
            <SharePost id={post.id} />
          </div>
        </div>
        <PostMenu
          className="hw-corner"
          postId={post.id}
          follow={follow}
          reported={reportedIds.includes(post.id) || !!post.reported}
          onReport={() => onReport(post.id)}
        />
        <HelloText text={post.text} lang={post.lang} handles={handles} onAt={onAt} />
        <div className="hw-story-photo">
          <OptImg className="hw-view-photo" src={post.image} alt="" />
        </div>
        <figcaption>
          <div className="hw-view-stats">
            <div className="hw-stat">
              <button type="button" className={hearts.includes(post.id) ? "heart-btn is-on" : "heart-btn"} onClick={() => onHeart(post.id)} aria-label={ar ? "إعجاب" : "Like"}>
                <HeartIcon />
              </button>
              <span className="hw-likes">
                <b>{heartCount(post, accounts)}</b> {ar ? "إعجاب" : "likes"}
              </span>
            </div>
            <div className="hw-stat is-views">
              <b>{post.views}</b> {ar ? "مشاهدة" : "views"}
            </div>
          </div>
          <TranslateLine key={post.id} text={post.text} lang={post.lang} ui={ui} label={ar ? "ترجم هذا المنشور" : "Translate this post"} />
        </figcaption>
      </figure>
      <button type="button" className="hw-arrow is-next" aria-label="Next" onClick={forward}>
        ›
      </button>
    </div>
  );
}

export function HelloStrip({ shops }: { shops: Shop[] }) {
  const accounts = useSession((s) => s.accounts);
  const follows = useSession((s) => s.follows) ?? [];
  const ar = useSession((s) => s.lang) === "ar";
  const allowed = useMemo(() => new Set(shops.map((shop) => shop.slug)), [shops]);
  const live = homeHello(boardPosts(Object.values(accounts)), follows).filter((post) => allowed.has(post.shopSlug));
  const stripKey = live.map((post) => post.id).sort().join("\n");
  const stripHeld = useRef({ key: "", posts: live });
  if (stripHeld.current.key !== stripKey) stripHeld.current = { key: stripKey, posts: live };
  const posts = stripHeld.current.posts.map((post) => live.find((item) => item.id === post.id)).filter((post): post is HelloPost => Boolean(post));
  const unit = posts.length === 0 ? [] : Array.from({ length: Math.max(posts.length, 6) }, (_, index) => posts[index % posts.length]);
  return (
    <section className="home-section home-shelf hw-home" aria-labelledby="home-hello">
      <div className="home-head home-head-rule">
        <div>
          <p className="home-eyebrow home-kicker">Today</p>
          <h2 id="home-hello">Hello, World!</h2>
          <p className="home-shelf-note">
            {ar ? "خبر يومي من السوق. بيطلع الـ١٢ وبيروح الـ١٢." : "A daily note from the souq. Up at 12, gone at 12."}
          </p>
        </div>
      </div>
      {posts.length === 0 ? (
        <p className="home-note">Nothing on the board yet today.</p>
      ) : (
        <Link to="/hello" search={{ tab: "for-you", at: "", post: "" }} className="hw-ticker" aria-label="Hello, World!">
          <span className="hw-ticker-badge">
            <OptImg src="/brand/duck-mark.png" alt="" sizes="28px" />
          </span>
          <span className="hw-ticker-window">
            <span className="hw-ticker-track">
              {[0, 1].map((copy) => (
                <span className="hw-ticker-group" key={copy}>
                  {unit.map((post, index) => {
                    const shop = shopBySlug(shops, post.shopSlug);
                    return (
                      <span key={`${copy}-${post.id}-${index}`} className="hw-tick">
                        <OptImg src={shop?.avatar || "/brand/duck-mark.png"} alt="" sizes="32px" />
                        {shop && shop.plan !== "free" && <PlanStamp plan={shop.plan} className="plan-badge" />}
                        <span dir={post.lang === "ar" ? "rtl" : "ltr"} lang={post.lang}>{post.text}</span>
                      </span>
                    );
                  })}
                </span>
              ))}
            </span>
          </span>
        </Link>
      )}
    </section>
  );
}

export function AdvertiseBar() {
  const user = useSession((s) => s.user);
  const messageSouq = useSession((s) => s.messageSouq);
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <section className="hw-ad">
      <h2>Advertise on Souq Battuta</h2>
      <p>A place that advertises gets an @ name. Sellers can mention it. The desk turns it on.</p>
      {user ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const res = messageSouq(`Advertise on Souq Battuta: ${name.trim()}`);
            if (res.ok) {
              setSent(true);
              setName("");
            }
          }}
        >
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Place name" aria-label="Place name" />
          <button type="submit">Send</button>
        </form>
      ) : (
        <Link to="/sign-in" search={{ next: "/advertise" }}>
          Sign in to ask
        </Link>
      )}
      {sent && <p>Sent to the Souq desk.</p>}
    </section>
  );
}

function TranslateLine({ text, lang, ui, label }: { text: string; lang: "en" | "ar"; ui: "en" | "ar"; label?: string }) {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  if (lang === ui) return null;
  return (
    <div className="hw-translate">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          const pair = lang === "ar" ? "ar|en" : "en|ar";
          void fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`)
            .then((res) => res.json())
            .then((data) => setOut(String(data?.responseData?.translatedText ?? "")))
            .catch(() => setOut(""))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "…" : label ?? "Translate"}
      </button>
      {out && <p>{out}</p>}
    </div>
  );
}

export function HelloFeed({ tab, at, post: postId }: { tab: "for-you" | "recent" | "viewed"; at: string; post: string }) {
  const navigate = useNavigate();
  const lang = useSession((s) => s.lang);
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
  const follows = useSession((s) => s.follows) ?? [];
  const words = useSession((s) => s.interestWords) ?? [];
  const pageLikes = useSession((s) => s.pageLikes) ?? [];
  const helloHearts = useSession((s) => s.helloHearts) ?? [];
  const handles = boardHandles(useSession((s) => s.helloHandles) ?? []);
  const toggleHelloHeart = useSession((s) => s.toggleHelloHeart);
  const toggleFollow = useSession((s) => s.toggleFollow);
  const viewHello = useSession((s) => s.viewHello);
  const reportHello = useSession((s) => s.reportHello);
  const shops = useMemo(() => directoryShops(accounts), [accounts]);
  const today = useMemo(() => boardPosts(Object.values(accounts)), [accounts]);
  const orderKey = `${tab}\n${today.map((post) => post.id).join("\n")}\n${words.join("\n")}`;
  const followsNow = useRef(follows);
  followsNow.current = follows;
  const heldKey = useRef("");
  const held = useRef<HelloPost[]>([]);
  if (heldKey.current !== orderKey) {
    heldKey.current = orderKey;
    held.current =
      tab === "recent"
        ? [...today].sort((a, b) => b.at - a.at)
        : tab === "viewed"
          ? [...today].sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || b.at - a.at)
          : rankHello(today, { words, follows: followsNow.current, pageLikes, helloHearts, shops });
  }
  const ordered = held.current.map((post) => today.find((item) => item.id === post.id)).filter((post): post is HelloPost => Boolean(post));
  const [open, setOpen] = useState<number | null>(null);
  const [reported, setReported] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const ar = lang === "ar";
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!postId) return;
    const index = ordered.findIndex((item) => item.id === postId);
    if (index >= 0) setOpen(index);
  }, [postId, ordered]);
  const mention = at ? handles.find((item) => item.handle.toLowerCase() === `@${at}`.toLowerCase()) : undefined;

  function heart(id: string) {
    if (!user) {
      void navigate({ to: "/sign-in", search: { next: "/hello" } });
      return;
    }
    if (user.role === "seller") return;
    toggleHelloHeart(id);
  }

  function openAt(index: number) {
    const post = ordered[index];
    if (!post) return;
    const key = `hello-view:${post.id}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      viewHello(post.id);
    }
    setOpen(index);
  }

  if (at) {
    const tagged = today.filter((post) => post.text.toLowerCase().includes(`@${at}`.toLowerCase()));
    return (
      <div className="hw-page">
        <Link to="/hello" search={{ tab, at: "", post: "" }} className="hw-back">
          Back
        </Link>
        <h1>{mention?.handle ?? `@${at}`}</h1>
        <p className="hw-note">{mention?.note || "This place has not advertised on Souq Battuta."}</p>
        <h2>Who is going</h2>
        {tagged.length === 0 ? (
          <p className="hw-note">No stalls have mentioned this today.</p>
        ) : (
          tagged.map((post) => {
            const shop = shopBySlug(shops, post.shopSlug);
            return (
              <Link key={post.id} to="/shop/$slug" params={{ slug: post.shopSlug }} className="hw-going">
                <OptImg src={shop?.avatar || "/brand/avatars/default-duck.jpg"} alt="" />
                <span>{shop?.name ?? post.shopSlug}</span>
              </Link>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="hw-page">
      <h1>Hello, World!</h1>
      <div className="hw-board">
      <div className="hw-tabs" role="tablist">
        {(
          [
            ["for-you", "For You"],
            ["recent", "Recent"],
            ["viewed", "Most Viewed"],
          ] as const
        ).map(([id, label]) => (
          <Link key={id} to="/hello" search={{ tab: id, at: "", post: "" }} resetScroll={false} role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""}>
            {label}
          </Link>
        ))}
      </div>
      {ordered.length === 0 && <p className="hw-note">Nothing on the board yet today.</p>}
      <div className="hw-list">
        {ordered.map((post, index) => {
          const shop = shopBySlug(shops, post.shopSlug);
          const canFollow = shop?.plan === "grow" || shop?.plan === "premium";
          const following = follows.includes(post.shopSlug);
          return (
            <article key={post.id} className="hw-card">
              <div className="hw-top">
                <Link to="/shop/$slug" params={{ slug: post.shopSlug }}>
                  <OptImg className="hw-logo" src={shop?.avatar || "/brand/avatars/default-duck.jpg"} alt="" />
                  <b>{shop?.name ?? post.shopSlug}</b>
                  <small className="hw-ago">{postedAgo(post.at, now, ar)}</small>
                </Link>
                <div className="hw-actions">
                  {canFollow && user?.role !== "seller" && (
                    <button type="button" className={following ? "hw-follow is-following" : "hw-follow"} onClick={() => (user ? toggleFollow(post.shopSlug) : navigate({ to: "/sign-in", search: { next: "/hello" } }))}>
                      {following ? "Following" : "Follow"}
                    </button>
                  )}
                  <SharePost id={post.id} />
                  <PostMenu
                    postId={post.id}
                    follow={
                      canFollow && user?.role !== "seller"
                        ? {
                            following,
                            onFollow: () => (user ? toggleFollow(post.shopSlug) : navigate({ to: "/sign-in", search: { next: "/hello" } })),
                          }
                        : undefined
                    }
                    reported={reported.includes(post.id) || !!post.reported}
                    onReport={() => {
                      reportHello(post.id);
                      setReported((ids) => [...ids, post.id]);
                    }}
                  />
                </div>
              </div>
              <HelloText
                text={post.text}
                lang={post.lang}
                handles={handles}
                onAt={(handle) => void navigate({ to: "/hello", search: { tab, at: handle.slice(1), post: "" } })}
              />
              <button type="button" className="hw-photo" aria-label={post.text} onClick={() => openAt(index)}>
                <OptImg src={post.image} alt="" />
              </button>
              <div className="hw-foot">
                <div className="hw-stat">
                  <button type="button" className={helloHearts.includes(post.id) ? "heart-btn is-on" : "heart-btn"} onClick={() => heart(post.id)} aria-label="Heart">
                    <HeartIcon />
                  </button>
                  <span className="hw-likes">
                    <b>{heartCount(post, accounts)}</b> likes
                  </span>
                </div>
                <div className="hw-stat is-views">
                  <b>{post.views}</b> views
                </div>
              </div>
              <TranslateLine text={post.text} lang={post.lang} ui={lang} />
            </article>
          );
        })}
      </div>
      </div>
      {open != null && (
        <HelloViewer
          posts={ordered}
          index={open}
          shops={shops}
          handles={handles}
          accounts={accounts}
          hearts={helloHearts}
          ui={lang}
          now={now}
          onClose={() => setOpen(null)}
          onStep={(next) => {
            if (next < 0 || next >= ordered.length) return;
            openAt(next);
          }}
          onHeart={heart}
          onAt={(handle) => {
            setOpen(null);
            void navigate({ to: "/hello", search: { tab, at: handle.slice(1), post: "" } });
          }}
          reportedIds={reported}
          onReport={(id) => {
            reportHello(id);
            setReported((ids) => (ids.includes(id) ? ids : [...ids, id]));
          }}
        />
      )}
    </div>
  );
}

export function HelloComposer() {
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
  const handles = boardHandles(useSession((s) => s.helloHandles) ?? []);
  const addHelloPost = useSession((s) => s.addHelloPost);
  const pruneHello = useSession((s) => s.pruneHello);
  const deleteHello = useSession((s) => s.deleteHello);
  const ui = useSession((s) => s.lang);
  const ar = ui === "ar";
  const plan = user?.sellerPlan ?? "free";
  const cap = HELLO_CAP[plan];
  const [now, setNow] = useState(() => Date.now());
  const [more, setMore] = useState(false);
  useEffect(() => {
    pruneHello();
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [pruneHello]);
  const all = [...(user ? accounts[user.phone]?.helloPosts ?? [] : [])].sort((a, b) => b.at - a.at);
  const todayKey = ammanDay(now);
  const monthAgo = now - 30 * 864e5;
  const mine = all.filter((post) => ammanDay(post.at) === todayKey);
  const older = all.filter((post) => ammanDay(post.at) !== todayKey && post.at >= monthAgo);
  const [text, setText] = useState("");
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const names = handles.map((item) => item.handle);
  const count = billedLength(text, names);
  const ideas = suggestHandles(text, names);
  const account = user ? accounts[user.phone] : null;
  const spent = account?.helloSpent?.day === todayKey ? account.helloSpent.count : mine.length;
  const ready = text.trim().length >= 2 && count <= 88 && Boolean(image) && spent < cap;
  const [preview, setPreview] = useState(false);
  if (!cap) return <p className="hw-note">{ar ? "Hello, World! بيفتح على الأساسي." : "Hello, World! opens on Basic."}</p>;
  return (
    <div className="hw-write">
      <p>
        {spent} / {cap} {ar ? "اليوم" : "today"}
      </p>
      <div className="hw-lang">
        <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>
          English
        </button>
        <button type="button" className={lang === "ar" ? "is-on" : ""} onClick={() => setLang("ar")}>
          العربية
        </button>
      </div>
      <label>
        The line
        <textarea value={text} dir={lang === "ar" ? "rtl" : "ltr"} onChange={(event) => setText(event.target.value)} rows={3} />
      </label>
      <p className={count > 88 ? "is-over" : ""}>
        {count} / 88
      </p>
      {ideas.length > 0 && (
        <div className="hw-ideas">
          {ideas.map((handle) => (
            <button
              key={handle}
              type="button"
              onClick={() => setText((current) => current.replace(/@[A-Za-z0-9]*$/, handle))}
            >
              {handle}
            </button>
          ))}
        </div>
      )}
      <SquareCrop label="Photo" src={image} onPick={setImage} story />
      {error && <p className="hw-note">{error}</p>}
      <button
        type="button"
        className="hw-send"
        disabled={!ready}
        onClick={() => {
          if (!ready) return;
          setPreview(true);
        }}
      >
        {ar ? "انشر" : "Post"}
      </button>
      <p className="hw-note">{ar ? "ما بتقدر تنشر إلا إذا كتبت شي ورفعت صورة." : "You can only post when you write something and upload an image."}</p>
      <h2 className="hw-history-title">{ar ? "السجل" : "History"}</h2>
      {mine.length === 0 && <p className="hw-note">{ar ? "ما في منشور اليوم." : "Nothing posted today."}</p>}
      <ul className="hw-mine">
        {mine.map((post) => (
          <HistoryRow key={post.id} post={post} ar={ar} now={now} today onDelete={deleteHello} />
        ))}
      </ul>
      {older.length > 0 && (
        <button type="button" className="hw-more-posts" onClick={() => setMore(true)}>
          {ar ? "المزيد" : "More"}
        </button>
      )}
      {preview && image && (
        <div className="hw-view" onClick={() => setPreview(false)}>
          <div className="hw-confirm" onClick={(event) => event.stopPropagation()}>
            <article className="hw-card">
              <div className="hw-top">
                <span>
                  <OptImg className="hw-logo" src={(account?.sellerPlan ?? "free") === "free" ? "/brand/avatars/seller-duck.jpg?v=2" : account?.stallAvatar || "/brand/avatars/seller-duck.jpg?v=2"} alt="" />
                  <b>{account?.displayName || account?.username || (ar ? "دكانك" : "Your stall")}</b>
                </span>
              </div>
              <div className="hw-photo">
                <OptImg src={image} alt="" />
              </div>
              <HelloText text={text.trim()} lang={lang} handles={handles} onAt={() => undefined} />
              <time>{helloStamp(now)}</time>
              <div className="hw-foot">
                <div className="hw-stat">
                  <span className="hw-likes"><b>0</b> {ar ? "إعجاب" : "likes"}</span>
                </div>
                <div className="hw-stat is-views">
                  <b>0</b> {ar ? "مشاهدة" : "views"}
                </div>
              </div>
            </article>
            <div className="hw-confirm-actions">
              <button
                type="button"
                className="yes"
                onClick={() => {
                  const res = addHelloPost({ text, lang, image });
                  if (!res.ok) {
                    setError(res.error === "limit" ? (ar ? "خلصت مشاركات اليوم." : "That is over the limit for today.") : (ar ? "اكتب سطر وضيف صورة." : "Add a line and a photo."));
                    setPreview(false);
                    return;
                  }
                  setText("");
                  setImage(null);
                  setError("");
                  setPreview(false);
                }}
              >
                {ar ? "تأكيد" : "Confirm"}
              </button>
              <button type="button" className="no" onClick={() => setPreview(false)}>
                {ar ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
      {more && (
        <div className="hw-view" onClick={() => setMore(false)}>
          <div className="hw-month" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="hw-x" onClick={() => setMore(false)} aria-label={ar ? "إغلاق" : "Close"}>×</button>
            <h3>{ar ? "آخر شهر" : "This month"}</h3>
            <ul className="hw-mine">
              {older.map((post) => (
                <HistoryRow key={post.id} post={post} ar={ar} now={now} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function HelloDesk() {
  const accounts = useSession((s) => s.accounts);
  const handles = boardHandles(useSession((s) => s.helloHandles) ?? []);
  const deskAddHandle = useSession((s) => s.deskAddHandle);
  const deskRemoveHandle = useSession((s) => s.deskRemoveHandle);
  const deskDeleteHello = useSession((s) => s.deskDeleteHello);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const posts = postsToday(Object.values(accounts).flatMap((account) => account.helloPosts ?? [])).sort((a, b) => b.at - a.at);
  const preview = toHandle(name);
  return (
    <section className="mt-6 grid gap-6">
      <form
        className="grid max-w-xl gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const res = deskAddHandle(name, note);
          setError(res.ok ? "" : res.error === "taken" ? "That @ already exists." : "Type a place name.");
          if (res.ok) {
            setName("");
            setNote("");
          }
        }}
      >
        <h2 className="font-display text-2xl">@ names</h2>
        <label className="text-sm">
          Place name
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" />
        </label>
        {preview && <p className="text-sm">Becomes {preview}</p>}
        <label className="text-sm">
          Note on the @ page
          <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" />
        </label>
        {error && <p className="text-sm text-red">{error}</p>}
        <button type="submit" className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">
          Add @
        </button>
        <ul className="grid gap-2">
          {handles.map((item) => (
            <li key={item.handle} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <b>{item.handle}</b> · {item.name}
              </span>
              <button type="button" onClick={() => deskRemoveHandle(item.handle)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </form>
      <div>
        <h2 className="font-display text-2xl">Today's posts</h2>
        <ul className="mt-3 grid gap-3">
          {posts.map((post) => (
            <li key={post.id} className="flex items-start gap-3 rounded-xl border border-line bg-cream p-3">
              <OptImg src={post.image} alt="" className="size-16 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{post.text}</p>
                <p className="text-xs text-mute">
                  {post.shopSlug} · {post.views} views {post.reported ? "· reported" : ""}
                </p>
              </div>
              <button type="button" className="text-sm" onClick={() => deskDeleteHello(post.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
