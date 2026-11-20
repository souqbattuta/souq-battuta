import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { buildSellerAlerts } from "@/lib/seller-alerts";
import { copy } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { SouqSync } from "@/components/souq-sync";
import { OptImg } from "@/components/opt-img";

export function SiteHeader({
  variant = "app",
}: {
  variant?: "app" | "landing";
}) {
  const lang = useSession((s) => s.lang);
  const user = useSession((s) => s.user);
  const t = copy[lang];
  const navigate = useNavigate();
  const signOut = useSession((s) => s.signOut);
  const setLang = useSession((s) => s.setLang);
  const listings = useSession((s) => s.listings);
  const accounts = useSession((s) => s.accounts);
  const waTaps = useSession((s) => s.waTaps);
  const reviewReplies = useSession((s) => s.reviewReplies);
  const sellerSeen = useSession((s) => s.sellerSeen);
  const sellerCleared = useSession((s) => s.sellerCleared);
  const markSellerSeen = useSession((s) => s.markSellerSeen);
  const clearSellerAlert = useSession((s) => s.clearSellerAlert);
  const sellerHistory = useSession((s) => s.sellerHistory);
  const buyerNotes = useSession((s) => s.notes);
  const markNoteRead = useSession((s) => s.markNoteRead);
  const [notesOpen, setNotesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const alerts =
    user?.role === "seller"
      ? buildSellerAlerts({
          role: "seller",
          shopSlug: user.shopSlug,
          plan: user.sellerPlan,
          lang,
          listings: listings ?? [],
          orders: Object.values(accounts).flatMap((account) => account.orders ?? []),
          taps: (waTaps ?? {})[user.shopSlug ?? ""] ?? 0,
          reviewReplies: reviewReplies ?? {},
          reviews: accounts[user.phone]?.stallReviews,
          cleared: sellerCleared ?? [],
        })
      : [];
  const unseen = alerts.filter((alert) => !(sellerSeen ?? []).includes(alert.id));
  const avatar =
    user?.role === "seller"
      ? "/brand/avatars/seller-duck.jpg?v=2"
      : user?.friendsOfBattuta
        ? "/brand/avatars/friends.jpg"
        : "/brand/avatars/buyer-duck.jpg?v=7";

  if (variant === "app") {
    return (
      <div className="site-banner-slot">
      <header className="site-banner">
        <div className="phone-slim">
          <Link to={user ? "/home" : "/"} className="phone-slim-brand" aria-label="Souq Battuta">
            <img src="/brand/duck-mark.png" alt="" />
            <span>
              <b>Souq Battuta</b>
              <i className="font-arabic">سوق بطوطة</i>
            </span>
          </Link>
          <div className="phone-slim-side">
            <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
              {lang === "ar" ? "English" : "العربية"}
            </button>
            {user ? (
              <Link to={user.role === "seller" ? "/seller" : "/account"} search={user.role === "seller" ? { item: "", tab: "analytics", order: "", note: "" } : { tab: "", note: "" }} aria-label={t.account}>
                <img src={avatar} alt="" />
              </Link>
            ) : (
              <Link to="/sign-in" search={{ next: "/home" }}>{lang === "ar" ? "دخول" : "Log in"}</Link>
            )}
          </div>
        </div>
        <div className="site-banner-frame">
          <OptImg className="site-banner-img banner-phone" src="/brand/banner-phone-header.png" alt="" eager />
          <OptImg className="site-banner-img banner-desk" src="/brand/banner-desktop.png" alt="" eager />
          <OptImg className="header-manuscript" src="/brand/header-manuscript.png" alt="" eager />
          <p className="header-quote" lang={lang === "ar" ? "ar" : "en"}>
            {lang === "ar" ? (
              <>
                <b>«عندما تقرر أن تبدأ المسير، سيظهر الطريق»</b>
                <span>جلال الدين الرومي</span>
              </>
            ) : (
              <>
                <b>“As you start to walk on the way, the way appears”</b>
                <span>Rumi</span>
              </>
            )}
          </p>
          <Link
            to={user ? "/home" : "/"}
            className="site-banner-logo"
            aria-label="سوق بطوطة Souq Battuta"
          />
        </div>
        <div className="site-banner-tools">
          <span />
          <form
            className="site-banner-search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              void navigate({ to: "/discover", search: { q: String(q ?? "") } });
            }}
          >
            <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <input
              name="q"
              dir={lang === "ar" ? "rtl" : "ltr"}
              placeholder={t.searchPlaceholder}
              className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-mute"
              aria-label={t.discover}
            />
          </form>
          {user ? (
            <div className="banner-account">
              <div className="banner-bell-wrap">
                <button
                  type="button"
                  className="banner-bell"
                  aria-expanded={notesOpen}
                  aria-label={lang === "ar" ? "التنبيهات" : "Notifications"}
                  onClick={() => {
                    setMenuOpen(false);
                    setNotesOpen((open) => !open);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {(user.role === "seller" ? unseen.length : buyerNotes.length) > 0 && (
                    <span className="banner-note">{user.role === "seller" ? unseen.length : buyerNotes.length}</span>
                  )}
                </button>
                {notesOpen && (
                  <div className="banner-notes" role="dialog">
                    <p className="banner-notes-title">{lang === "ar" ? "التنبيهات" : "Notifications"}</p>
                    {user.role === "seller" ? (
                      <>
                        {alerts.length === 0 && (sellerHistory ?? []).length === 0 && <p className="px-3 py-3 text-sm text-mute">{lang === "ar" ? "ما في تنبيهات." : "You're up to date."}</p>}
                        {alerts.map((alert) => (
                          <button
                            key={alert.id}
                            type="button"
                            className="banner-notes-row is-new"
                            onClick={() => {
                              markSellerSeen([alert.id]);
                              clearSellerAlert(alert.id, { title: alert.title, detail: alert.detail, kind: alert.kind });
                              setNotesOpen(false);
                              void navigate({
                                to: "/seller",
                                search: {
                                  tab: alert.tab,
                                  item: alert.listingId ?? "",
                                  order: alert.orderId ?? "",
                                  note: alert.id,
                                },
                              });
                            }}
                          >
                            <b>{alert.title}</b>
                          </button>
                        ))}
                        {(sellerHistory ?? []).filter((entry) => !/opened whatsapp|فتحوا واتساب/i.test(entry.detail)).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            className="banner-notes-row"
                            onClick={() => {
                              setNotesOpen(false);
                              void navigate({ to: "/seller", search: { tab: "notes", item: "", order: "", note: entry.id } });
                            }}
                          >
                            <b>{entry.title}</b>
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {buyerNotes.length === 0 && <p className="px-3 py-3 text-sm text-mute">{lang === "ar" ? "ما في تنبيهات." : "You're up to date."}</p>}
                        {buyerNotes.filter((note) => !note.id.startsWith("sent-") && note.title !== "You wrote to Souq Battuta").map((note) => (
                          <button
                            key={note.id}
                            type="button"
                            className={note.read ? "banner-notes-row" : "banner-notes-row is-new"}
                            onClick={() => {
                              setNotesOpen(false);
                              const fromSouq = note.id === "souq-welcome" || note.id.startsWith("sq-") || note.title === "Souq Battuta" || (note.title.includes("Souq Battuta") && !note.id.startsWith("promo-"));
                              if (fromSouq || !note.href?.startsWith("/shop/")) {
                                markNoteRead(note.id);
                                void navigate({ to: "/account", search: { tab: "inbox", note: note.id } });
                                return;
                              }
                              const slug = note.href.split("/")[2] ?? "";
                              const hash = note.id.startsWith("back-") ? `item-${note.id.slice(5)}` : note.id.startsWith("promo-") ? "shop-name" : "shop-name";
                              void navigate({ to: "/shop/$slug", params: { slug }, hash });
                            }}
                          >
                            <b>{note.title}</b>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className={menuOpen ? "banner-avatar-wrap is-open" : "banner-avatar-wrap"}>
                <button
                  type="button"
                  className="banner-avatar"
                  aria-label={t.account}
                  aria-expanded={menuOpen}
                  onClick={() => {
                    setNotesOpen(false);
                    setMenuOpen((open) => !open);
                  }}
                >
                  <OptImg src={avatar} alt="" eager sizes="54px" />
                </button>
              <div className="banner-menu" role="menu">
                {user.role === "seller" ? (
                  <Link to="/seller" search={{ item: "", tab: "orders", order: "", note: "" }} role="menuitem">
                    <span className="font-arabic">دكاني</span>
                    <span>My shop</span>
                  </Link>
                ) : (
                  <>
                    <Link to="/account" search={{ tab: "", note: "" }} role="menuitem">
                      <span className="font-arabic">الملف</span>
                      <span>Profile</span>
                    </Link>
                    <Link to="/account" search={{ tab: "inbox", note: "" }} role="menuitem">
                      <span className="font-arabic">الوارد</span>
                      <span>Inbox</span>
                    </Link>
                  </>
                )}
                <button type="button" role="menuitem" onClick={() => signOut()}>
                  <span className="font-arabic">خروج</span>
                  <span>Logout</span>
                </button>
              </div>
              </div>
            </div>
          ) : (
            <Link
              to="/sign-in"
              search={{ next: "/home" }}
              className="banner-signin"
              aria-label="تسجيل الدخول / Log in"
            >
              <OptImg className="banner-login-ticket" src="/brand/locked/login-stamp-navy.png" alt="" eager sizes="150px" />
              <span className="font-arabic">تسجيل الدخول</span>
              <span className="font-display">Log in</span>
            </Link>
          )}
        </div>
        <div className="banner-lang" role="group" aria-label="Language">
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            English
          </button>
          <span aria-hidden="true">/</span>
          <button type="button" className="font-arabic" aria-pressed={lang === "ar"} onClick={() => setLang("ar")}>
            العربية
          </button>
        </div>
      </header>
      </div>
    );
  }

  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 sm:px-6",
        "bg-paper",
      )}
    >
      <Link to={user ? "/home" : "/"} className="flex items-center gap-2 shrink-0">
        <OptImg
          src={variant === "app" ? "/brand/logo-white-tight.jpg" : "/brand/logo-duck.jpg"}
          alt="سوق بطوطة Souq Battuta"
          className={cn("object-contain", variant === "app" ? "h-14 sm:h-20" : "h-16")}
          eager
          sizes="160px"
        />
      </Link>

      <form
        className="order-last flex w-full min-w-0 flex-1 items-center rounded-md border border-line bg-cream px-3 sm:order-none sm:max-w-md sm:ms-auto"
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q");
          void navigate({ to: "/discover", search: { q: String(q ?? "") } });
        }}
      >
        <input
          name="q"
          placeholder={t.searchPlaceholder}
          className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-mute"
          aria-label={t.discover}
        />
      </form>

      {user?.role === "seller" ? (
        <Link to="/seller" search={{ item: "", tab: "analytics", order: "", note: "" }} className="shrink-0" aria-label={t.account}>
          <OptImg src={avatar} alt="" className="size-11 rounded-full border-2 border-cream object-cover bg-sand" eager sizes="88px" />
        </Link>
      ) : user ? (
        <Link to="/account" search={{ tab: "", note: "" }} className="shrink-0" aria-label={t.account}>
          <OptImg
            src={avatar}
            alt=""
            className="size-11 rounded-full border-2 border-cream object-cover bg-sand"
            eager
            sizes="88px"
          />
        </Link>
      ) : (
        <Link
          to="/sign-in"
          search={{ next: "/home" }}
          className="rounded-md border border-ink px-3 py-2 text-xs font-semibold text-ink"
        >
          {t.signIn}
        </Link>
      )}
    </header>
  );
}

export function SiteFooter() {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const t = copy[lang];
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <p className="site-footer-mark">
          <span className="font-arabic">سوق بطوطة</span>
          <span>Souq Battuta</span>
        </p>
      </div>
      <nav className="site-footer-cols" aria-label={ar ? "تذييل" : "Footer"}>
        <div>
          <p>{ar ? "تجول" : "Explore"}</p>
          <Link to="/home">{ar ? "الرئيسية" : "Home"}</Link>
          <Link to="/category/$id" params={{ id: "all" }}>{ar ? "الأقسام" : "Categories"}</Link>
        </div>
        <div>
          <p>{ar ? "للبائعين" : "For Sellers"}</p>
          <Link to="/sell">{t.sell}</Link>
          <Link to="/advertise">{ar ? "أعلن على سوق بطوطة" : "Advertise"}</Link>
        </div>
        <div>
          <p>{ar ? "السوق" : "The Souq"}</p>
          <Link to="/privacy">{t.privacy}</Link>
          <Link to="/rules">{ar ? "القواعد" : "Rules"}</Link>
          <Link to="/contact">{ar ? "تواصل" : "Contact"}</Link>
          <Link to="/desk">{ar ? "مكتب السوق" : "Souq Desk"}</Link>
          {!import.meta.env.PROD && (
            <Link to="/checklist">{ar ? "قائمة التجربة" : "Test List"}</Link>
          )}
        </div>
      </nav>
      <p className="site-footer-copy">© Souq Battuta · {t.cityName}</p>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const lang = useSession((s) => s.lang);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const showBack = path !== "/" && path !== "/home";
  const sellerDesk = path === "/seller" || path.startsWith("/seller/");
  const shopPage = path.startsWith("/shop/");
  return (
    <div className={cn("site-shell flex flex-col", shopPage && "is-shop", lang === "ar" ? "dir-rtl" : "dir-ltr")}>
      <SiteHeader />
      <SouqSync />
      {showBack && <PageBack lang={lang} />}
      {children}
      <SiteFooter />
      {!sellerDesk && <BuyerTabs lang={lang} path={path} />}
    </div>
  );
}

function HelloMotif({ active }: { active: boolean }) {
  return <img src={active ? "/brand/hello-motif-a-active.svg" : "/brand/hello-motif-a-inactive.svg"} alt="" width={24} height={24} />;
}

function BuyerTabs({ lang, path }: { lang: "en" | "ar"; path: string }) {
  const ar = lang === "ar";
  const search = useRouterState({ select: (state) => state.location.search }) as { tab?: string };
  const onSaved = path === "/account" && search?.tab === "saved";
  const onAccount = path === "/account" && !onSaved;
  return (
    <nav className="buyer-tabs" aria-label={ar ? "التصفح" : "Browse"}>
      <Link to="/home" aria-current={path === "/home" ? "page" : undefined}>
        <TabIcon kind="home" />
        <span>{ar ? "الرئيسية" : "Home"}</span>
      </Link>
      <Link to="/discover" search={{ q: "" }} aria-current={path.startsWith("/discover") ? "page" : undefined}>
        <TabIcon kind="search" />
        <span>{ar ? "بحث" : "Search"}</span>
      </Link>
      <Link to="/hello" search={{ tab: "for-you", at: "", post: "" }} className="buyer-tab-hello" aria-current={path.startsWith("/hello") ? "page" : undefined}>
        <HelloMotif active={path.startsWith("/hello")} />
        <span>Hello World</span>
      </Link>
      <Link to="/account" search={{ tab: "saved", note: "" }} aria-current={onSaved ? "page" : undefined}>
        <TabIcon kind="saved" />
        <span>{ar ? "المحفوظ" : "Saved"}</span>
      </Link>
      <Link to="/account" search={{ tab: "", note: "" }} aria-current={onAccount ? "page" : undefined}>
        <TabIcon kind="account" />
        <span>{ar ? "حسابي" : "Account"}</span>
      </Link>
    </nav>
  );
}

function TabIcon({ kind }: { kind: "home" | "search" | "saved" | "account" }) {
  if (kind === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "search") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "saved") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19.5c1.4-3 3.6-4.5 6.5-4.5s5.1 1.5 6.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PageBack({ lang }: { lang: "en" | "ar" }) {
  const navigate = useNavigate();
  return (
    <div className="page-back px-4 pt-3 sm:px-6">
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-cream"
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else void navigate({ to: "/home" });
        }}
      >
        {lang === "ar" ? "رجوع" : "Back"}
      </button>
    </div>
  );
}
