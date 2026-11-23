import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SHOPS, SHOP_WHATSAPP, type Product, type Shop } from "@/lib/data";
import { directoryShops, isValidUsername, usernameTaken, useSession, type BookmarkList, type BuyerAccount, type FollowedList, type SavedAddress } from "@/lib/session";
import { isReservedBrand } from "@/lib/reserved-brand";
import { copy, place } from "@/lib/i18n";
import { deleteSouqAccount, requestAccountDeleteCode } from "@/lib/souq-sync";
import { DEFAULT_ALGO_ORDER, WORD_CAP, algoOrder, journeyHint, type AlgoLever } from "@/lib/shelves";
import { Shell } from "@/components/site-header";
import { OptImg } from "@/components/opt-img";
import { LocationPicker } from "@/components/location-picker";
import { SavePlaceSheet } from "@/components/place-picker";
import { keepLang } from "@/lib/site";

function shopName(shop: Shop, ar: boolean) {
  return ar ? shop.nameAr : shop.name;
}

function SortGrid({
  ids,
  className,
  label,
  onReorder,
  render,
}: {
  ids: string[];
  className: string;
  label: string;
  onReorder: (ids: string[]) => void;
  render: (id: string) => ReactNode;
}) {
  const idsRef = useRef(ids);
  const onReorderRef = useRef(onReorder);
  const from = useRef<number | null>(null);
  idsRef.current = ids;
  onReorderRef.current = onReorder;

  function reorderTo(to: number) {
    const start = from.current;
    const current = idsRef.current;
    if (start == null || start === to || to < 0 || to >= current.length) return;
    const next = current.slice();
    const [item] = next.splice(start, 1);
    next.splice(to, 0, item);
    from.current = to;
    onReorderRef.current(next);
  }

  function onPointerDown(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    from.current = index;
    const move = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-sort-index]");
      if (!el) return;
      reorderTo(Number((el as HTMLElement).dataset.sortIndex));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      from.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className={className}>
      {ids.map((id, index) => (
        <div key={id} className="bookmark-sort" data-sort-index={index}>
          <button type="button" className="bookmark-grip" aria-label={label} onPointerDown={(event) => onPointerDown(index, event)}>
            ⋮⋮
          </button>
          {render(id)}
        </div>
      ))}
    </div>
  );
}

function BookmarkBoards({
  ar,
  stalls,
  lists,
  openList,
  listName,
  onOpen,
  onName,
  onCreate,
  onReorderLoose,
  onReorderLists,
  onReorderInside,
  onVisibility,
  labels,
}: {
  ar: boolean;
  stalls: Shop[];
  lists: BookmarkList[];
  openList: string;
  listName: string;
  onOpen: (id: string) => void;
  onName: (value: string) => void;
  onCreate: () => void;
  onReorderLoose: (slugs: string[]) => void;
  onReorderLists: (ids: string[]) => void;
  onReorderInside: (listId: string, slugs: string[]) => void;
  onVisibility: (listId: string, visibility: "private" | "public") => void;
  labels: { loose: string; newList: string; listName: string; create: string; back: string; reorder: string; private: string; public: string };
}) {
  const shopBySlug = new Map(stalls.map((shop) => [shop.slug, shop]));
  const listed = new Set(lists.flatMap((list) => list.slugs));
  const loose = stalls.filter((shop) => !listed.has(shop.slug));
  const active = lists.find((list) => list.id === openList);
  const activeShops = active ? active.slugs.map((slug) => shopBySlug.get(slug)).filter((shop): shop is Shop => Boolean(shop)) : [];
  return (
    <div>
      {active ? (
        <>
          <button type="button" className="text-sm font-semibold text-ink" onClick={() => onOpen("")}>{labels.back}</button>
          <h2 className="mt-2 font-display text-xl">{active.name}</h2>
          <SortGrid
            className="bookmark-squares"
            ids={activeShops.map((shop) => shop.slug)}
            label={labels.reorder}
            onReorder={(slugs) => onReorderInside(active.id, slugs)}
            render={(slug) => {
              const shop = shopBySlug.get(slug);
              if (!shop) return null;
              return (
                <Link to="/shop/$slug" params={{ slug: shop.slug }} title={shopName(shop, ar)}>
                  <OptImg src={shop.avatar} alt={shopName(shop, ar)} draggable={false} />
                </Link>
              );
            }}
          />
        </>
      ) : (
        <>
          <h2 className="font-display text-lg">{labels.loose}</h2>
          <SortGrid
            className="bookmark-squares"
            ids={loose.map((shop) => shop.slug)}
            label={labels.reorder}
            onReorder={onReorderLoose}
            render={(slug) => {
              const shop = shopBySlug.get(slug);
              if (!shop) return null;
              return (
                <Link to="/shop/$slug" params={{ slug: shop.slug }} title={shopName(shop, ar)}>
                  <OptImg src={shop.avatar} alt={shopName(shop, ar)} draggable={false} />
                </Link>
              );
            }}
          />
          <form
            className="mt-4 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onCreate();
            }}
          >
            <input className="h-10 rounded-md border border-line bg-white px-3 text-sm" value={listName} onChange={(event) => onName(event.target.value)} placeholder={labels.listName} aria-label={labels.listName} />
            <button type="submit" className="h-10 rounded-md bg-ink px-3 text-sm text-cream">{labels.newList}</button>
          </form>
          <SortGrid
            className="bookmark-lists"
            ids={lists.map((list) => list.id)}
            label={labels.reorder}
            onReorder={onReorderLists}
            render={(id) => {
              const list = lists.find((item) => item.id === id);
              if (!list) return null;
              const shops = list.slugs.map((slug) => shopBySlug.get(slug)).filter((shop): shop is Shop => Boolean(shop)).slice(0, 4);
              return (
                <div className="bookmark-list-tile" onClick={() => onOpen(list.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(list.id); }}>
                  <span className="bookmark-quad">
                    {Array.from({ length: 4 }, (_, index) => (
                      <span key={index}>{shops[index] ? <OptImg src={shops[index].avatar} alt="" draggable={false} /> : null}</span>
                    ))}
                  </span>
                  <strong>{list.name}</strong>
                  <span className="list-visibility">
                    <button type="button" className={(list.visibility ?? "private") === "private" ? "is-on" : ""} onClick={(event) => { event.stopPropagation(); onVisibility(list.id, "private"); }}>{labels.private}</button>
                    <button type="button" className={list.visibility === "public" ? "is-on" : ""} onClick={(event) => { event.stopPropagation(); onVisibility(list.id, "public"); }}>{labels.public}</button>
                  </span>
                </div>
              );
            }}
          />
        </>
      )}
    </div>
  );
}

function FollowedLists({
  me,
  accounts,
  followed,
  onFollow,
  onCopy,
  labels,
}: {
  me: string;
  accounts: Record<string, BuyerAccount>;
  followed: FollowedList[];
  onFollow: (phone: string, listId: string) => void;
  onCopy: (phone: string, listId: string) => void;
  labels: { title: string; follow: string; following: string; copy: string; empty: string };
}) {
  const catalog = new Map<string, Shop>();
  for (const shop of [...SHOPS, ...directoryShops(accounts)]) catalog.set(shop.slug, shop);
  const rows = Object.entries(accounts).flatMap(([phone, account]) => {
    if (phone === me || account.role === "seller") return [];
    return (account.bookmarkLists ?? [])
      .filter((list) => list.visibility === "public")
      .map((list) => ({ phone, owner: account.displayName || account.username || phone, list }));
  });
  return (
    <section>
      <h2 className="font-display text-lg">{labels.title}</h2>
      {rows.length === 0 && <p className="mt-2 text-sm text-mute">{labels.empty}</p>}
      <div className="bookmark-lists">
        {rows.map(({ phone, owner, list }) => {
          const on = followed.some((item) => item.phone === phone && item.listId === list.id);
          const shops = list.slugs.map((slug) => catalog.get(slug)).filter((shop): shop is Shop => Boolean(shop)).slice(0, 4);
          return (
            <article key={`${phone}:${list.id}`} className="bookmark-list-tile">
              <span className="bookmark-quad">
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index}>{shops[index] ? <OptImg src={shops[index].avatar} alt="" /> : null}</span>
                ))}
              </span>
              <strong>{list.name}</strong>
              <p className="text-xs text-mute">{owner}</p>
              <span className="list-visibility">
                <button type="button" className={on ? "is-on" : ""} onClick={() => onFollow(phone, list.id)}>{on ? labels.following : labels.follow}</button>
                <button type="button" onClick={() => onCopy(phone, list.id)}>{labels.copy}</button>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export const Route = createFileRoute("/account")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "inbox" ? "inbox" as const : s.tab === "saved" ? "saved" as const : "",
    note: typeof s.note === "string" ? s.note : "",
    ...keepLang(s),
  }),
  component: AccountPage,
});

const AREAS = ["Abdoun", "Jabal Amman", "Jabal Al Weibdeh", "Sweifieh", "Downtown", "Shmeisani", "Khalda"];

type Tab = "address" | "inbox" | "favorites" | "follows" | "reviews" | "algo";

function NotifyMe() {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const words = useSession((s) => s.alertWords);
  const addWord = useSession((s) => s.addWord);
  const removeWord = useSession((s) => s.removeWord);
  const syncAlerts = useSession((s) => s.syncAlerts);
  useEffect(() => {
    syncAlerts();
  }, [syncAlerts]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const word = String(new FormData(event.currentTarget).get("word") ?? "");
    addWord("alert", word);
    event.currentTarget.reset();
  }

  return (
    <div className="notify-me">
      <h2>{ar ? "خبرني" : "Notify me"}</h2>
      <p>{ar ? "اكتب كلمة. إذا صار في مكان فيها، بتوصلك رسالة في الوارد." : "Write a word. When a place has it, a message lands in your inbox."}</p>
      <div className="algo-chips">
        {words.map((word) => (
          <button key={word} type="button" onClick={() => removeWord("alert", word)}>
            {word} ×
          </button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
        <input name="word" required minLength={2} placeholder={ar ? "كنافة" : "knafeh"} className="h-11 flex-1 rounded-md border border-line bg-white px-3 text-sm" />
        <button type="submit" className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">
          {ar ? "أضف" : "Add"}
        </button>
      </form>
      {words.length === 0 && <p className="algo-empty">{ar ? "ما في كلمات بعد." : "No words yet."}</p>}
    </div>
  );
}

function BuyerInbox({
  ar,
  notes,
  focusId = "",
}: {
  ar: boolean;
  notes: { id: string; title: string; body: string; href?: string; at: number; read?: boolean }[];
  focusId?: string;
}) {
  const messageSouq = useSession((s) => s.messageSouq);
  const markNoteRead = useSession((s) => s.markNoteRead);
  const dismissNote = useSession((s) => s.dismissNote);
  const follows = useSession((s) => s.follows) ?? [];
  const [pane, setPane] = useState<"in" | "contact" | "watch">("in");
  const [sent, setSent] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [askDelete, setAskDelete] = useState(false);
  const messages = notes
    .filter((note) => {
      if (note.id.startsWith("sent-") || note.title === "You wrote to Souq Battuta") return false;
      if (note.id === "souq-welcome" || note.id.startsWith("sq-") || note.title === "Souq Battuta" || note.title.includes("Souq Battuta")) return true;
      if (note.id.startsWith("promo-") || note.id.startsWith("alert-")) return true;
      const slug = note.href?.startsWith("/shop/") ? note.href.slice("/shop/".length) : "";
      return Boolean(slug && follows.includes(slug));
    })
    .map((note) => {
      const fromSouq = note.id === "souq-welcome" || note.id.startsWith("sq-") || note.title === "Souq Battuta" || (note.title.includes("Souq Battuta") && !note.id.startsWith("promo-"));
      const fromWatch = note.id.startsWith("alert-");
      const posted = note.title.split(" posted ")[0];
      return {
        id: note.id,
        from: fromSouq ? "Souq Battuta" : fromWatch ? (ar ? "خبرني" : "Notify me") : posted,
        title: note.title,
        body: note.body,
        href: note.href,
        at: note.at,
        read: note.read === true,
      };
    })
    .sort((a, b) => b.at - a.at);
  const [openId, setOpenId] = useState(focusId);
  useEffect(() => {
    if (!focusId) return;
    setPane("in");
    setOpenId(focusId);
    markNoteRead(focusId);
    let tries = 0;
    const timer = window.setInterval(() => {
      const row = document.getElementById(`mail-${focusId}`);
      tries += 1;
      if (row) {
        row.scrollIntoView({ block: "center" });
        window.clearInterval(timer);
      } else if (tries > 24) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [focusId, markNoteRead]);
  return (
    <section>
      <div className="subtabs" role="tablist">
        <button type="button" aria-selected={pane === "in"} onClick={() => setPane("in")}>{ar ? "الوارد" : "Inbox"}</button>
        <button type="button" aria-selected={pane === "watch"} onClick={() => setPane("watch")}>{ar ? "خبرني" : "Notify me"}</button>
        <button type="button" aria-selected={pane === "contact"} onClick={() => setPane("contact")}>{ar ? "تواصل مع سوق بطوطة" : "Contact Souq Battuta"}</button>
      </div>
      {pane === "watch" ? (
        <NotifyMe />
      ) : pane === "contact" ? (
        <form
          className="buyer-compose"
          onSubmit={(event) => {
            event.preventDefault();
            const body = String(new FormData(event.currentTarget).get("body") ?? "");
            if (!messageSouq(body).ok) return;
            event.currentTarget.reset();
            setSent(true);
          }}
        >
          <textarea name="body" required rows={5} placeholder={ar ? "اكتب رسالتك" : "Write your message"} />
          <div className="address-save-row">
            <button type="submit">{ar ? "تواصل مع سوق بطوطة" : "Contact Souq Battuta"}</button>
          </div>
          {sent && <p>{ar ? "وصلت الرسالة. منرد من الموقع بس." : "Sent. We reply on the site only."}</p>}
        </form>
      ) : (
        <>
        <ul className="mail-list">
          {messages.length === 0 && <li className="p-4 text-sm text-mute">{ar ? "ما في رسائل." : "No messages."}</li>}
          {messages.map((message) => {
            const when = new Date(message.at).toLocaleDateString(ar ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" });
            return (
              <li key={message.id} id={`mail-${message.id}`} className={message.read ? "mail-row" : "mail-row is-unread"}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(openId === message.id ? "" : message.id);
                    if (!message.read) markNoteRead(message.id);
                  }}
                >
                  <b>{ar ? "من" : "From"} {message.from}</b>
                  <span>{message.title} · {when}</span>
                </button>
                <input
                  type="checkbox"
                  aria-label={ar ? "تحديد" : "Select"}
                  checked={picked.includes(message.id)}
                  onChange={() => setPicked((current) => (current.includes(message.id) ? current.filter((id) => id !== message.id) : [...current, message.id]))}
                />
                {openId === message.id && (
                  <p className="mail-body">
                    {message.body}
                    {message.href?.startsWith("/shop/") && (
                      <>
                        {" "}
                        <Link to="/shop/$slug" params={{ slug: message.href.slice("/shop/".length) }} className="underline">
                          {ar ? "افتح المكان" : "Open the place"}
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <button type="button" className="mail-delete" disabled={picked.length === 0} onClick={() => setAskDelete(true)}>
          {ar ? "حذف" : "Delete"}
        </button>
        {askDelete && (
          <div className="list-modal" onClick={() => setAskDelete(false)}>
            <div className="address-sheet mail-ask" onClick={(event) => event.stopPropagation()}>
              <p>{ar ? "متأكد بدك تحذف؟" : "Are you sure you want to delete?"}</p>
              <div>
                <button
                  type="button"
                  className="yes"
                  onClick={() => {
                    picked.forEach((id) => dismissNote(id));
                    setPicked([]);
                    setAskDelete(false);
                  }}
                >
                  {ar ? "نعم" : "Yes"}
                </button>
                <button type="button" className="no" onClick={() => setAskDelete(false)}>{ar ? "لا" : "No"}</button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </section>
  );
}

function findFavorite(id: string): { product: Product; shop: Shop } | null {
  for (const shop of SHOPS) {
    const product = shop.products.find((item) => item.id === id);
    if (product) return { product, shop };
  }
  return null;
}

function AccountPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
  const signOut = useSession((s) => s.signOut);
  const updateProfile = useSession((s) => s.updateProfile);
  const ensureBuyerWelcome = useSession((s) => s.ensureBuyerWelcome);
  const setBuyerShare = useSession((s) => s.setBuyerShare);
  const favorites = useSession((s) => s.favorites);
  const bookmarks = useSession((s) => s.bookmarks);
  const bookmarkLists = useSession((s) => s.bookmarkLists ?? []);
  const createBookmarkList = useSession((s) => s.createBookmarkList);
  const reorderBookmarks = useSession((s) => s.reorderBookmarks);
  const reorderBookmarkLists = useSession((s) => s.reorderBookmarkLists);
  const reorderBookmarkList = useSession((s) => s.reorderBookmarkList);
  const setListVisibility = useSession((s) => s.setListVisibility);
  const followedLists = useSession((s) => s.followedLists ?? []);
  const followList = useSession((s) => s.followList);
  const copyList = useSession((s) => s.copyList);
  const follows = useSession((s) => s.follows) ?? [];
  const notes = useSession((s) => s.notes);
  const { tab: tabFromUrl, note: noteFromUrl } = Route.useSearch();
  const orders = useSession((s) => s.orders);
  const ownReviews = useSession((s) => s.ownReviews);
  const reviewVotes = useSession((s) => s.reviewVotes);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(tabFromUrl === "inbox" ? "inbox" : "algo");
  const [favTab, setFavTab] = useState<"liked" | "stalls">(tabFromUrl === "saved" ? "stalls" : "liked");
  useEffect(() => {
    if (tabFromUrl === "inbox") setTab("inbox");
    if (tabFromUrl === "saved") {
      setTab("favorites");
      setFavTab("stalls");
    }
  }, [tabFromUrl]);
  const [openList, setOpenList] = useState("");
  const [listName, setListName] = useState("");
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");

  useEffect(() => {
    if (!user || user.role === "seller") return;
    ensureBuyerWelcome();
  }, [ensureBuyerWelcome, user]);

  useEffect(() => {
    if (!user || user.role === "seller") return;
    if (user.joinedAt || accounts[user.phone]?.joinedAt) return;
    updateProfile({
      username: user.username,
      displayName: user.displayName,
      city: user.city,
      bio: user.bio,
    });
  }, [user, accounts, updateProfile]);

  if (!user) {
    return (
      <Shell>
        <main className="px-6 py-16">
          <h1 className="font-display text-2xl">{t.account}</h1>
          <div className="mt-4 flex gap-2">
            <Link to="/sign-in" search={{ next: "/account" }} className="inline-flex h-12 items-center rounded-md bg-ink px-5 text-cream">
              {t.signIn}
            </Link>
            <Link to="/join" search={{ intent: "buyer" }} className="inline-flex h-12 items-center rounded-md border border-line px-5">
              {t.createAccount}
            </Link>
          </div>
        </main>
      </Shell>
    );
  }

  const avatar = "/brand/avatars/buyer-duck.jpg?v=7";
  const joinedAt = user.joinedAt ?? accounts[user.phone]?.joinedAt;
  const stalls = bookmarks.map((slug) => SHOPS.find((shop) => shop.slug === slug) ?? directoryShops(accounts).find((shop) => shop.slug === slug)).filter((shop): shop is Shop => Boolean(shop));
  const followed = follows
    .map((slug) => SHOPS.find((shop) => shop.slug === slug) ?? directoryShops(accounts).find((shop) => shop.slug === slug))
    .filter((shop): shop is Shop => Boolean(shop));
  const savedItems = favorites.map(findFavorite).filter((item): item is { product: Product; shop: Shop } => Boolean(item));
  const nameOk = isValidUsername(username);
  const userReserved = isReservedBrand(username);
  const displayReserved = isReservedBrand(displayName);
  const nameTaken = nameOk && !userReserved && usernameTaken(username, accounts, user.phone);
  const hasNotes = notes.length > 0 || orders.some((order) => !order.reviewed);

  function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nextName = String(fd.get("username") ?? "");
    const nextDisplay = String(fd.get("displayName") ?? "");
    if (!user) return;
    if (isReservedBrand(nextName) || isReservedBrand(nextDisplay)) return setError(t.nameReserved);
    if (!isValidUsername(nextName)) return setError(t.shortUser);
    if (usernameTaken(nextName, accounts, user.phone)) return setError(t.usernameTaken);
    updateProfile({
      username: nextName,
      displayName: String(fd.get("displayName") ?? ""),
      city: String(fd.get("city") ?? ""),
      bio: String(fd.get("bio") ?? ""),
    });
    setError("");
    setSaved(true);
    setEditing(false);
  }

  return (
    <Shell>
      <main className="buyer-profile">
        <header className="buyer-hero">
          <OptImg src={avatar} alt="" className="buyer-avatar" />
          <div>
            <h1 className="font-display text-3xl">{user.displayName || user.username}</h1>
            <p className="text-sm text-mute">@{user.username}</p>
            <p className="text-sm text-mute">{user.city || t.cityName}</p>
            <p className="text-sm font-semibold text-ink">
              {t.memberSince}{" "}
              {new Date(joinedAt || Date.now()).toLocaleDateString(lang === "ar" ? "ar" : "en", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="text-sm text-mute">
              {t.nameChanges}: {user.usernameHistory?.length ?? 0}
            </p>
            {(user.usernameHistory?.length ?? 0) > 0 && (
              <p className="text-sm text-mute">
                {t.formerNames}: {user.usernameHistory?.join(", ")}
              </p>
            )}
            {user.friendsOfBattuta && <span className="buyer-badge">Friends of Battuta</span>}
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <button
              type="button"
              className="buyer-edit h-11 rounded-md border border-ink px-4 text-sm font-semibold"
              onClick={() => {
                setUsername(user.username);
                setDisplayName(user.displayName || "");
                setEditing((open) => !open);
              }}
            >
              {editing ? t.back : t.editProfile}
            </button>
            <Link to="/buyer/$username" params={{ username: user.username }} className="buyer-edit inline-flex h-11 items-center justify-center rounded-md border border-ink px-4 text-sm font-semibold">
              {t.viewProfile}
            </Link>
            <Link to="/sell" className="inline-flex h-11 items-center justify-center rounded-md border border-line px-4 text-sm">
              {t.sell}
            </Link>
          </div>
        </header>

        {editing ? (
          <form className="mt-6 space-y-3" key={`${user.phone}-${user.username}-${user.displayName}-${user.city}`} onSubmit={onSave}>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">{t.displayName}</span>
              <input
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-12 w-full rounded-md border border-line bg-white px-3"
              />
              {displayReserved && <span className="mt-1 block text-xs text-red">{t.nameReserved}</span>}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">{t.username}</span>
              <input
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 w-full rounded-md border border-line bg-white px-3"
                required
              />
              <span className={`mt-1 block text-xs ${!nameOk || nameTaken || userReserved ? "text-red" : "text-mute"}`}>
                {!username ? t.shortUser : userReserved ? t.nameReserved : !nameOk ? t.shortUser : nameTaken ? t.usernameTaken : t.usernameFree}
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">{t.city}</span>
              <select name="city" defaultValue={user.city || ""} className="h-12 w-full rounded-md border border-line bg-white px-3">
                <option value="">{t.city}</option>
                {AREAS.map((area) => (
                  <option key={area} value={area}>
                    {place(area, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">{t.bio}</span>
              <textarea name="bio" defaultValue={user.bio || ""} rows={3} className="w-full rounded-md border border-line bg-white px-3 py-2" />
            </label>
            {error && <p className="text-sm text-red">{error}</p>}
            <button type="submit" className="h-12 rounded-md bg-ink px-5 font-semibold text-cream">
              {t.saveProfile}
            </button>
          </form>
        ) : (
          user.bio ? <p className="mt-5 max-w-xl text-sm text-ink">{user.bio}</p> : null
        )}
        {saved && !editing && <p className="mt-2 text-sm text-ink">{t.saved}</p>}

        <div className="profile-tabs" role="tablist">
          {(
            [
              ["algo", t.yourAlgorithm],
              ["address", t.addresses],
              ["inbox", t.inbox],
              ["favorites", t.favorites],
              ["follows", t.following],
              ["reviews", t.reviews],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
              {id === "inbox" && hasNotes && <span className="note-dot" />}
            </button>
          ))}
        </div>

        <div className="profile-panel">
        {tab === "address" && <AddressBook />}
        {tab === "inbox" && (
          <BuyerInbox ar={lang === "ar"} notes={notes} focusId={tab === "inbox" ? noteFromUrl : ""} />
        )}
        {tab === "favorites" && (
          <section className="fav-stack">
            <div className="subtabs" role="tablist">
              <button type="button" role="tab" aria-selected={favTab === "liked"} onClick={() => setFavTab("liked")}>
                {t.liked}
              </button>
              <button type="button" role="tab" aria-selected={favTab === "stalls"} onClick={() => setFavTab("stalls")}>
                {t.savedStalls}
              </button>
            </div>
            {favTab === "liked" && (
              <label className="share-line">
                <input
                  type="checkbox"
                  checked={user.shareLikes === true}
                  onChange={(e) => setBuyerShare({ shareLikes: e.target.checked })}
                />
                <span>{t.shareLikes}</span>
              </label>
            )}
            {favTab === "stalls" && (
              <BookmarkBoards
                ar={lang === "ar"}
                stalls={stalls}
                lists={bookmarkLists}
                openList={openList}
                listName={listName}
                onOpen={setOpenList}
                onName={setListName}
                onCreate={() => {
                  createBookmarkList(listName);
                  setListName("");
                }}
                onReorderLoose={reorderBookmarks}
                onReorderLists={reorderBookmarkLists}
                onReorderInside={reorderBookmarkList}
                onVisibility={setListVisibility}
                labels={{ loose: t.looseBookmarks, newList: t.newList, listName: t.listName, create: t.createList, back: t.back, reorder: t.reorder, private: t.listPrivate, public: t.listPublic }}
              />
            )}
            {favTab === "stalls" && (
              <FollowedLists
                me={user.phone}
                accounts={accounts}
                followed={followedLists}
                onFollow={followList}
                onCopy={copyList}
                labels={{ title: t.followedLists, follow: t.followList, following: t.followingList, copy: t.saveListCopy, empty: t.noPublicLists }}
              />
            )}
            <div className="buyer-grid">
              {favTab === "liked" &&
                savedItems.map(({ product, shop }) => (
                  <Link key={product.id} to="/shop/$slug" params={{ slug: shop.slug }} className="buyer-card">
                    <OptImg src={product.images[0] || shop.avatar} alt="" />
                    <p>{lang === "ar" ? product.nameAr : product.name}</p>
                  </Link>
                ))}
            </div>
            {favTab === "liked" && savedItems.length === 0 && (
              <p className="text-sm text-mute">{t.noSaves}</p>
            )}
          </section>
        )}
        {tab === "follows" && (
          <section className="mt-4">
            <div className="buyer-grid">
              {followed.map((shop) => (
                <Link key={shop.slug} to="/shop/$slug" params={{ slug: shop.slug }} className="buyer-card">
                  <OptImg src={shop.avatar} alt="" />
                  <p>{lang === "ar" ? shop.nameAr : shop.name}</p>
                </Link>
              ))}
            </div>
            {followed.length === 0 && <p className="text-sm text-mute">{lang === "ar" ? "ما تتابع أي دكان بعد." : "You are not following any stall yet."}</p>}
          </section>
        )}
        {tab === "reviews" && (
          <ul className="mt-4 divide-y divide-line">
            {ownReviews.length === 0 && <li className="py-3 text-sm text-mute">{t.noSaves}</li>}
            {ownReviews.map((review) => {
              const tally = reviewVotes[`${review.shopSlug}:${review.id}`] ?? { up: [], down: [] };
              return (
                <li key={review.id} className="py-3">
                  <p className="text-sm font-semibold">{review.user}</p>
                  <p className="text-sm">“{review.comment}”</p>
                  <p className="mt-1 text-xs text-mute">
                    {t.useful} {tally.up.length} · {t.notUseful} {tally.down.length}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {tab === "algo" && <AlgorithmBoard />}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-11 rounded-md bg-ink px-4 text-sm text-cream"
            onClick={() => {
              signOut();
              void navigate({ to: "/" });
            }}
          >
            {t.signOut}
          </button>
        </div>
        <DeleteAccount />
      </main>
    </Shell>
  );
}

function shopCodeNeeded(raw: unknown) {
  let text = String(raw ?? "").trim().replace(/[\s().-]/g, "");
  if (text.startsWith("00")) text = `+${text.slice(2)}`;
  const digits = text.startsWith("+") ? text.slice(1).replace(/\D/g, "") : text.replace(/\D/g, "");
  let phone = "";
  if (/^9620?7\d{8}$/.test(digits)) phone = `+962${digits.slice(-9)}`;
  else if (/^07\d{8}$/.test(digits)) phone = `+962${digits.slice(1)}`;
  else if (/^7\d{8}$/.test(digits)) phone = `+962${digits}`;
  else if (digits) phone = `+${digits}`;
  return SHOP_WHATSAPP.test(phone);
}

function DeleteAccount() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const navigate = useNavigate();
  const needsCode = shopCodeNeeded(user?.whatsappPhone);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  if (!user) return null;

  function note(kind: string) {
    if (kind === "password") return t.wrongPass;
    if (kind === "username") return t.deleteUserMismatch;
    if (kind === "expired") return t.otpExpired;
    if (kind === "attempts") return t.otpAttempts;
    if (kind === "rate") return t.lockedOut;
    if (kind === "cooldown") return t.otpWait.replace("{s}", "60");
    if (kind === "unconfigured") return t.otpUnconfigured;
    if (kind === "send") return t.otpSend;
    if (kind === "otp") return t.badOtp;
    return t.badOtp;
  }

  async function sendCode() {
    setError("");
    setSending(true);
    try {
      const res = await requestAccountDeleteCode();
      if (!res.ok) setError(note(res.error));
    } catch {
      setError(t.otpSend);
    } finally {
      setSending(false);
    }
  }

  async function onDelete(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    if (needsCode && !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError("");
    try {
      const res = await deleteSouqAccount({
        data: { username: username.trim(), password, ...(needsCode ? { code } : {}) },
      });
      if (!res.ok) {
        setError(note(res.error));
        setBusy(false);
        return;
      }
      try {
        sessionStorage.setItem("souq-account-deleted", "1");
      } catch {
        /* the home page still loads */
      }
      signOut();
      void navigate({ to: "/home" });
    } catch {
      setError(t.otpSend);
      setBusy(false);
    }
  }

  return (
    <section className="account-delete" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <h2>{t.deleteAccount}</h2>
      <p>{t.deleteAccountBody}</p>
      <form onSubmit={onDelete}>
        <label>
          <span className="mb-1 block font-semibold">{t.username}</span>
          <input
            name="confirm-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-12 w-full rounded-md border border-line bg-white px-3"
            required
          />
        </label>
        <label>
          <span className="mb-1 block font-semibold">{t.password}</span>
          <input
            name="confirm-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-md border border-line bg-white px-3"
            required
          />
        </label>
        {needsCode && (
          <label>
            <span className="mb-1 block font-semibold">{t.otpTitle}</span>
            <input
              name="confirm-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-12 w-full rounded-md border border-line bg-white px-3"
              required
            />
          </label>
        )}
        {needsCode && (
          <button type="button" className="account-delete-send rounded-md px-3 text-sm font-semibold" disabled={sending || busy} onClick={() => void sendCode()}>
            {t.otpResend}
          </button>
        )}
        {error && <p className="text-sm text-red">{error}</p>}
        <button
          type="submit"
          className="account-delete-go rounded-md px-3"
          disabled={busy || !username.trim() || !password || (needsCode && !/^\d{6}$/.test(code))}
        >
          {t.deleteAccountGo}
        </button>
      </form>
    </section>
  );
}

function AddressBook() {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const addresses = useSession((s) => s.addresses);
  const removeAddress = useSession((s) => s.removeAddress);
  const [picker, setPicker] = useState<{ id?: string; lat?: number; lng?: number; label?: string; name?: string } | null>(null);
  const [draft, setDraft] = useState<{ id?: string; lat: number; lng: number; label: string; name?: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const doomed = addresses.find((item: { id: string }) => item.id === confirmId);

  return (
    <section>
      <ul className="address-boxes">
        {addresses.map((item: { id: string; name: string; line?: string; lat?: number; lng?: number }) => (
          <li key={item.id} className="address-box">
            <b>{item.name === "Home" ? "Home · البيت" : item.name === "Work" ? "Work · الشغل" : item.name}</b>
            <span>{item.line}</span>
            <div>
              <button type="button" onClick={() => setPicker({ id: item.id, lat: item.lat, lng: item.lng, label: item.line, name: item.name })}>{ar ? "تعديل" : "Edit"}</button>
              <button type="button" onClick={() => setConfirmId(item.id)}>{ar ? "حذف" : "Delete"}</button>
            </div>
          </li>
        ))}
      </ul>
      <p className="home-note">{ar ? "أماكنك المحفوظة ما بيشوفها غيرك" : "Only you can see your saved places"}</p>
      <button type="button" className="mt-4 h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream" disabled={addresses.length >= 10} onClick={() => setPicker({})}>
        {ar ? "أضف مكاناً" : "+ Add a place"}
      </button>
      {picker && (
        <LocationPicker
          mode="fullscreen"
          searchLabel=""
          locateLabel=""
          hint=""
          initial={picker.lat != null && picker.lng != null ? { lat: picker.lat, lng: picker.lng, label: picker.label } : null}
          onClose={() => setPicker(null)}
          onPick={(lat, lng, label) => {
            setDraft({ id: picker.id, lat, lng, label: label || picker.label || "", name: picker.name });
            setPicker(null);
          }}
        />
      )}
      {draft && (
        <SavePlaceSheet
          pin={{ lat: draft.lat, lng: draft.lng, label: draft.label }}
          startName={draft.name}
          id={draft.id}
          onClose={() => setDraft(null)}
          onDone={() => setDraft(null)}
        />
      )}
      {doomed && (
        <div className="place-save" role="dialog" aria-modal="true">
          <div className="place-save-card">
            <h3>{ar ? `نحذف ${doomed.name}؟` : `Delete ${doomed.name}?`}</h3>
            <div className="place-save-row">
              <button type="button" onClick={() => { void removeAddress(doomed.id); setConfirmId(null); }}>{ar ? "حذف" : "Delete"}</button>
              <button type="button" onClick={() => setConfirmId(null)}>{ar ? "رجوع" : "Back"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AlgorithmBoard() {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const t = copy[lang];
  const interest = useSession((s) => s.interestWords);
  const mutedWords = useSession((s) => s.mutedWords ?? []);
  const mutedStalls = useSession((s) => s.mutedStalls ?? []);
  const dismissed = useSession((s) => s.dismissedSuggestions ?? []);
  const recent = useSession((s) => s.recentSlugs ?? []);
  const counts = useSession((s) => s.visitCounts ?? {});
  const order = algoOrder(useSession((s) => s.algoOrder));
  const setAlgoOrder = useSession((s) => s.setAlgoOrder);
  const accounts = useSession((s) => s.accounts);
  const addWord = useSession((s) => s.addWord);
  const dismissSuggestion = useSession((s) => s.dismissSuggestion);
  const unmuteWord = useSession((s) => s.unmuteWord);
  const unmuteStall = useSession((s) => s.unmuteStall);
  const muteStall = useSession((s) => s.muteStall);
  const muteWord = useSession((s) => s.muteWord);
  const shops = directoryShops(accounts);
  const idea = journeyHint(shops, { recent, counts, interest, dismissed, ar });
  const named = mutedStalls
    .map((slug) => shops.find((shop) => shop.slug === slug))
    .filter((shop): shop is NonNullable<typeof shop> => Boolean(shop));
  const labels: Record<AlgoLever, string> = {
    words: t.algoWords,
    ordered: t.algoOrdered,
    follow: t.algoFollow,
    shared: t.algoShared,
    bookmarks: t.algoBookmarks,
    liked: t.algoLiked,
    visited: t.algoVisited,
    likeSimilar: t.algoLikeSimilar,
    followSimilar: t.algoFollowSimilar,
    fresh: t.algoNew,
  };
  const hints: Record<AlgoLever, string> = {
    words: ar ? "دكاكين تطابق الكلمات التي اخترتها." : "Shops that match the words you picked.",
    ordered: ar ? "أماكن طلبت منها." : "Places you have ordered from.",
    follow: ar ? "دكاكين تتابعها." : "Shops you follow.",
    shared: ar ? "دكاكين شاركتها." : "Shops you shared.",
    bookmarks: ar ? "دكاكين حفظتها." : "Shops you saved.",
    liked: ar ? "دكاكين أعجبت بمنتجاتها." : "Shops whose products you liked.",
    visited: ar ? "دكاكين فتحتها." : "Shops you opened.",
    likeSimilar: ar ? "دكاكين تشبه ما أعجبك." : "Shops like the ones you liked.",
    followSimilar: ar ? "دكاكين تشبه ما تتابعه." : "Shops like the ones you follow.",
    fresh: ar ? "دكاكين جديدة تطابق اهتمامك." : "New shops that match an interest of yours.",
  };
  const [saved, setSaved] = useState(false);
  const standard = DEFAULT_ALGO_ORDER.join() === order.join();

  return (
    <section className="algo">
      <div>
        <h2 className="font-display text-xl">{t.showMoreOf}</h2>
        <p className="algo-note">{t.algoLead}</p>
        <AlgoSort
          ids={order}
          label={t.dragRow}
          onReorder={async (next) => {
            const ok = await setAlgoOrder(next);
            if (!ok) return;
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1400);
          }}
          render={(id, index) => (
            <div>
              <p className="algo-name">
                <span
                  className="algo-rank"
                  style={{ background: index === 0 ? "#c45c26" : `rgb(${36 + index * 16}, ${36 + index * 16}, ${36 + index * 16})` }}
                >
                  {index + 1}
                </span>
                {labels[id]}
              </p>
              <p className="algo-plain">{hints[id]}</p>
              {id === "words" && (
                <>
                  <WordList kind="interest" words={interest} cap={WORD_CAP} />
                  <p className="algo-count">{t.algoCount.replace("{n}", String(interest.length))}</p>
                  {idea && interest.length < WORD_CAP && (
                    <p className="algo-ask">
                      <span>{t.journeyAsk.replaceAll("{word}", idea)}</span>
                      <button type="button" onClick={() => addWord("interest", idea)}>{t.yes}</button>
                      <button type="button" onClick={() => dismissSuggestion(idea)}>{t.no}</button>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        />
        {saved && <p className="algo-toast" role="status">Saved ✓</p>}
        {!standard && (
          <button type="button" className="algo-reset" onClick={() => setAlgoOrder([...DEFAULT_ALGO_ORDER])}>
            {t.algoReset}
          </button>
        )}
      </div>
      <div>
        <h2 className="font-display text-xl">{t.notThis}</h2>
        <p className="algo-note">{t.notThisNote}</p>
        <NotThis
          ar={ar}
          shops={shops}
          words={mutedWords}
          stalls={named}
          hint={t.notThisHint}
          onWord={muteWord}
          onRemoveWord={unmuteWord}
          onStall={muteStall}
          onRemoveStall={unmuteStall}
        />
        {mutedWords.length === 0 && named.length === 0 && <p className="algo-empty">{t.nothingMuted}</p>}
      </div>
    </section>
  );
}

function AlgoSort({
  ids,
  onReorder,
  render,
  label,
}: {
  ids: AlgoLever[];
  onReorder: (next: AlgoLever[]) => void;
  render: (id: AlgoLever, index: number) => ReactNode;
  label: string;
}) {
  const from = useRef<number | null>(null);
  const idsRef = useRef(ids);
  const onReorderRef = useRef(onReorder);
  const [drag, setDrag] = useState<{ id: AlgoLever; name: string; x: number; y: number; dx: number; dy: number; width: number } | null>(null);
  idsRef.current = ids;
  onReorderRef.current = onReorder;

  function reorderTo(to: number) {
    const start = from.current;
    const current = idsRef.current;
    if (start == null || start === to || to < 0 || to >= current.length) return;
    const next = current.slice();
    const [item] = next.splice(start, 1);
    next.splice(to, 0, item);
    from.current = to;
    onReorderRef.current(next);
  }

  function onPointerDown(id: AlgoLever, index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const row = event.currentTarget.closest("li");
    const rect = row?.getBoundingClientRect();
    const raw = row?.querySelector(".algo-name")?.textContent ?? "";
    from.current = index;
    setDrag({
      id,
      name: raw.replace(/^\d+\.\s*/, ""),
      x: event.clientX,
      y: event.clientY,
      dx: rect ? event.clientX - rect.left : 24,
      dy: rect ? event.clientY - rect.top : 20,
      width: rect?.width ?? 280,
    });
    const move = (ev: PointerEvent) => {
      setDrag((current) => (current ? { ...current, x: ev.clientX, y: ev.clientY } : current));
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-algo-index]");
      if (ev.clientY < 88) window.scrollBy(0, -18);
      if (ev.clientY > window.innerHeight - 88) window.scrollBy(0, 18);
      if (!el) return;
      reorderTo(Number((el as HTMLElement).dataset.algoIndex));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      from.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <>
      <ol className={drag ? "algo-order is-dragging" : "algo-order"}>
        {ids.map((id, index) => (
          <li key={id} data-algo-index={index} className={drag?.id === id ? "is-held" : undefined}>
            <div className="algo-row-main">{render(id, index)}</div>
            <button type="button" className="algo-grip" aria-label={label} onPointerDown={(event) => onPointerDown(id, index, event)}>
              ⋮⋮
            </button>
          </li>
        ))}
      </ol>
      {drag && (
        <div
          className="algo-ghost"
          style={{ width: drag.width, transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px)` }}
        >
          <span>{drag.name}</span>
          <span aria-hidden="true">⋮⋮</span>
        </div>
      )}
    </>
  );
}

function NotThis({
  ar,
  shops,
  words,
  stalls,
  hint,
  onWord,
  onRemoveWord,
  onStall,
  onRemoveStall,
}: {
  ar: boolean;
  shops: Shop[];
  words: string[];
  stalls: Shop[];
  hint: string;
  onWord: (word: string) => void;
  onRemoveWord: (word: string) => void;
  onStall: (slug: string) => void;
  onRemoveStall: (slug: string) => void;
}) {
  const [value, setValue] = useState("");
  const add = copy[useSession((s) => s.lang)].addWord;
  const query = value.trim();
  const at = query.startsWith("@") ? query.slice(1).trim() : "";
  const muted = new Set(stalls.map((shop) => shop.slug));
  const matches =
    at.length >= 1
      ? shops
          .filter((shop) => !muted.has(shop.slug))
          .filter((shop) => {
            const needle = at.toLowerCase();
            return [shop.name, shop.nameAr].some((name) =>
              name
                .toLowerCase()
                .split(/\s+/)
                .some((part) => part.startsWith(needle)) || name.toLowerCase().startsWith(needle),
            );
          })
          .slice(0, 8)
      : [];

  function pick(slug: string) {
    onStall(slug);
    setValue("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query) return;
    if (query.startsWith("@")) {
      if (matches[0]) pick(matches[0].slug);
      return;
    }
    onWord(query);
    setValue("");
  }

  return (
    <div className="algo-not">
      <div className="algo-chips">
        {words.map((word) => (
          <button key={word} type="button" onClick={() => onRemoveWord(word)}>
            {word} ×
          </button>
        ))}
        {stalls.map((shop) => (
          <button key={shop.slug} type="button" onClick={() => onRemoveStall(shop.slug)}>
            @{ar ? shop.nameAr : shop.name} ×
          </button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
        <div className="algo-suggest">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm"
            placeholder={hint}
          />
          {matches.length > 0 && (
            <ul>
              {matches.map((shop) => (
                <li key={shop.slug}>
                  <button type="button" onClick={() => pick(shop.slug)}>
                    @{ar ? shop.nameAr : shop.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">
          {add}
        </button>
      </form>
    </div>
  );
}

function WordList({
  kind,
  words,
  onAdd,
  onRemove,
  cap,
}: {
  kind: "interest" | "alert" | "mute";
  words: string[];
  onAdd?: (word: string) => void;
  onRemove?: (word: string) => void;
  cap?: number;
}) {
  const addWord = useSession((s) => s.addWord);
  const removeWord = useSession((s) => s.removeWord);
  const t = copy[useSession((s) => s.lang)];
  const full = cap != null && words.length >= cap;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (full) return;
    const word = String(new FormData(e.currentTarget).get("word") ?? "");
    if (kind === "mute") onAdd?.(word);
    else addWord(kind, word);
    e.currentTarget.reset();
  }

  return (
    <div>
      <div className="algo-chips">
        {words.map((word) => (
          <button key={word} type="button" onClick={() => (kind === "mute" ? onRemove?.(word) : removeWord(kind, word))}>
            {word} ×
          </button>
        ))}
      </div>
      {!full && (
        <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
          <input name="word" className="h-11 flex-1 rounded-md border border-line bg-white px-3 text-sm" placeholder="knafeh" required />
          <button type="submit" className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">
            {t.addWord}
          </button>
        </form>
      )}
    </div>
  );
}
