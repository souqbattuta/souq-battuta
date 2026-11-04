import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PLANS, type ItemChoice, type PlanId } from "@/lib/data";
import { billingPhase, slugForSeller, socialVerifyCode, stallNameTaken, useSession, type BuyerOrder, type MailThread, type OptionSet, type SocialNetwork, type StallSocial } from "@/lib/session";
import { CAMPAIGN_STEPS, campaignStanding, countCodeUses } from "@/lib/seller-campaign";
import { buildSellerAlerts } from "@/lib/seller-alerts";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";
import { PlanStamp } from "@/components/plan-stamp";
import { PhotoStudio, SquareCrop } from "@/components/photo-frame";
import { HelloComposer } from "@/components/hello-board";
import { OptImg } from "@/components/opt-img";
import { PaymentDialog, type PaymentChoice } from "@/components/payment-dialog";
import { submitSouqPayment } from "@/lib/souq-sync";

type DeskTab = "edit" | "analytics" | "orders" | "inbox" | "reviews" | "notes" | "promos" | "hello";
type DraftOption = { en: string; ar: string; extra: string; off: boolean; reason: "" | "unavailable" | "stock" | "sold"; back: string };
type DraftChoice = { en: string; ar: string; options: DraftOption[] };

const TEXT_CAP: Record<PlanId, number> = { premium: 400, grow: 280, basic: 180, free: 100 };

function asDeskTab(value: unknown): DeskTab {
  if (value === "edit" || value === "products" || value === "profile") return "edit";
  if (value === "orders" || value === "desk") return "orders";
  if (value === "inbox" || value === "reviews" || value === "notes" || value === "promos" || value === "hello") return value;
  return "analytics";
}

export const Route = createFileRoute("/seller")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: asDeskTab(s.tab),
    item: typeof s.item === "string" ? s.item : "",
    order: typeof s.order === "string" ? s.order : "",
    note: typeof s.note === "string" ? s.note : "",
  }),
  component: SellerDesk,
});

function SellerDesk() {
  const { tab: tabFromUrl, item, order: orderFromUrl, note: noteFromUrl } = Route.useSearch();
  const navigate = useNavigate();
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const accounts = useSession((s) => s.accounts);
  const listings = useSession((s) => s.listings);
  const addListing = useSession((s) => s.addListing);
  const updateListing = useSession((s) => s.updateListing);
  const removeListing = useSession((s) => s.removeListing);
  const toggleListing = useSession((s) => s.toggleListing);
  const hideListing = useSession((s) => s.hideListing);
  const showListing = useSession((s) => s.showListing);
  const addPromotion = useSession((s) => s.addPromotion);
  const setStall = useSession((s) => s.setStall);
  const setSellerContact = useSession((s) => s.setSellerContact);
  const completeDeskOrder = useSession((s) => s.completeDeskOrder);
  const replyToReview = useSession((s) => s.replyToReview);
  const reviewReplies = useSession((s) => s.reviewReplies);
  const sellerCleared = useSession((s) => s.sellerCleared);
  const sellerHistory = useSession((s) => s.sellerHistory) ?? [];
  const clearSellerAlert = useSession((s) => s.clearSellerAlert);
  const markSellerSeen = useSession((s) => s.markSellerSeen);
  const waTaps = useSession((s) => s.waTaps);
  const mail = useSession((s) => s.mail);
  const openSellerMessage = useSession((s) => s.openSellerMessage);
  const replySellerMessage = useSession((s) => s.replySellerMessage);
  const deleteSellerThread = useSession((s) => s.deleteSellerThread);
  const deleteSellerLine = useSession((s) => s.deleteSellerLine);
  const ensureHalaDemo = useSession((s) => s.ensureHalaDemo);
  const ensureSouqInbox = useSession((s) => s.ensureSouqInbox);
  const notePayment = useSession((s) => s.notePayment);
  const [payOpen, setPayOpen] = useState(false);
  const [editPane, setEditPane] = useState<"about" | "photo" | "hours" | "products" | "algorithm" | "socials">(item ? "products" : "about");
  const [editingId, setEditingId] = useState(item);
  const [mainPhoto, setMainPhoto] = useState<string | null>(null);
  const [subPhotos, setSubPhotos] = useState<(string | null)[]>([null, null, null, null, null]);
  const [priceMode, setPriceMode] = useState<"price" | "na" | "inquire">("price");
  const [nameDraft, setNameDraft] = useState("");
  const [nameArDraft, setNameArDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [descArDraft, setDescArDraft] = useState("");
  const [groupDraft, setGroupDraft] = useState("");
  const [groupArDraft, setGroupArDraft] = useState("");
  const [priceDraft, setPriceDraft] = useState("");
  const [choices, setChoices] = useState<DraftChoice[]>([]);
  const [chart, setChart] = useState<string | null>(null);
  const [listError, setListError] = useState("");
  const [listOk, setListOk] = useState(false);
  const [hideFor, setHideFor] = useState("");
  const [hideReason, setHideReason] = useState<"unavailable" | "stock" | "sold">("unavailable");
  const [hideBack, setHideBack] = useState<"" | "soon" | "date">("");
  const [hideDate, setHideDate] = useState("");
  const [contactError, setContactError] = useState("");
  const [stallName, setStallName] = useState(user?.displayName || "");
  const [aboutEn, setAboutEn] = useState("");
  const [aboutAr, setAboutAr] = useState("");
  const [aboutReady, setAboutReady] = useState(false);
  const [noteKind, setNoteKind] = useState<"reviews" | "orders" | "views">("orders");
  const ar = lang === "ar";

  useEffect(() => {
    if (!user || user.role !== "seller") return;
    ensureHalaDemo();
    ensureSouqInbox();
  }, [ensureHalaDemo, ensureSouqInbox, user]);

  useEffect(() => {
    if (!user || aboutReady) return;
    setStallName(user.displayName || "");
    setAboutEn(accounts[user.phone]?.stallBio || "");
    setAboutAr(accounts[user.phone]?.stallBioAr || "");
    setAboutReady(true);
  }, [aboutReady, accounts, user]);

  useEffect(() => {
    if (!noteFromUrl) return;
    const entry = (sellerHistory ?? []).find((item) => item.id === noteFromUrl);
    if (entry?.kind === "reviews" || entry?.kind === "orders" || entry?.kind === "views") setNoteKind(entry.kind);
  }, [noteFromUrl, sellerHistory]);

  const tabClick = useRef(false);

  useEffect(() => {
    if (tabClick.current) {
      tabClick.current = false;
      return;
    }
    const target = orderFromUrl
      ? `desk-order-${orderFromUrl}`
      : item
        ? "desk-editor"
        : noteFromUrl.startsWith("review:")
          ? `desk-review-${noteFromUrl.split(":").pop()}`
          : noteFromUrl.startsWith("views:")
            ? "desk-analytics"
            : noteFromUrl.startsWith("membership:") || noteFromUrl.startsWith("limit:")
              ? "desk-notes"
              : noteFromUrl
                ? `desk-note-${noteFromUrl}`
                : "";
    if (!target) return;
    const timer = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: "center" }), 140);
    return () => window.clearTimeout(timer);
  }, [tabFromUrl, item, orderFromUrl, noteFromUrl, noteKind]);

  if (!user || user.role !== "seller") {
    return (
      <Shell>
        <main className="px-6 py-16">
          <h1 className="font-display text-2xl">{t.sellerDesk}</h1>
          <p className="mt-2 max-w-md text-sm text-mute">{t.sellerLoginNote}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/sign-in" search={{ next: "/seller", role: "seller" }} className="inline-flex h-12 items-center rounded-md bg-ink px-5 text-cream">
              {t.signIn}
            </Link>
            <Link to="/join/seller" className="inline-flex h-12 items-center rounded-md border border-line px-5">
              {t.createAccount}
            </Link>
          </div>
        </main>
      </Shell>
    );
  }

  const tab = tabFromUrl;
  const planId = user.sellerPlan ?? "free";
  const plan = PLANS[planId];
  const subCount = planId === "grow" || planId === "premium" ? 5 : planId === "free" ? 3 : plan.images - 1;
  const profileSlug = user.shopSlug || slugForSeller(user);
  const account = accounts[user.phone];
  const grow = planId === "grow" || planId === "premium";

  function chooseTab(next: DeskTab) {
    if (next === tab) return;
    tabClick.current = true;
    const y = window.scrollY;
    void navigate({
      to: "/seller",
      search: { tab: next, item: next === "edit" ? editingId : "", order: next === "orders" ? orderFromUrl : "", note: next === "notes" ? noteFromUrl : "" },
      resetScroll: false,
    });
    requestAnimationFrame(() => window.scrollTo(0, y));
    window.setTimeout(() => window.scrollTo(0, y), 80);
  }

  function openProduct(id: string) {
    const found = (listings ?? []).find((entry) => entry.id === id);
    setEditPane("products");
    setEditingId(id);
    if (found) {
      setMainPhoto(found.images[0] ?? null);
      setSubPhotos([found.images[1] ?? null, found.images[2] ?? null, found.images[3] ?? null, found.images[4] ?? null, found.images[5] ?? null]);
      setPriceMode(found.priceMode ?? "price");
      setNameDraft(found.name);
      setNameArDraft(found.nameAr === found.name ? "" : found.nameAr);
      setDescDraft(found.desc);
      setDescArDraft(found.descAr && found.descAr !== found.desc ? found.descAr : "");
      setGroupDraft(found.group || "");
      setGroupArDraft(found.groupAr || "");
      setPriceDraft(found.price ? String(found.price) : "");
      setChoices(
        (found.choices ?? []).map((choice) => ({
          en: choice.en,
          ar: choice.ar,
          options: choice.options.map((option) => ({
            en: option.en,
            ar: option.ar,
            extra: option.extra ? String(option.extra) : "",
            off: Boolean(option.off),
            reason: option.reason ?? "",
            back: option.back ?? "",
          })),
        })),
      );
      setChart(found.chart ?? null);
    }
    void navigate({ to: "/seller", search: { tab: "edit", item: id, order: "", note: "" } });
  }

  function onListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cap = TEXT_CAP[planId];
    if (descDraft.length > cap || descArDraft.length > cap) {
      setListOk(false);
      setListError(ar ? `الوصف حدّه ${cap} حرف.` : `Description limit is ${cap} characters.`);
      return;
    }
    const images = [mainPhoto, ...subPhotos.slice(0, subCount)].filter((src): src is string => Boolean(src));
    const payload = {
      name: nameDraft,
      nameAr: nameArDraft,
      price: priceMode === "price" ? Number(priceDraft || 0) : 0,
      priceMode,
      desc: descDraft,
      descAr: descArDraft,
      group: groupDraft,
      groupAr: groupArDraft,
      images,
      choices: planId === "premium" ? toChoices(choices) : undefined,
      chart: planId === "premium" ? chart || undefined : undefined,
    };
    const res = editingId ? updateListing(editingId, payload) : addListing(payload);
    if (!res.ok) {
      setListOk(false);
      setListError("error" in res && res.error === "limit" ? (ar ? `هذه الخطة تسمح بـ ${plan.listings} منتجات.` : `This plan allows ${plan.listings} listings.`) : ar ? "الاسم لازم يكون حرفين على الأقل." : "Add a name of at least 2 letters.");
      return;
    }
    setListError("");
    setListOk(true);
    setEditingId("");
    setMainPhoto(null);
    setSubPhotos([null, null, null, null, null]);
    setChoices([]);
    setChart(null);
    setNameDraft("");
    setNameArDraft("");
    setDescDraft("");
    setDescArDraft("");
    setGroupDraft("");
    setGroupArDraft("");
    setPriceDraft("");
    setPriceMode("price");
  }

  const mine = (listings ?? []).filter((entry) => entry.shopSlug === profileSlug);
  const inquiries = Object.values(accounts)
    .flatMap((entry) => entry.orders ?? [])
    .filter((order) => order.shopSlug === profileSlug)
    .sort((a, b) => b.at - a.at);
  const alerts = buildSellerAlerts({
    role: user.role,
    shopSlug: profileSlug,
    plan: planId,
    lang,
    listings: listings ?? [],
    orders: Object.values(accounts).flatMap((entry) => entry.orders ?? []),
    taps: (waTaps ?? {})[profileSlug] ?? 0,
    reviewReplies: reviewReplies ?? {},
    reviews: account?.stallReviews,
    cleared: sellerCleared ?? [],
    views: account?.stallViews ?? 0,
    daysLeft: membershipDays(user.planEnds ?? account?.planEnds),
  });
  const threads = (mail ?? []).filter((thread) => thread.phones.includes(user.phone));
  const stallReviews = account?.stallReviews ?? [];
  const month = new Date().toISOString().slice(0, 7);
  const promotions = account?.promotions ?? [];
  const usedPromos = promotions.filter((promo) => new Date(promo.at).toISOString().slice(0, 7) === month).length;
  const workTabs: { id: DeskTab; en: string; ar: string; mark?: number }[] = [
    { id: "hello", en: "Hello, World!", ar: "Hello, World!" },
    { id: "analytics", en: "Analytics", ar: "التحليلات" },
    { id: "orders", en: "Orders", ar: "الطلبات", mark: inquiries.filter((order) => order.status !== "done").length },
    { id: "inbox", en: "Inbox", ar: "الوارد" },
    { id: "reviews", en: "Reviews", ar: "التقييمات" },
    { id: "notes", en: "Notifications", ar: "التنبيهات", mark: alerts.length },
    ...(planId === "grow" || planId === "premium" ? [{ id: "promos" as const, en: "Announcements", ar: "الإعلانات" }] : []),
  ];

  return (
    <Shell>
      <main className="seller-desk px-4 py-6 sm:px-8">
        <div className="flex gap-2" role="tablist">
          <button type="button" role="tab" className={`h-11 rounded-lg px-4 text-sm font-semibold ${tab === "edit" ? "bg-ink text-cream" : "bg-sand"}`} onClick={() => chooseTab("edit")}>
            {ar ? "تعديل الصفحة" : "Edit page"}
          </button>
          <button type="button" role="tab" className={`h-11 rounded-lg px-4 text-sm font-semibold ${tab !== "edit" ? "bg-ink text-cream" : "bg-sand"}`} onClick={() => chooseTab(tab === "edit" ? "analytics" : tab)}>
            {ar ? "مكتب العمل" : "Workstation"}
          </button>
        </div>
        <section className="mt-4 rounded-xl border border-line bg-cream p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-mute">Ya Halla, {user.username}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl">{user.displayName || user.username}</h1>
                <PlanStamp plan={planId} />
              </div>
              <p className="mt-1 text-sm text-ink">
                {ar ? plan.nameAr : plan.name}
                {" · "}
                {membershipLine(user.planEnds ?? account?.planEnds, ar)}
              </p>
              <BillingBanner ar={ar} planId={planId} phase={billingPhase(account ?? user)} ends={user.planEnds ?? account?.planEnds} pending={user.pendingPlan || account?.pendingPlan} />
              {(planId === "grow" || planId === "premium") && (
                <p className="mt-1 text-sm text-ink">
                  {ar ? "المتابعون" : "Followers"}
                  {" · "}
                  {Object.values(accounts).filter((item) => item.role !== "seller" && (item.follows ?? []).includes(profileSlug)).length}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {planId !== "premium" && (
                <Link to="/sell" className="inline-flex h-11 items-center rounded-md bg-ink px-4 text-sm font-semibold text-cream">
                  {ar ? "رقّي الخطة" : "Upgrade plan"}
                </Link>
              )}
              <button type="button" className="inline-flex h-11 items-center rounded-md border border-ink px-4 text-sm font-semibold" onClick={() => (planId === "free" ? void navigate({ to: "/sell" }) : setPayOpen(true))}>
                {ar ? "جدّد الآن" : "Renew now"}
              </button>
              <Link to="/shop/$slug" params={{ slug: profileSlug }} className="inline-flex h-11 items-center rounded-md border border-line px-4 text-sm font-semibold">
                {ar ? "شوف الملف" : "View profile"}
              </Link>
            </div>
          </div>
          <UpgradeCode ar={ar} />
        </section>
        {payOpen && planId !== "free" && (
          <PaymentDialog
            ar={ar}
            plan={planId}
            amount={PLANS[planId].price}
            onClose={() => setPayOpen(false)}
            onFree={() => setPayOpen(false)}
            onPaid={(choice: PaymentChoice) => {
              setPayOpen(false);
              void submitSouqPayment({ data: { plan: choice.plan, billingPeriod: choice.period, paymentMethod: choice.method, paymentRef: choice.ref } }).then((res) => {
                if (res.ok) notePayment({ pendingPlan: choice.plan, paymentStatus: "pending", paymentMethod: choice.method, paymentRef: choice.ref, billingPeriod: choice.period });
              });
            }}
          />
        )}

        {tab !== "edit" && (
          <>
            <div className="mt-4">
              <StallShare slug={profileSlug} planId={planId} ar={ar} />
            </div>
            <div className="desk-tabs mt-3 flex gap-1 overflow-x-auto rounded-xl bg-sand p-1" role="tablist">
            {workTabs.map((entry) => (
              <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id} className={`h-11 shrink-0 rounded-lg px-4 text-sm font-semibold ${tab === entry.id ? "bg-ink text-cream" : ""}`} onClick={() => chooseTab(entry.id)}>
                {ar ? entry.ar : entry.en}
                {!!entry.mark && <span className="ms-2 inline-flex min-w-5 justify-center rounded-full bg-cream px-1 text-xs text-ink">{entry.mark}</span>}
              </button>
            ))}
            </div>
          </>
        )}

        {tab === "edit" && (
          <section className="mt-4">
            <div className="desk-tabs flex gap-1 overflow-x-auto rounded-xl bg-sand p-1" role="tablist">
              {(
                [
                  ["about", "About", "عن الدكان"],
                  ["photo", "Profile picture", "صورة الملف"],
                  ["hours", "Hours", "الساعات"],
                  ["socials", "Social media", "التواصل"],
                  ["algorithm", "Algorithm", "الخوارزمية"],
                  ["products", "Products", "المنتجات"],
                ] as const
              ).map(([id, en, arabic]) => (
                <button key={id} type="button" role="tab" aria-selected={editPane === id} className={`h-10 shrink-0 rounded-lg px-4 text-sm font-semibold ${editPane === id ? "bg-ink text-cream" : ""}`} onClick={() => setEditPane(id)}>
                  {ar ? arabic : en}
                </button>
              ))}
            </div>
            {editPane === "about" && (
              <form
                className="mt-4 grid max-w-xl gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const cap = TEXT_CAP[planId];
                  const name = stallName.trim();
                  if (name.length < 2) {
                    setContactError(ar ? "اسم الدكان قصير." : "Stall name is too short.");
                    return;
                  }
                  if (stallNameTaken(name, accounts, user.phone)) {
                    setContactError(ar ? "اسم الدكان مأخوذ." : "That stall name is taken.");
                    return;
                  }
                  if (aboutEn.length > cap || aboutAr.length > cap) {
                    setContactError(ar ? `النبذة حدها ${cap} حرف.` : `About is limited to ${cap} characters.`);
                    return;
                  }
                  const fd = new FormData(event.currentTarget);
                  const res = setSellerContact({ displayName: name, whatsapp: String(fd.get("whatsapp") ?? "") });
                  setStall({ stallBio: aboutEn, stallBioAr: aboutAr });
                  setContactError(res.ok ? "" : ar ? "تحقق من الرقم." : "Check the WhatsApp number.");
                }}
              >
                <label className="text-sm">
                  {ar ? "اسم الدكان" : "Stall name"}
                  <input value={stallName} onChange={(event) => setStallName(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" />
                  <span className={`mt-1 block text-xs ${stallName.trim().length >= 2 && stallNameTaken(stallName, accounts, user.phone) ? "text-red" : "text-mute"}`}>
                    {stallName.trim().length < 2
                      ? ar ? "حرفان على الأقل." : "At least 2 characters."
                      : stallNameTaken(stallName, accounts, user.phone)
                        ? ar ? "مأخوذ." : "Taken."
                        : ar ? "متاح." : "Available."}
                  </span>
                </label>
                <label className="text-sm">{ar ? "واتساب" : "WhatsApp"}<input name="whatsapp" defaultValue={user.whatsappPhone || user.phone} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
                <label className="text-sm">
                  {ar ? "نبذة" : "About"}
                  <textarea value={aboutEn} maxLength={TEXT_CAP[planId]} onChange={(event) => setAboutEn(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-line px-3 py-2" />
                  <span className="mt-1 block text-xs text-mute">{aboutEn.length} / {TEXT_CAP[planId]}</span>
                </label>
                <label className="text-sm">
                  {ar ? "نبذة بالعربي" : "About in Arabic"}
                  <textarea value={aboutAr} maxLength={TEXT_CAP[planId]} onChange={(event) => setAboutAr(event.target.value)} rows={3} dir="rtl" className="mt-1 w-full rounded-md border border-line px-3 py-2" />
                  <span className="mt-1 block text-xs text-mute">{aboutAr.length} / {TEXT_CAP[planId]}</span>
                </label>
                {contactError && <p className="text-sm text-red">{contactError}</p>}
                <button type="submit" className="h-11 rounded-md bg-ink font-semibold text-cream">{ar ? "حفظ" : "Save"}</button>
              </form>
            )}
            {editPane === "photo" && plan.photo && (
              <div className="mt-4 grid gap-6">
                <PhotoStudio label={ar ? "صورة الغلاف" : "Header"} shape="header" src={account?.stallCover || ""} frameId={`cover:${profileSlug}`} onSrc={(src) => setStall({ stallCover: src })} />
                <PhotoStudio label={ar ? "صورة الدكان" : "Profile photo"} shape="avatar" src={account?.stallAvatar || ""} frameId={`avatar:${profileSlug}`} onSrc={(src) => setStall({ stallAvatar: src })} />
              </div>
            )}
            {editPane === "photo" && !plan.photo && <p className="mt-4 text-sm text-mute">{ar ? "صورة الملف تفتح من الأساسي." : "A profile photo opens on Basic."}</p>}
            {editPane === "socials" && (
              <SocialsBoard
                ar={ar}
                open={plan.socials}
                code={socialVerifyCode(user.phone)}
                items={account?.stallSocials ?? []}
                onChange={(stallSocials) => setStall({ stallSocials })}
              />
            )}
            {editPane === "algorithm" && (
              <AlgorithmBoard
                ar={ar}
                cap={PLANS[planId].keywords}
                words={account?.findWords ?? []}
                onChange={(findWords) => setStall({ findWords })}
              />
            )}
            {editPane === "hours" && (
              <form
                className="mt-4 grid max-w-xl gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const fd = new FormData(event.currentTarget);
                  const force = String(fd.get("force") ?? "auto");
                  setStall({
                    stallForce: force === "open" || force === "closed" ? force : "auto",
                    stallOpens: String(fd.get("opens") ?? ""),
                    stallCloses: String(fd.get("closes") ?? ""),
                    contactWhenClosed: fd.get("contact") === "on",
                    openNote: String(fd.get("openNote") ?? ""),
                    openNoteAr: String(fd.get("openNoteAr") ?? ""),
                    closedNote: String(fd.get("closedNote") ?? ""),
                    closedNoteAr: String(fd.get("closedNoteAr") ?? ""),
                  });
                }}
              >
                <label className="text-sm">{ar ? "الحالة" : "Status"}
                  <select name="force" defaultValue={account?.stallForce || "auto"} className="mt-1 h-11 w-full rounded-md border border-line px-3">
                    <option value="auto">{ar ? "حسب الساعات" : "Use hours"}</option>
                    <option value="open">{ar ? "مفتوح" : "Open"}</option>
                    <option value="closed">{ar ? "مغلق" : "Closed"}</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">{ar ? "من" : "Opens"}<input type="time" name="opens" defaultValue={account?.stallOpens || ""} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
                  <label className="text-sm">{ar ? "إلى" : "Closes"}<input type="time" name="closes" defaultValue={account?.stallCloses || ""} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="contact" defaultChecked={account?.contactWhenClosed !== false} />
                  {ar ? "يستقبل رسائل وهو مغلق" : "Accept messages when closed"}
                </label>
                <label className="text-sm">{ar ? "ملاحظة والمفتوح" : "Note when open"}<input name="openNote" defaultValue={account?.openNote || ""} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
                <label className="text-sm">{ar ? "ملاحظة والمفتوح بالعربي" : "Open note in Arabic"}<input name="openNoteAr" defaultValue={account?.openNoteAr || ""} dir="rtl" className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
                <label className="text-sm">{ar ? "ملاحظة وهو مغلق" : "Note when closed"}<input name="closedNote" defaultValue={account?.closedNote || ""} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
                <label className="text-sm">{ar ? "ملاحظة الإغلاق بالعربي" : "Closed note in Arabic"}<input name="closedNoteAr" defaultValue={account?.closedNoteAr || ""} dir="rtl" className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
                <button type="submit" className="h-11 rounded-md bg-ink font-semibold text-cream">{ar ? "حفظ الساعات" : "Save hours"}</button>
              </form>
            )}
            {editPane === "products" && (
              <div className="mt-4" id="desk-editor">
                <form className="grid gap-4 rounded-xl border border-line bg-cream p-4 sm:grid-cols-2" onSubmit={onListing}>
                  <label className="text-sm">
                    Name
                    <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-white px-3" required />
                  </label>
                  <label className="text-sm">
                    اسم
                    <input value={nameArDraft} onChange={(event) => setNameArDraft(event.target.value)} dir="rtl" className="mt-1 h-11 w-full rounded-md border border-line bg-white px-3" />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    {([ ["price", "Price"], ["na", "Price N/A"], ["inquire", "Inquire"] ] as const).map(([id, label]) => (
                      <button key={id} type="button" className={`h-10 rounded-md border px-3 text-sm ${priceMode === id ? "border-ink bg-ink text-cream" : "border-line bg-white"}`} onClick={() => setPriceMode(id)}>{label}</button>
                    ))}
                  </div>
                  {priceMode === "price" && (
                    <label className="text-sm sm:col-span-2">{ar ? "السعر" : "Price"}<input value={priceDraft} onChange={(event) => setPriceDraft(event.target.value)} inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-line bg-white px-3" /></label>
                  )}
                  <SectionFields
                    ar={ar}
                    group={groupDraft}
                    groupAr={groupArDraft}
                    setGroup={setGroupDraft}
                    setGroupAr={setGroupArDraft}
                  />
                  {planId === "premium" && (
                    <ChoiceFields
                      lang={lang}
                      choices={choices}
                      setChoices={setChoices}
                      chart={chart}
                      setChart={setChart}
                      sets={account?.optionSets ?? []}
                      onSaveSet={(next) => {
                        const prev = account?.optionSets ?? [];
                        const optionSets = prev.some((item) => item.id === next.id) ? prev.map((item) => (item.id === next.id ? next : item)) : [...prev, next];
                        setStall({ optionSets });
                      }}
                    />
                  )}
                  <div className="sm:col-span-2">
                    <SquareCrop label={ar ? "الصورة الرئيسية" : "Main photo"} src={mainPhoto} onPick={setMainPhoto} large />
                    <div className="mt-3 flex flex-wrap gap-3">
                      {Array.from({ length: subCount }, (_, index) => (
                        <SquareCrop
                          key={index}
                          label={ar ? `صورة ${index + 1}` : `Photo ${index + 1}`}
                          src={subPhotos[index] ?? null}
                          onPick={(url) => setSubPhotos((current) => {
                            const next = [...current];
                            while (next.length <= index) next.push(null);
                            next[index] = url;
                            return next;
                          })}
                        />
                      ))}
                    </div>
                  </div>
                  <label className="text-sm sm:col-span-2">
                    Description
                    <textarea value={descDraft} maxLength={TEXT_CAP[planId]} onChange={(event) => setDescDraft(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
                    <span className="mt-1 block text-xs text-mute">{descDraft.length} / {TEXT_CAP[planId]}</span>
                    <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (descDraft.trim()) void translateText(descDraft, "en").then((text) => text && setDescArDraft(text)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
                  </label>
                  <label className="text-sm sm:col-span-2">
                    الوصف
                    <textarea value={descArDraft} maxLength={TEXT_CAP[planId]} onChange={(event) => setDescArDraft(event.target.value)} rows={3} dir="rtl" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
                    <span className="mt-1 block text-xs text-mute">{descArDraft.length} / {TEXT_CAP[planId]}</span>
                    <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (descArDraft.trim()) void translateText(descArDraft, "ar").then((text) => text && setDescDraft(text)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
                  </label>
                  <div className="sm:col-span-2">
                    <button type="submit" className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">{editingId ? (ar ? "حفظ المنتج" : "Save product") : ar ? "أضف المنتج" : "Add product"}</button>
                    {listError && <p className="mt-2 text-sm text-red">{listError}</p>}
                    {listOk && <p className="mt-2 text-sm text-stamp-green">{ar ? "انحفظ." : "Saved."}</p>}
                  </div>
                </form>
                <ul className="mt-4 divide-y divide-line">
                  {orderedListings(mine).map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                      <OptImg src={item.images[0]} alt="" className="h-12 w-12 rounded-md object-cover" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{item.name}</b>
                        <span className="text-sm text-mute">
                          {item.hidden ? (ar ? "مخفي" : "Hidden") : ar ? "ظاهر" : "Live"}
                          {item.hidden && item.hideReason ? ` · ${hideCopy(item.hideReason, lang)}` : ""}
                          {item.hidden && item.hideBack ? ` · ${item.hideBack === "soon" ? (ar ? "يرجع قريب" : "Back soon") : item.hideBack}` : ""}
                        </span>
                      </span>
                      <button type="button" className="h-10 rounded-md bg-ink px-3 text-sm font-semibold text-cream" onClick={() => openProduct(item.id)}>{ar ? "تعديل" : "Edit"}</button>
                      <button
                        type="button"
                        className="h-10 rounded-md border border-line px-3 text-sm"
                        onClick={() => {
                          if (item.hidden) {
                            showListing(item.id);
                            return;
                          }
                          if (planId === "premium") {
                            setHideFor(item.id);
                            setHideReason(item.hideReason ?? "unavailable");
                            setHideBack(item.hideBack === "soon" ? "soon" : item.hideBack ? "date" : "");
                            setHideDate(item.hideBack && item.hideBack !== "soon" ? item.hideBack : "");
                            return;
                          }
                          toggleListing(item.id);
                        }}
                      >
                        {item.hidden ? (ar ? "أظهر" : "Show") : ar ? "أخفِ" : "Hide"}
                      </button>
                      <button type="button" className="h-10 rounded-md border border-line px-3 text-sm" onClick={() => removeListing(item.id)}>{ar ? "حذف" : "Remove"}</button>
                    </li>
                  ))}
                </ul>
                {hideFor && (
                  <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" onClick={() => setHideFor("")}>
                    <form
                      className="w-full max-w-md space-y-3 rounded-xl bg-paper p-4 shadow-md"
                      onClick={(event) => event.stopPropagation()}
                      onSubmit={(event) => {
                        event.preventDefault();
                        hideListing(hideFor, hideReason, hideBack === "soon" ? "soon" : hideBack === "date" && hideDate ? hideDate : undefined);
                        setHideFor("");
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-2xl">{ar ? "إخفاء الصنف" : "Hide item"}</h3>
                        <button type="button" className="size-10 text-xl" onClick={() => setHideFor("")} aria-label="Close">×</button>
                      </div>
                      {(
                        [
                          ["unavailable", "Unavailable", "غير متاح"],
                          ["stock", "Out of stock", "نفدت الكمية"],
                          ["sold", "Sold out", "تم البيع"],
                        ] as const
                      ).map(([id, en, arabic]) => (
                        <label key={id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${hideReason === id ? "border-ink bg-cream" : "border-line"}`}>
                          <span><input type="radio" className="me-2 accent-ink" checked={hideReason === id} onChange={() => setHideReason(id)} />{en}</span>
                          <span dir="rtl">{arabic}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 text-sm"><input type="radio" className="accent-ink" checked={hideBack === ""} onChange={() => setHideBack("")} />{ar ? "بدون تاريخ" : "No date"}</label>
                      <label className="flex items-center gap-2 text-sm"><input type="radio" className="accent-ink" checked={hideBack === "soon"} onChange={() => setHideBack("soon")} />{ar ? "يرجع قريب" : "Back soon"}</label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" className="accent-ink" checked={hideBack === "date"} onChange={() => setHideBack("date")} />
                        {ar ? "تاريخ" : "Date"}
                        <input type="date" value={hideDate} onChange={(event) => { setHideDate(event.target.value); setHideBack("date"); }} className="h-10 rounded-md border border-line px-2" />
                      </label>
                      <button type="submit" className="h-11 w-full rounded-md bg-ink font-semibold text-cream">{ar ? "أخفِ" : "Hide"}</button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "hello" && (
          <section className="mt-6">
            <h2 className="font-display text-2xl">Hello, World!</h2>
            <p className="hw-note">{ar ? "احكِ مع مجتمعك من هنا. منشورات اليوم بتختفي من اللوح بنص الليل، والسجل بيضل لشهر." : "Talk to your community here. Today's posts leave the board at midnight. History keeps them for a month."}</p>
            <HelloComposer />
          </section>
        )}
        {tab === "analytics" && (
          <section className="mt-6" id="desk-analytics">
            {grow ? (
              <GrowAnalytics
                series={account?.stallSeries ?? []}
                orders={inquiries}
                reviews={stallReviews}
                hello={helloTotals(account?.helloPosts ?? [], accounts)}
                visits={account?.stallViews ?? 0}
                ar={ar}
              />
            ) : (
              <p className="rounded-xl border border-line bg-cream p-4 text-sm text-mute">{ar ? "التحليلات تفتح على النمو." : "Analytics opens on Grow."}</p>
            )}
          </section>
        )}
        {tab === "orders" && (
          <OrderBoard
            ar={ar}
            orders={inquiries.map((order) => ({
              ...order,
              buyerName: (order.buyerPhone && accounts[order.buyerPhone]?.username) || (ar ? "مشتري" : "Buyer"),
              ref: orderRef(order.id),
            }))}
            selectedId={orderFromUrl}
            onOpen={(id) => void navigate({ to: "/seller", search: { tab: "orders", item: "", order: id, note: "" } })}
            onComplete={completeDeskOrder}
          />
        )}
        {tab === "inbox" && (
          <div id="desk-inbox">
            <SouqContact ar={ar} />
            <InboxBoard
            ar={ar}
            me={user.phone}
            threads={threads}
            selectedId={noteFromUrl}
            onOpen={openSellerMessage}
            onReply={replySellerMessage}
            onDeleteThread={deleteSellerThread}
            onDeleteLine={deleteSellerLine}
          />
          </div>
        )}
        {tab === "reviews" && <div id="desk-reviews"><ReviewBoard ar={ar} slug={profileSlug} reviews={stallReviews} replies={reviewReplies ?? {}} onReply={replyToReview} /></div>}
        {tab === "notes" && (
          <div id="desk-notes">
          {alerts.some((alert) => alert.kind === "plan") && (
            <div className="mt-6 rounded-xl border border-ink bg-sand px-4 py-3 text-sm">
              {alerts.filter((alert) => alert.kind === "plan").map((alert) => (
                <p key={alert.id}><b>{alert.title}.</b> {alert.detail}</p>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-1 rounded-xl bg-sand p-1" role="tablist">
            {(
              [
                ["reviews", ar ? "التقييمات" : "Reviews"],
                ["orders", ar ? "الطلبات" : "Orders"],
                ["views", ar ? "المشاهدات" : "Views"],
              ] as const
            ).map(([id, label]) => {
              const count = alerts.filter((alert) => alert.kind === id).length;
              return (
                <button key={id} type="button" role="tab" aria-selected={noteKind === id} className={`h-10 flex-1 rounded-lg text-sm font-semibold ${noteKind === id ? "bg-ink text-cream" : ""}`} onClick={() => setNoteKind(id)}>
                  {label}
                  {count > 0 && <span className="ms-2 inline-flex min-w-5 justify-center rounded-full bg-cream px-1 text-xs text-ink">{count}</span>}
                </button>
              );
            })}
          </div>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
            {alerts.filter((alert) => alert.kind === noteKind).length === 0 && <li className="p-4 text-sm text-mute">{ar ? "ما في تنبيهات." : "Nothing here."}</li>}
            {alerts.filter((alert) => alert.kind === noteKind).map((alert) => (
              <li key={alert.id}>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-start"
                  onClick={() => {
                    markSellerSeen([alert.id]);
                    clearSellerAlert(alert.id, { title: alert.title, detail: alert.detail, kind: alert.kind });
                    void navigate({ to: "/seller", search: { tab: alert.tab, item: alert.listingId ?? "", order: alert.orderId ?? "", note: "" } });
                  }}
                >
                  <b className="block">{alert.title}</b>
                  <span className="text-sm text-mute">{alert.detail}</span>
                </button>
              </li>
            ))}
          </ul>
          {sellerHistory.some((entry) => noteKindOf(entry) === noteKind && !isWaProfileNotice(entry.detail)) && (
            <div className="mt-4">
              <h2 className="font-display text-xl">{ar ? "السجل" : "History"}</h2>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white">
                {sellerHistory.filter((entry) => noteKindOf(entry) === noteKind && !isWaProfileNotice(entry.detail)).map((entry) => (
                  <li key={entry.id} id={`desk-note-${entry.id}`} className="px-4 py-3">
                    <b className="block text-sm">{entry.title}</b>
                    <p className="text-sm text-mute">{entry.detail}</p>
                    <p className="text-xs text-mute">{new Date(entry.at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          </div>
        )}
        {tab === "promos" && (planId === "premium" || planId === "grow") && (
          <PromoBoard ar={ar} used={usedPromos} cap={planId === "premium" ? 4 : 1} daysLeft={daysLeftInMonth()} items={promotions} onAdd={addPromotion} />
        )}
      </main>
    </Shell>
  );
}

function isWaProfileNotice(detail: string) {
  return /opened whatsapp|فتحوا واتساب/i.test(detail);
}

function noteKindOf(entry: { kind?: string; title: string; detail: string }) {
  if (entry.kind === "reviews" || entry.kind === "orders" || entry.kind === "views") return entry.kind;
  const text = `${entry.title} ${entry.detail}`.toLowerCase();
  if (text.includes("review") || text.includes("تقييم")) return "reviews";
  if (text.includes("view") || text.includes("مشاهد")) return "views";
  return "orders";
}

function toChoices(choices: DraftChoice[]): ItemChoice[] | undefined {
  const next = choices
    .map((choice) => ({
      en: choice.en.trim(),
      ar: choice.ar.trim() || choice.en.trim(),
      options: choice.options
        .filter((option) => option.en.trim() || option.ar.trim())
        .map((option) => ({
          en: option.en.trim() || option.ar.trim(),
          ar: option.ar.trim() || option.en.trim(),
          extra: Math.max(0, Number(option.extra) || 0),
          off: option.off,
          reason: option.off ? option.reason || "unavailable" : undefined,
          back: option.off && option.back ? option.back : undefined,
        })),
    }))
    .filter((choice) => choice.en.length > 1 && choice.options.length > 0);
  return next.length ? next : undefined;
}

const MENU_PRESETS = [
  { en: "Main", ar: "رئيسي" },
  { en: "Side", ar: "جانبي" },
  { en: "Drinks", ar: "مشروبات" },
];

function SectionFields({ ar, group, groupAr, setGroup, setGroupAr }: { ar: boolean; group: string; groupAr: string; setGroup: (next: string) => void; setGroupAr: (next: string) => void }) {
  const preset = MENU_PRESETS.find((item) => item.en.toLocaleLowerCase() === group.trim().toLocaleLowerCase());
  const [forced, setForced] = useState<boolean | null>(null);
  const open = forced ?? (Boolean(group.trim()) && !preset);
  return (
    <fieldset className="text-sm sm:col-span-2">
      <legend className="font-semibold">Menu section · قسم القائمة</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {MENU_PRESETS.map((item) => {
          const on = preset?.en === item.en;
          return (
            <button key={item.en} type="button" className={`h-10 rounded-md border px-3 text-sm ${on ? "border-ink bg-ink text-cream" : "border-line bg-white"}`} onClick={() => { setForced(false); setGroup(item.en); setGroupAr(item.ar); }}>
              {item.en} · {item.ar}
            </button>
          );
        })}
        <button type="button" className={`h-10 rounded-md border px-3 text-sm ${open ? "border-ink bg-ink text-cream" : "border-line bg-white"}`} onClick={() => { setForced(true); if (preset) { setGroup(""); setGroupAr(""); } }}>
          {ar ? "أضف قسمك" : "Add your own section"}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            Menu section
            <input value={preset ? "" : group} onChange={(event) => setGroup(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-white px-3" />
            <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (group.trim()) void translateText(group, "en").then((text) => text && setGroupAr(text)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
          </label>
          <label>
            قسم القائمة
            <input value={groupAr} dir="rtl" onChange={(event) => setGroupAr(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-white px-3" />
            <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (groupAr.trim()) void translateText(groupAr, "ar").then((text) => text && setGroup(text)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
          </label>
        </div>
      )}
    </fieldset>
  );
}

const LIST_PRESETS = [
  { en: "Size", ar: "المقاس" },
  { en: "Color", ar: "اللون" },
  { en: "Flavor", ar: "النكهة" },
];

function blankSubname(): DraftOption {
  return { en: "", ar: "", extra: "", off: false, reason: "", back: "" };
}

function ChoiceFields({
  lang,
  choices,
  setChoices,
  chart,
  setChart,
  sets,
  onSaveSet,
}: {
  lang: "en" | "ar";
  choices: DraftChoice[];
  setChoices: (next: DraftChoice[]) => void;
  chart: string | null;
  setChart: (next: string | null) => void;
  sets: OptionSet[];
  onSaveSet: (next: OptionSet) => void;
}) {
  const ar = lang === "ar";
  const [custom, setCustom] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const active = choices[0];
  const preset = LIST_PRESETS.find((item) => item.en.toLocaleLowerCase() === (active?.en || "").trim().toLocaleLowerCase());
  const own = custom || (Boolean(active?.en.trim()) && !preset);

  function writeList(en: string, arName: string) {
    const current = choices[0] ?? { en: "", ar: "", options: [] };
    setChoices([{ ...current, en, ar: arName }, ...choices.slice(1)]);
  }

  function pickPreset(item: { en: string; ar: string }) {
    setCustom(false);
    const found = choices.find((list) => list.en.toLocaleLowerCase() === item.en.toLocaleLowerCase());
    if (found) {
      setChoices([found, ...choices.filter((list) => list !== found)]);
      return;
    }
    setChoices([{ en: item.en, ar: item.ar, options: [blankSubname()] }, ...choices]);
  }

  function addSubname(listName: string) {
    const name = listName || choices[0]?.en || "";
    if (!name) return;
    if (!choices.some((list) => list.en === name)) {
      setChoices([{ en: name, ar: name, options: [blankSubname()] }, ...choices]);
      return;
    }
    setChoices(choices.map((list) => (list.en === name ? { ...list, options: [...list.options, blankSubname()] } : list)));
  }

  function patchSubname(listName: string, index: number, next: DraftOption, under: string) {
    if (under === listName) {
      setChoices(choices.map((list) => (list.en === listName ? { ...list, options: list.options.map((item, i) => (i === index ? next : item)) } : list)));
      return;
    }
    setChoices(
      choices.map((list) => {
        if (list.en === listName) return { ...list, options: list.options.filter((_, i) => i !== index) };
        if (list.en === under) return { ...list, options: [...list.options, next] };
        return list;
      }),
    );
  }

  function saveList() {
    const ready = choices.filter((list) => list.en.trim().length > 1 && list.options.some((option) => option.en.trim()));
    if (!ready.length) {
      setSavedNote(ar ? "سمِّ القائمة وأضف اسماً فرعياً." : "Name the list and add a subname.");
      return;
    }
    for (const list of ready) {
      onSaveSet({
        id: list.en.trim().toLowerCase(),
        en: list.en.trim(),
        ar: list.ar.trim() || list.en.trim(),
        options: list.options.filter((option) => option.en.trim()).map((option) => ({ en: option.en.trim(), ar: option.ar.trim() || option.en.trim(), extra: Number(option.extra) || undefined })),
      });
    }
    setSavedNote(ar ? "انحفظت. استخدمها على أي منتج." : "Saved. Use it on any item.");
  }

  return (
    <fieldset className="text-sm sm:col-span-2">
      <legend className="font-semibold">{ar ? "قوائم الصنف" : "Item lists"}</legend>
      <p className="mb-3 text-xs text-mute">{ar ? "أنت تختار اسم القائمة مرة، ثم تضيف الاسم الفرعي تحتها." : "You set the list name once, then add each subname under it."}</p>
      {sets.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {sets.map((set) => (
            <button key={set.id} type="button" className="h-10 rounded-md border border-line bg-white px-3 text-sm" onClick={() => { setCustom(false); setChoices([{ en: set.en, ar: set.ar, options: set.options.map((option) => ({ en: option.en, ar: option.ar, extra: option.extra ? String(option.extra) : "", off: false, reason: "", back: "" })) }, ...choices.filter((list) => list.en.toLocaleLowerCase() !== set.en.toLocaleLowerCase())]); }}>
              {ar ? set.ar : set.en}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-line bg-white p-3">
        <p className="font-semibold">{ar ? "اسم القائمة" : "List name"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LIST_PRESETS.map((item) => (
            <button key={item.en} type="button" className={`h-10 rounded-md border px-3 text-sm ${preset?.en === item.en && !custom ? "border-ink bg-ink text-cream" : "border-line"}`} onClick={() => pickPreset(item)}>
              {item.en} · {item.ar}
            </button>
          ))}
          <button type="button" className={`h-10 rounded-md border px-3 text-sm ${own ? "border-ink bg-ink text-cream" : "border-line"}`} onClick={() => { setCustom(true); if (preset) writeList("", ""); }}>
            {ar ? "أضف قائمتك" : "Add your own list"}
          </button>
        </div>
        {own && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              {ar ? "اسم القائمة" : "List name"}
              <input value={preset ? "" : active?.en || ""} onChange={(event) => writeList(event.target.value, active?.ar || "")} className="mt-1 h-11 w-full rounded-md border border-line px-3" />
              <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (active?.en.trim()) void translateText(active.en, "en").then((text) => text && writeList(active.en, text)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
            </label>
            <label>
              {ar ? "اسم القائمة بالعربي" : "List name in Arabic"}
              <input value={active?.ar || ""} dir="rtl" onChange={(event) => writeList(active?.en || "", event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" />
              <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (active?.ar.trim()) void translateText(active.ar, "ar").then((text) => text && writeList(text, active.ar)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
            </label>
          </div>
        )}
        <div className="mt-4 grid gap-3">
          {choices.flatMap((list) =>
            list.options.map((option, optionIndex) => (
              <div key={`${list.en}-${optionIndex}`} className="rounded-lg border border-line p-3">
                <label className="block text-xs">
                  {ar ? "تحت القائمة" : "Under list"}
                  <select value={list.en} className="mt-1 h-10 w-full rounded-md border border-line px-2" onChange={(event) => patchSubname(list.en, optionIndex, option, event.target.value)}>
                    {choices.filter((item) => item.en.trim()).map((item) => (
                      <option key={item.en} value={item.en}>{ar ? item.ar || item.en : item.en}</option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label>
                    {ar ? "الاسم الفرعي" : "Subname"}
                    <input value={option.en} placeholder="Large" className="mt-1 h-10 w-full rounded-md border border-line px-3" onChange={(event) => patchSubname(list.en, optionIndex, { ...option, en: event.target.value }, list.en)} />
                    <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (option.en.trim()) void translateText(option.en, "en").then((text) => text && patchSubname(list.en, optionIndex, { ...option, ar: text }, list.en)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
                  </label>
                  <label>
                    {ar ? "الاسم الفرعي بالعربي" : "Subname in Arabic"}
                    <input value={option.ar} dir="rtl" placeholder="كبير" className="mt-1 h-10 w-full rounded-md border border-line px-3" onChange={(event) => patchSubname(list.en, optionIndex, { ...option, ar: event.target.value }, list.en)} />
                  </label>
                </div>
                <label className="mt-3 block text-xs">+JOD<input value={option.extra} inputMode="decimal" className="mt-1 h-10 w-full rounded-md border border-line px-2" onChange={(event) => patchSubname(list.en, optionIndex, { ...option, extra: event.target.value }, list.en)} /></label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={`h-10 rounded-md px-3 text-xs font-semibold ${!option.off ? "bg-ink text-cream" : "border border-line"}`} onClick={() => patchSubname(list.en, optionIndex, { ...option, off: false, reason: "", back: "" }, list.en)}>{ar ? "متاح" : "Available"}</button>
                  <button type="button" className={`h-10 rounded-md px-3 text-xs font-semibold ${option.off ? "bg-ink text-cream" : "border border-line"}`} onClick={() => patchSubname(list.en, optionIndex, { ...option, off: true, reason: option.reason || "unavailable" }, list.en)}>{ar ? "غير متاح" : "Not available"}</button>
                </div>
                {option.off && (
                  <div className="mt-3 grid gap-2">
                    <div className="flex flex-wrap gap-2">
                      {([["unavailable", "Unavailable", "غير متاح"], ["stock", "Out of stock", "نفدت الكمية"], ["sold", "Sold out", "تم البيع"]] as const).map(([id, en, arabic]) => (
                        <button key={id} type="button" className={`h-9 rounded-md border px-3 text-xs ${option.reason === id ? "border-ink bg-ink text-cream" : "border-line"}`} onClick={() => patchSubname(list.en, optionIndex, { ...option, reason: id }, list.en)}>{ar ? arabic : en}</button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className={`h-9 rounded-md border px-3 text-xs ${option.back === "soon" ? "border-ink bg-ink text-cream" : "border-line"}`} onClick={() => patchSubname(list.en, optionIndex, { ...option, back: option.back === "soon" ? "" : "soon" }, list.en)}>{ar ? "ترقبوا" : "Stay tuned"}</button>
                      <input type="date" value={option.back === "soon" ? "" : option.back} className="h-9 rounded-md border border-line px-2 text-xs" onChange={(event) => patchSubname(list.en, optionIndex, { ...option, back: event.target.value }, list.en)} />
                    </div>
                  </div>
                )}
              </div>
            )),
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="h-9 rounded-md border border-dashed border-line px-3 text-xs font-semibold" onClick={() => addSubname(active?.en || "")}>{ar ? "أضف اسماً فرعياً" : "Add subname"}</button>
          <button type="button" className="h-9 rounded-md bg-ink px-3 text-xs font-semibold text-cream" onClick={saveList}>{ar ? "احفظ القائمة" : "Save list"}</button>
        </div>
        {savedNote && <p className="mt-2 text-xs text-mute">{savedNote}</p>}
      </div>
      <div className="mt-3">
        <SquareCrop label={ar ? "جدول المقاسات أو الألوان" : "Size or color chart"} src={chart} onPick={setChart} />
      </div>
    </fieldset>
  );
}

async function translateText(text: string, from: "en" | "ar") {
  const clean = text.trim();
  if (!clean) return "";
  const to = from === "en" ? "ar" : "en";
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=${from}|${to}`);
    const data = (await res.json()) as { responseData?: { translatedText?: string } };
    return data.responseData?.translatedText?.trim() || "";
  } catch {
    return "";
  }
}

function hideCopy(reason: "unavailable" | "stock" | "sold", lang: "en" | "ar") {
  const copy = { unavailable: ["Unavailable", "غير متاح"], stock: ["Out of stock", "نفدت الكمية"], sold: ["Sold out", "تم البيع"] }[reason];
  return lang === "ar" ? copy[1] : copy[0];
}

function UpgradeCode({ ar }: { ar: boolean }) {
  const redeemPlanCode = useSession((s) => s.redeemPlanCode);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);
  return (
    <form
      className="mt-4 border-t border-line pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const result = redeemPlanCode(code);
        if (!result.ok) {
          setBad(true);
          setNote(result.error === "full" ? (ar ? "هذا الرمز خلص." : "That code is used up.") : result.error === "expired" ? (ar ? "هذا الرمز منتهي." : "That code has expired.") : ar ? "الرمز غير صحيح." : "That code is not valid.");
          return;
        }
        setBad(false);
        setCode("");
        setNote(ar ? "تم تطبيق الرمز. خطتك تحديثت." : "Code applied. Your plan is updated.");
      }}
    >
      <p className="text-sm font-semibold">{ar ? "رقّي الخطة برمز" : "Upgrade with a code"}</p>
      <p className="mt-1 text-xs text-mute">{ar ? "الصق رمز سوق بطوطة. الخطة تتغير حسب الرمز." : "Paste a Souq Battuta code. The plan changes to the one on the code."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="TEST-BASIC" className="h-11 min-w-48 flex-1 rounded-md border border-line bg-white px-3" />
        <button type="submit" className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">{ar ? "طبّق الرمز" : "Apply code"}</button>
      </div>
      {note && <p className={`mt-2 text-sm ${bad ? "text-red" : "text-ink"}`}>{note}</p>}
    </form>
  );
}

function BillingBanner({ ar, planId, phase, ends, pending }: { ar: boolean; planId: PlanId; phase: string; ends?: number; pending?: string }) {
  const days = ends ? Math.ceil((ends - Date.now()) / 86400000) : null;
  let text = "";
  if (phase === "pending" || pending) {
    text = ar ? "الدفع بانتظار التأكيد. الخطة المدفوعة تفتح بعد ما نأكد التحويل." : "Payment is pending. The paid plan opens after we confirm the transfer.";
  } else if (phase === "paused") {
    text = ar ? "الدكان متوقف ومخفي. بياناتك محفوظة. جدّد ليظهر من جديد." : "The stall is paused and hidden. Your data is kept. Renew to show it again.";
  } else if (phase === "grace") {
    text = ar ? "أنت في فترة سماح من ٣ إلى ٥ أيام. جدّد قبل ما يتوقف الدكان." : "You are in the 5-day grace period. Renew before the stall is paused.";
  } else if (planId === "free" && days != null && days <= 14) {
    text = ar ? `المجاني ينتهي خلال ${days} يوماً. بعدها اختر خطة مدفوعة.` : `Free ends in ${days} day${days === 1 ? "" : "s"}. Then choose a paid plan.`;
  } else if (planId !== "free" && days != null && days <= 7) {
    text = days <= 0
      ? ar ? "ينتهي اليوم. جدّد الآن." : "It ends today. Renew now."
      : ar ? `ينتهي خلال ${days} أيام. جدّد الآن.` : `It ends in ${days} day${days === 1 ? "" : "s"}. Renew now.`;
  }
  if (!text) return null;
  return <p className="mt-2 rounded-md bg-sand px-3 py-2 text-sm text-ink">{text}</p>;
}

function membershipDays(planEnds?: number) {
  if (!planEnds) return 0;
  return Math.ceil((planEnds - Date.now()) / 86400000);
}

function membershipLine(planEnds: number | undefined, ar: boolean) {
  if (!planEnds) return ar ? "لا تاريخ انتهاء بعد." : "No end date yet.";
  const days = Math.ceil((planEnds - Date.now()) / 86400000);
  const date = new Date(planEnds).toLocaleDateString(ar ? "ar" : "en", { day: "numeric", month: "short" });
  if (days < 0) return ar ? `انتهى في ${date}` : `Ended ${date}`;
  return ar ? `${days} أيام باقية · ينتهي ${date}` : `${days} days left · ends ${date}`;
}

function orderRef(id: string) {
  return id;
}

function orderedListings<T extends { group?: string; name: string }>(items: T[]) {
  const order: string[] = [];
  for (const item of items) {
    const key = (item.group || "").toLocaleLowerCase();
    if (!order.includes(key)) order.push(key);
  }
  return [...items].sort((a, b) => {
    const ai = order.indexOf((a.group || "").toLocaleLowerCase());
    const bi = order.indexOf((b.group || "").toLocaleLowerCase());
    return ai - bi || a.name.localeCompare(b.name);
  });
}

function dayKey(at: number) {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function OrderBoard({
  ar,
  orders,
  selectedId,
  onOpen,
  onComplete,
}: {
  ar: boolean;
  orders: (BuyerOrder & { buyerName: string; ref: string })[];
  selectedId: string;
  onOpen: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const open = orders.filter((order) => order.status !== "done");
  const done = orders.filter((order) => order.status === "done");
  const selected = orders.find((order) => order.id === selectedId);
  const days: { key: string; label: string; items: typeof done }[] = [];
  for (const order of done) {
    const key = dayKey(order.at);
    const found = days.find((day) => day.key === key);
    if (found) found.items.push(order);
    else days.push({ key, label: new Date(order.at).toLocaleDateString(ar ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" }), items: [order] });
  }
  return (
    <section className="mt-6">
      <h2 className="font-display text-2xl">{ar ? "الطلبات المفتوحة" : "Open orders"}</h2>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
        {open.length === 0 && <li className="p-4 text-sm text-mute">{ar ? "ما في طلبات مفتوحة." : "No open orders."}</li>}
        {open.map((order) => (
          <li key={order.id} id={`desk-order-${order.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onOpen(order.id)}>
              <b className="block">{order.ref}</b>
              <span className="text-sm text-mute">{order.buyerName} · {order.total ?? 0} JOD</span>
            </button>
            <button type="button" className="h-10 rounded-md bg-ink px-3 text-sm font-semibold text-cream" onClick={() => onComplete(order.id)}>{ar ? "اكتمل" : "Complete"}</button>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 font-display text-2xl">{ar ? "الطلبات السابقة" : "Previous orders"}</h2>
      <div className="mt-3 space-y-4">
        {days.map((day) => (
          <div key={day.key}>
            <p className="text-xs font-semibold tracking-wide text-mute">{day.label}</p>
            <ul className="mt-1 divide-y divide-line rounded-xl border border-line bg-white">
              {day.items.map((order) => (
                <li key={order.id}>
                  <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-start" onClick={() => onOpen(order.id)}>
                    <span>
                      <b className="block">{order.ref}</b>
                      <span className="text-sm text-mute">{order.buyerName}</span>
                    </span>
                    <span className="text-sm">{order.total ?? 0} JOD</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" onClick={() => onOpen("")}>
          <div className="w-full max-w-md rounded-xl bg-paper p-4 shadow-md" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{selected.ref}</h3>
              <button type="button" className="size-10 text-xl" aria-label="Close" onClick={() => onOpen("")}>×</button>
            </div>
            <p className="mt-2 text-sm font-semibold">{selected.buyerName}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{selected.productName}</p>
            <p className="mt-2 text-sm">{ar ? "المجموع" : "Total"} · {selected.total ?? 0} JOD</p>
            {selected.addressName && <p className="mt-1 text-sm text-mute">{selected.addressName}</p>}
            <p className="mt-1 text-xs text-mute">{new Date(selected.at).toLocaleString()}</p>
          </div>
        </div>
      )}
    </section>
  );
}

const SOCIAL_NETWORKS: { id: SocialNetwork; en: string; ar: string }[] = [
  { id: "instagram", en: "Instagram", ar: "إنستغرام" },
  { id: "facebook", en: "Facebook", ar: "فيسبوك" },
  { id: "tiktok", en: "TikTok", ar: "تيك توك" },
  { id: "snapchat", en: "Snapchat", ar: "سناب شات" },
  { id: "youtube", en: "YouTube", ar: "يوتيوب" },
];

function tidyLink(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function linkMatches(network: SocialNetwork, href: string) {
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, "");
    const hosts: Record<SocialNetwork, string[]> = {
      instagram: ["instagram.com"],
      facebook: ["facebook.com", "fb.com", "fb.me"],
      tiktok: ["tiktok.com"],
      snapchat: ["snapchat.com"],
      youtube: ["youtube.com", "youtu.be"],
    };
    if (!hosts[network].some((item) => host === item || host.endsWith(`.${item}`))) return false;
    return url.pathname.replace(/\/+$/, "").length > 1;
  } catch {
    return false;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function SocialsBoard({ ar, open, code, items, onChange }: { ar: boolean; open: boolean; code: string; items: StallSocial[]; onChange: (next: StallSocial[]) => void }) {
  const saved = items.filter((item) => item.verified && item.href.trim()).slice(0, 3);
  const [copied, setCopied] = useState(false);
  const [network, setNetwork] = useState<SocialNetwork>("instagram");
  const [href, setHref] = useState("");
  const [ticked, setTicked] = useState(false);
  const [phase, setPhase] = useState<"idle" | "checking" | "done" | "fail">("idle");
  const [note, setNote] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const steps = ar
    ? [
        "انسخ الرمز.",
        "الصقه في البايو العام. لازم يبين بدون ما حدا يتابعك.",
        "ارجع هنا، أضف رابط حسابك العام، واضغط تحقق.",
        "استنى التحقق. بيخلص خلال ثواني. لما يخلص، أضف الحساب.",
        "بعد ما ينضاف الرابط، تقدر تشيل الرمز من حسابك.",
      ]
    : [
        "Copy the code.",
        "Paste it in the public bio. It has to be visible without following you.",
        "Come back here, add the link to your public profile, and click Verify.",
        "Wait for the verification. It should only take a few seconds. Once it is complete, add the social.",
        "Once your social media link is added, you can remove the code from your social media.",
      ];
  function copyCode() {
    const input = document.createElement("textarea");
    input.value = code;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    setCopied(true);
  }
  function clearCheck() {
    setPhase("idle");
    setNote("");
  }
  async function verify() {
    const link = tidyLink(href);
    if (!ticked || !link || phase === "checking") return;
    if (!linkMatches(network, link)) {
      setPhase("fail");
      setNote(ar ? "هذا الرابط ليس حساباً عاماً على الشبكة اللي اخترتها." : "That link is not a public profile on the network you chose.");
      return;
    }
    setHref(link);
    setPhase("checking");
    setNote(ar ? "نفتح الحساب العام…" : "Opening the public profile…");
    await wait(900);
    if (!alive.current) return;
    setNote(ar ? `ندوّر على الرمز ${code}…` : `Looking for ${code}…`);
    await wait(1000);
    if (!alive.current) return;
    setNote(ar ? "نتأكد إن الحساب إلك…" : "Confirming this account is yours…");
    await wait(800);
    if (!alive.current) return;
    setPhase("done");
    setNote(ar ? "تم التحقق. تقدر تضيف الحساب." : "Verified. You can add this account.");
  }
  function addAccount() {
    if (phase !== "done" || saved.length >= 3) return;
    const link = tidyLink(href);
    if (saved.some((item) => item.href === link)) {
      setPhase("fail");
      setNote(ar ? "هذا الحساب مضاف." : "That account is already added.");
      return;
    }
    onChange([...saved, { network, href: link, verified: true }]);
    setHref("");
    setTicked(false);
    setPhase("idle");
    setNote(ar ? "انضاف. تقدر تشيل الرمز من البايو." : "Added. You can remove the code from that bio.");
  }
  if (!open) {
    return <p className="mt-4 rounded-xl border border-line bg-cream p-4 text-sm text-mute">{ar ? "التواصل يفتح من الأساسي." : "Social media opens on Basic."}</p>;
  }
  return (
    <section className="mt-4 max-w-3xl space-y-4">
      <div className="rounded-xl border border-line bg-cream p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mute">{ar ? "رمز التحقق" : "Verification code"}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="font-display text-4xl tracking-wide text-ink">{code}</p>
          <button type="button" className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-cream" onClick={copyCode}>
            {copied ? (ar ? "تم النسخ" : "Copied") : ar ? "انسخ الرمز" : "Copy code"}
          </button>
        </div>
        <ol className="mt-5 space-y-2">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 rounded-lg bg-white px-3 py-3 text-sm leading-relaxed ring-1 ring-line">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-cream">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {saved.length > 0 && (
        <ul className="space-y-2">
          {saved.map((item) => (
            <li key={item.href} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <span className="min-w-0">
                <b className="block text-sm">{SOCIAL_NETWORKS.find((entry) => entry.id === item.network)?.[ar ? "ar" : "en"]}</b>
                <span className="block truncate text-xs text-mute">{item.href}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream">{ar ? "موثّق" : "Verified"}</span>
                <button type="button" className="h-9 rounded-md border border-line px-3 text-xs" onClick={() => onChange(saved.filter((row) => row.href !== item.href))}>{ar ? "احذف" : "Remove"}</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {saved.length < 3 && (
        <form
          className="rounded-xl border border-line bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (phase === "done") addAccount();
            else void verify();
          }}
        >
          <p className="text-sm font-semibold">{ar ? "أضف حساباً" : "Add an account"}</p>
          <p className="mt-1 text-xs text-mute">{saved.length} / 3</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIAL_NETWORKS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={phase === "checking"}
                className={`h-9 rounded-full border px-3 text-xs font-semibold disabled:opacity-40 ${network === entry.id ? "border-ink bg-ink text-cream" : "border-line"}`}
                onClick={() => { setNetwork(entry.id); clearCheck(); }}
              >
                {ar ? entry.ar : entry.en}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm">
            {ar ? "رابط الحساب العام" : "Public profile link"}
            <input
              value={href}
              disabled={phase === "checking"}
              placeholder="https://"
              className="mt-1 h-11 w-full rounded-md border border-line px-3 disabled:opacity-60"
              onChange={(event) => { setHref(event.target.value); clearCheck(); }}
            />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ticked} disabled={phase === "checking"} onChange={(event) => { setTicked(event.target.checked); clearCheck(); }} />
            <span>{ar ? `الرمز ${code} موجود في البايو العام.` : `The code ${code} is in the public bio.`}</span>
          </label>
          {phase === "checking" && (
            <div className="mt-4" aria-live="polite">
              <div className="h-1 overflow-hidden rounded-full bg-sand">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-ink" />
              </div>
              <p className="mt-2 text-sm text-ink">{note}</p>
            </div>
          )}
          {phase !== "checking" && note && <p className={`mt-3 text-sm ${phase === "fail" ? "text-red" : "text-ink"}`}>{note}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!ticked || !href.trim() || phase === "checking" || phase === "done"} className="h-11 rounded-md border border-ink px-4 text-sm font-semibold disabled:opacity-40" onClick={() => void verify()}>
              {phase === "checking" ? (ar ? "عم نتحقق…" : "Verifying…") : ar ? "تحقق" : "Verify"}
            </button>
            <button type="button" disabled={phase !== "done"} className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream disabled:opacity-40" onClick={addAccount}>
              {ar ? "أضف الحساب" : "Add account"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const ALGORITHM_GROUPS: { en: string; ar: string; items: [string, string][] }[] = [
  {
    en: "The occasion",
    ar: "المناسبة",
    items: [
      ["Special occasion", "مناسبة خاصة"],
      ["Everyday", "كل يوم"],
      ["Late night", "آخر الليل"],
      ["Breakfast", "فطور"],
      ["Weekend", "نهاية الأسبوع"],
    ],
  },
  {
    en: "Who it is for",
    ar: "لمين",
    items: [
      ["Family table", "سفرة عيلة"],
      ["Gift", "هدية"],
      ["Office", "المكتب"],
      ["Kids", "أطفال"],
      ["Guests", "ضيوف"],
    ],
  },
  {
    en: "How they get it",
    ar: "كيف يوصل",
    items: [
      ["Takeaway", "سفري"],
      ["Delivery", "توصيل"],
      ["Handmade", "شغل إيد"],
      ["Made to order", "حسب الطلب"],
    ],
  },
  {
    en: "The kind of place",
    ar: "نوع المكان",
    items: [
      ["Arabic cuisine", "مطبخ عربي"],
      ["Home cooking", "أكل بيت"],
      ["Sweet", "حلويات"],
      ["Healthy", "صحي"],
      ["Local", "محلي"],
      ["Vintage", "قديم"],
    ],
  },
];

function termKey(value: string) {
  return value.toLowerCase().replace(/\s*[·/]\s*/g, " / ").replace(/\s+/g, " ").trim();
}

function AlgorithmBoard({ ar, cap, words, onChange }: { ar: boolean; cap: number; words: string[]; onChange: (next: string[]) => void }) {
  const [en, setEn] = useState("");
  const [arabic, setArabic] = useState("");
  const [busy, setBusy] = useState(false);
  const full = words.length >= cap;
  function has(value: string) {
    const key = termKey(value);
    return words.some((word) => termKey(word) === key);
  }
  function toggle(value: string) {
    if (has(value)) onChange(words.filter((word) => termKey(word) !== termKey(value)));
    else if (!full) onChange([...words, value]);
  }
  async function addOwn(event: FormEvent) {
    event.preventDefault();
    if (full || busy) return;
    setBusy(true);
    let left = en.trim();
    let right = arabic.trim();
    if (left && !right) right = (await translateText(left, "en")) || "";
    if (right && !left) left = (await translateText(right, "ar")) || "";
    setBusy(false);
    if (!left || !right) return;
    const value = `${left} / ${right}`;
    if (!has(value)) onChange([...words, value]);
    setEn("");
    setArabic("");
  }
  if (cap < 1) {
    return <p className="mt-4 rounded-xl border border-line bg-cream p-4 text-sm text-mute">{ar ? "الخوارزمية تفتح من الأساسي." : "Algorithm opens on Basic."}</p>;
  }
  return (
    <section className="mt-4 max-w-3xl space-y-4">
      <div className="rounded-xl border border-line bg-cream p-5">
        <h2 className="font-display text-2xl">{ar ? "الخوارزمية" : "Algorithm"}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink">
          {ar
            ? "هذي مو أصناف المنيو. الكنافة إذا كانت بالقائمة، المشتري يلاقيها من غير ما تضيفها. أضف الطريقة اللي يدور فيها: مطبخ عربي، مناسبة، هدية."
            : "These are not menu items. If knafeh is already on the menu, a buyer can find it without you adding it. Add the way they look: Arabic cuisine, a special occasion, a gift."}
        </p>
        <p className="mt-3 text-sm italic text-mute">
          {ar ? "سطر إنجليزي وسطر عربي = مصطلح واحد. Gift / هدية يُحسب واحد، مو اثنين." : "One English line and one Arabic line are one term. Gift / هدية counts as one, not two."}
        </p>
        <p className="mt-4 font-display text-xl">{words.length} <span className="text-mute">/ {cap}</span></p>
      </div>
      {ALGORITHM_GROUPS.map((group) => (
        <div key={group.en} className="rounded-xl border border-line bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mute">{ar ? group.ar : group.en}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {group.items.map(([label, arabicLabel]) => {
              const value = `${label} / ${arabicLabel}`;
              const on = has(value);
              return (
                <button key={value} type="button" aria-pressed={on} disabled={!on && full} className={`h-10 rounded-full border px-3 text-sm ${on ? "border-ink bg-ink text-cream" : "border-line bg-cream"} disabled:opacity-40`} onClick={() => toggle(value)}>
                  {label} / {arabicLabel}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <form className="rounded-xl border border-line bg-white p-4" onSubmit={addOwn}>
        <p className="text-sm font-semibold">{ar ? "مصطلح من عندك" : "Your own term"}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            English
            <input value={en} onChange={(event) => setEn(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" />
            <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (en.trim()) void translateText(en, "en").then((text) => text && setArabic(text)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
          </label>
          <label className="text-sm">
            العربية
            <input value={arabic} dir="rtl" onChange={(event) => setArabic(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" />
            <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (arabic.trim()) void translateText(arabic, "ar").then((text) => text && setEn(text)); }}>{ar ? "ترجمة تلقائية" : "Auto translate"}</button>
          </label>
        </div>
        <button type="submit" disabled={full || busy} className="mt-3 h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream disabled:opacity-40">{busy ? "…" : ar ? "أضف المصطلح" : "Add term"}</button>
      </form>
      {words.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {words.map((word) => (
            <li key={word}>
              <button type="button" className="h-10 rounded-full border border-line bg-sand px-3 text-sm" onClick={() => onChange(words.filter((item) => item !== word))}>
                {word} ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SouqContact({ ar }: { ar: boolean }) {
  const messageSouq = useSession((s) => s.messageSouq);
  const [sent, setSent] = useState(false);
  return (
    <form
      className="mt-4 rounded-xl border border-line bg-cream p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const body = String(new FormData(event.currentTarget).get("body") ?? "");
        if (!messageSouq(body).ok) return;
        event.currentTarget.reset();
        setSent(true);
      }}
    >
      <p className="text-sm font-semibold">{ar ? "تواصل مع سوق بطوطة" : "Contact Souq Battuta"}</p>
      <p className="mt-1 text-xs text-mute">{ar ? "كل الخطط تقدر تراسلنا من هنا. منرد بس من الموقع." : "Every plan can write to us here. We only reply on the site."}</p>
      <textarea name="body" required rows={3} className="mt-3 w-full rounded-md border border-line bg-white px-3 py-2" placeholder={ar ? "اكتب رسالتك" : "Write your message"} />
      <button type="submit" className="mt-3 h-10 rounded-md bg-ink px-4 text-sm font-semibold text-cream">{ar ? "تواصل" : "Contact"}</button>
      {sent && <p className="mt-2 text-sm">{ar ? "وصلت الرسالة." : "Sent."}</p>}
    </form>
  );
}

function InboxBoard({ ar, me, threads, selectedId, onOpen, onReply, onDeleteThread, onDeleteLine }: { ar: boolean; me: string; threads: MailThread[]; selectedId: string; onOpen: (id: string) => void; onReply: (id: string, body: string) => void; onDeleteThread: (id: string) => void; onDeleteLine: (threadId: string, lineId: string) => void }) {
  const [current, setCurrent] = useState(selectedId || threads[0]?.id || "");
  const [draft, setDraft] = useState("");
  const selected = threads.find((thread) => thread.id === current) ?? threads[0];
  return (
    <section className="mt-6 grid overflow-hidden rounded-xl border border-line bg-white lg:grid-cols-[18rem_1fr]">
      <ul className="max-h-[32rem] divide-y divide-line overflow-auto border-line lg:border-e">
        {threads.length === 0 && <li className="p-4 text-sm text-mute">{ar ? "ما في رسائل." : "No messages."}</li>}
        {threads.map((thread) => (
          <li key={thread.id}>
            <button type="button" className="block w-full px-3 py-3 text-start" onClick={() => { setCurrent(thread.id); onOpen(thread.id); }}>
              <b className="block truncate">{thread.names[thread.phones.find((phone) => phone !== me) || ""] || (ar ? "رسالة" : "Message")}</b>
              <span className="block truncate text-xs text-mute">{thread.lines.at(-1)?.body}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="flex min-h-80 flex-col">
          <div className="flex justify-end border-b border-line p-2">
            <button type="button" className="h-9 rounded-md border border-line px-3 text-xs" onClick={() => onDeleteThread(selected.id)}>{ar ? "احذف" : "Delete"}</button>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3">
            {selected.lines.map((line) => (
              <div key={line.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${line.fromPhone === me ? "ms-auto bg-ink text-cream" : "bg-sand"}`}>
                <p className="whitespace-pre-wrap">{line.body}</p>
                <p className="mt-1 text-[10px] opacity-70">{new Date(line.at).toLocaleString()} {line.readAt ? (ar ? "· قُرئت" : "· Read") : ""}</p>
                <button type="button" className="text-[10px] underline" onClick={() => onDeleteLine(selected.id, line.id)}>{ar ? "احذف" : "Delete"}</button>
              </div>
            ))}
          </div>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(event) => { event.preventDefault(); if (!draft.trim()) return; onReply(selected.id, draft.trim()); setDraft(""); }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} className="h-11 flex-1 rounded-md border border-line px-3" placeholder={ar ? "اكتب رد" : "Write a reply"} />
            <button type="submit" className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">{ar ? "أرسل" : "Send"}</button>
          </form>
        </div>
      )}
    </section>
  );
}

function ReviewBoard({ ar, slug, reviews, replies, onReply }: { ar: boolean; slug: string; reviews: { user: string; comment: string; reply?: string; score: number }[]; replies: Record<string, string>; onReply: (key: string, reply: string) => { ok: boolean } }) {
  const [edit, setEdit] = useState("");
  const rows = reviews.map((review, index) => {
    const key = `${slug}:${index}`;
    return { review, key, reply: replies[key] || review.reply || "" };
  });
  const waiting = rows.filter((row) => !row.reply);
  const answered = rows.filter((row) => row.reply);
  function list(title: string, group: typeof rows, canReply: boolean) {
    if (!group.length) return null;
    return (
      <section className="mt-6">
        <h2 className="font-display text-2xl">{title}</h2>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
          {group.map(({ review, key, reply }) => (
            <li key={key} id={`desk-review-${key.split(":").pop()}`} className="p-4">
              <p className="text-sm font-semibold">
                <Link to="/buyer/$username" params={{ username: review.user }} className="inline-flex items-center gap-2 underline">
                  <OptImg src="/brand/avatars/buyer-duck.jpg?v=7" alt="" className="size-7 rounded-full object-cover" />
                  {review.user}
                </Link>
                {" · "}
                {review.score}
              </p>
              <p className="text-sm">{review.comment}</p>
              {reply && edit !== key && <p className="mt-2 text-sm text-mute">{reply}</p>}
              {edit === key ? (
                <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); onReply(key, String(new FormData(event.currentTarget).get("reply") ?? "")); setEdit(""); }}>
                  <input name="reply" defaultValue={reply} className="h-10 flex-1 rounded-md border border-line px-3" />
                  <button type="submit" className="h-10 rounded-md bg-ink px-3 text-sm text-cream">{ar ? "حفظ" : "Save"}</button>
                </form>
              ) : (
                <button type="button" className="mt-2 text-sm font-semibold underline" onClick={() => setEdit(key)}>
                  {canReply ? (ar ? "رد" : "Reply") : ar ? "عدّل الرد" : "Edit reply"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <div>
      {rows.length === 0 && <p className="mt-6 text-sm text-mute">{ar ? "ما في تقييمات." : "No reviews yet."}</p>}
      {list(ar ? "بانتظار الرد" : "Waiting for a reply", waiting, true)}
      {list(ar ? "تم الرد" : "Answered", answered, false)}
    </div>
  );
}

function topSold(orders: BuyerOrder[]) {
  const counts = new Map<string, number>();
  for (const order of orders) {
    for (const part of order.productName.split(",")) {
      const line = part.trim();
      if (!line) continue;
      const match = line.match(/^(\d+)\s*[×x]\s*(.+)$/i);
      const name = (match ? match[2] : line).replace(/\s+—.*$/, "").replace(/\s*\(.*/, "").trim();
      const qty = match ? Number(match[1]) : 1;
      if (name) counts.set(name, (counts.get(name) ?? 0) + (Number.isFinite(qty) ? qty : 1));
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function GrowAnalytics({
  series,
  orders,
  reviews,
  hello,
  visits,
  ar,
}: {
  series: { views: number; clicks: number; orders: number }[];
  orders: BuyerOrder[];
  reviews: { score: number }[];
  hello: { views: number; likes: number };
  visits: number;
  ar: boolean;
}) {
  const [range, setRange] = useState<"day" | "week" | "month" | "year">("day");
  const [metric, setMetric] = useState<"orders" | "sales" | "views" | "clicks">("orders");
  const buckets = chartBuckets(range, orders, series, ar);
  const orderCount = buckets.reduce((sum, bucket) => sum + bucket.orders, 0);
  const sales = buckets.reduce((sum, bucket) => sum + bucket.sales, 0);
  const views = buckets.reduce((sum, bucket) => sum + bucket.views, 0);
  const clicks = buckets.reduce((sum, bucket) => sum + bucket.clicks, 0);
  const prior = priorTotals(range, orders);
  const viewTotal = range === "day" ? views : series.reduce((sum, day) => sum + day.views, 0);
  const clickTotal = range === "day" ? clicks : series.reduce((sum, day) => sum + day.clicks, 0);
  const rating = reviews.length ? reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length : 0;
  const metrics = [
    ["orders", ar ? "الطلبات" : "Orders", String(orderCount), delta(orderCount, prior.orders)],
    ["sales", ar ? "المبيعات" : "Sales", `${sales.toLocaleString(undefined, { maximumFractionDigits: 1 })} JOD`, delta(sales, prior.sales)],
    ["views", ar ? "المشاهدات" : "Views", viewTotal.toLocaleString(), ""],
    ["clicks", ar ? "النقرات" : "Clicks", clickTotal.toLocaleString(), ""],
  ] as const;
  const ranges = [
    ["day", ar ? "يومي" : "Daily"],
    ["week", ar ? "أسبوعي" : "Weekly"],
    ["month", ar ? "شهري" : "Monthly"],
    ["year", ar ? "سنوي" : "Yearly"],
  ] as const;
  return (
    <div className="rounded-xl border border-line bg-cream p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl">{ar ? "النمو" : "Growth"}</h2>
        <div className="desk-ranges flex gap-1 rounded-lg bg-sand p-1">
          {ranges.map(([id, label]) => (
            <button key={id} type="button" className={`h-9 rounded-md px-3 text-sm ${range === id ? "bg-ink text-cream" : ""}`} onClick={() => setRange(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {metrics.map(([id, label, value, change]) => (
          <li key={id}>
            <button type="button" className={`w-full rounded-lg px-3 py-3 text-start ${metric === id ? "bg-ink text-cream" : "bg-paper"}`} onClick={() => setMetric(id)}>
              <b className="block font-display text-2xl">{value}</b>
              <span className="text-xs">{label}</span>
              {change && <span className={`mt-1 block text-xs ${metric === id ? "text-cream/80" : change.startsWith("-") ? "text-red" : "text-stamp-green"}`}>{change}</span>}
            </button>
          </li>
        ))}
        <li className="rounded-lg bg-paper px-3 py-3">
          <b className="block font-display text-2xl">{reviews.length ? rating.toFixed(1) : "—"}</b>
          <span className="text-xs text-mute">{ar ? `التقييم · ${reviews.length}` : `Rating · ${reviews.length}`}</span>
        </li>
      </ul>
      <div className="mt-4">
        <Bars label={metrics.find((item) => item[0] === metric)?.[1] ?? ""} unit={metric === "sales" ? "JOD" : ar ? "عدد" : "Count"} values={buckets.map((bucket) => bucket[metric])} labels={buckets.map((bucket) => bucket.label)} />
      </div>
      <h3 className="mt-4 text-sm font-semibold">{ar ? "الأكثر مبيعاً" : "Most sold"}</h3>
      <ol className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        {topSold(orders).length === 0 && <li className="px-3 py-3 text-sm text-mute">{ar ? "ما في مبيعات بعد." : "No sales yet."}</li>}
        {topSold(orders).map(([name, qty], index) => (
          <li key={name} className="flex items-center justify-between px-3 py-2.5 text-sm"><span><b className="me-2 text-mute">{index + 1}</b>{name}</span><b>{qty}</b></li>
        ))}
      </ol>
      <h3 className="mt-4 text-sm font-semibold">Hello, World! {ar ? "إحصاءات" : "statistics"}</h3>
      <ul className="hello-stats">
        <li>
          <b>{hello.views.toLocaleString()}</b>
          <span>{ar ? "مشاهدات" : "Views"}</span>
        </li>
        <li>
          <b>{hello.likes.toLocaleString()}</b>
          <span>{ar ? "إعجابات" : "Likes"}</span>
        </li>
        <li>
          <b>{visits.toLocaleString()}</b>
          <span>{ar ? "زيارات" : "Visits"}</span>
        </li>
      </ul>
    </div>
  );
}

function helloTotals(posts: { id: string; views?: number; hearts?: number }[], accounts: Record<string, { role?: string; helloHearts?: string[] }>) {
  const views = posts.reduce((sum, post) => sum + (post.views ?? 0), 0);
  const likes = posts.reduce((sum, post) => {
    const extra = Object.values(accounts).filter((account) => account.role !== "seller" && (account.helloHearts ?? []).includes(post.id)).length;
    return sum + (post.hearts ?? 0) + extra;
  }, 0);
  return { views, likes };
}

function delta(current: number, previous: number) {
  const diff = Math.round((current - previous) * 10) / 10;
  return `${diff > 0 ? "+" : ""}${diff} vs prior`;
}

function priorTotals(range: "day" | "week" | "month" | "year", orders: BuyerOrder[]) {
  const size = range === "day" ? 86400000 : range === "week" ? 7 * 86400000 : range === "month" ? 30 * 86400000 : 365 * 86400000;
  const count = range === "day" ? 14 : range === "week" ? 8 : range === "month" ? 12 : 4;
  const end = Date.now() - count * size;
  const inside = orders.filter((order) => order.at >= end - count * size && order.at < end);
  return { orders: inside.length, sales: inside.reduce((sum, order) => sum + (order.total ?? 0), 0) };
}

function chartBuckets(range: "day" | "week" | "month" | "year", orders: BuyerOrder[], series: { views: number; clicks: number }[], ar: boolean) {
  const size = range === "day" ? 86400000 : range === "week" ? 7 * 86400000 : range === "month" ? 30 * 86400000 : 365 * 86400000;
  const count = range === "day" ? 14 : range === "week" ? 8 : range === "month" ? 12 : 4;
  const start = Date.now() - count * size;
  return Array.from({ length: count }, (_, index) => {
    const from = start + index * size;
    const inside = orders.filter((order) => order.at >= from && order.at < from + size);
    const day = range === "day" ? series[series.length - count + index] : undefined;
    const date = new Date(from);
    const label = range === "year" ? String(date.getFullYear()) : date.toLocaleDateString(ar ? "ar" : "en", range === "month" ? { month: "short" } : { day: "numeric", month: "short" });
    return { label, orders: inside.length, sales: inside.reduce((sum, order) => sum + (order.total ?? 0), 0), views: day?.views ?? 0, clicks: day?.clicks ?? 0 };
  });
}

function Bars({ label, unit, values, labels }: { label: string; unit: string; values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  const step = Math.ceil(labels.length / 6);
  return (
    <figure className="rounded-lg border border-line bg-white p-3">
      <figcaption className="flex items-baseline justify-between"><b className="text-sm">{label}</b><span className="text-xs text-mute">{unit}</span></figcaption>
      <div className="mt-3 flex h-32 items-end gap-1 border-b border-line">
        {values.map((value, index) => (
          <span key={index} className="flex h-full flex-1 items-end" title={`${labels[index] ?? ""}: ${value}`}>
            <span className="block w-full rounded-sm bg-ink" style={{ height: `${value === 0 ? 0 : Math.max(6, (value / max) * 100)}%` }} />
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {labels.map((item, index) => (
          <span key={index} className="flex-1 truncate text-center text-[10px] text-mute">{index % step === 0 ? item : ""}</span>
        ))}
      </div>
    </figure>
  );
}

function daysLeftInMonth(now = new Date()) {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate() + 1;
}

function PromoBoard({ ar, used, cap, daysLeft, items, onAdd }: { ar: boolean; used: number; cap: number; daysLeft: number; items: { id: string; title: string; titleAr: string; detail: string; detailAr?: string; kind: string; off: string; offAr?: string; at: number; images?: string[] }[]; onAdd: (input: { title: string; titleAr: string; detail: string; detailAr: string; kind: "offer" | "announcement"; off: string; offAr: string; images: string[] }) => { ok: boolean; error?: "plan" | "limit" | "name" } }) {
  const [pane, setPane] = useState<"offer" | "announcement">("offer");
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [detail, setDetail] = useState("");
  const [detailAr, setDetailAr] = useState("");
  const [off, setOff] = useState("");
  const [offAr, setOffAr] = useState("");
  const [main, setMain] = useState<string | null>(null);
  const [subs, setSubs] = useState<(string | null)[]>([null, null, null]);
  const [error, setError] = useState("");
  const left = Math.max(0, cap - used);
  const shown = items.filter((item) => (pane === "announcement" ? item.kind === "announcement" : item.kind !== "announcement"));
  const titleEn = pane === "offer" ? "Title of offer" : "Title of announcement";
  const titleArabic = pane === "offer" ? "عنوان العرض" : "عنوان الإعلان";
  const detailEn = pane === "offer" ? "Details" : "Details of announcement";
  const detailArabic = pane === "offer" ? "التفاصيل" : "تفاصيل الإعلان";

  return (
    <section className="mt-6">
      <div className="announce-meter" aria-label={ar ? "رصيد الإعلانات" : "Announcement allowance"}>
        <div>
          <p>{ar ? "المستخدم هذا الشهر" : "Used this month"}</p>
          <b>{used}<span> / {cap}</span></b>
        </div>
        <div>
          <p>{ar ? "الأيام المتبقية" : "Days left"}</p>
          <b>{daysLeft}</b>
        </div>
        <p className="announce-note">{ar ? "الإعلانات لهذا الشهر فقط. ما ينتقل غير المستخدم للشهر الجاي." : "These announcements are for this month only. Unused ones do not move to next month."}</p>
      </div>
      <div className="mt-4 flex gap-1 rounded-xl bg-sand p-1" role="tablist">
        <button type="button" role="tab" aria-selected={pane === "offer"} className={`h-11 flex-1 rounded-lg text-sm font-semibold ${pane === "offer" ? "bg-ink text-cream" : ""}`} onClick={() => setPane("offer")}>
          Offer · عرض
        </button>
        <button type="button" role="tab" aria-selected={pane === "announcement"} className={`h-11 flex-1 rounded-lg text-sm font-semibold ${pane === "announcement" ? "bg-ink text-cream" : ""}`} onClick={() => setPane("announcement")}>
          Announcement · إعلان
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <form className="rounded-xl border border-line bg-cream p-4" onSubmit={(event) => {
          event.preventDefault();
          const images = [main, ...subs].filter((src): src is string => Boolean(src));
          const res = onAdd({ title, titleAr, detail, detailAr, kind: pane, off: pane === "offer" ? off : "", offAr: pane === "offer" ? offAr : "", images });
          if (!res.ok) {
            setError(res.error === "limit" ? (ar ? `${cap} إعلانات في الشهر فقط، وما ينتقل للشهر الجاي.` : `${cap} announcements a month. Unused ones do not carry over.`) : ar ? "اكتب العنوان." : "Add a title.");
            return;
          }
          setError("");
          setTitle("");
          setTitleAr("");
          setDetail("");
          setDetailAr("");
          setOff("");
          setOffAr("");
          setMain(null);
          setSubs([null, null, null]);
        }}>
          <h2 className="font-display text-2xl">{pane === "offer" ? "Offer · عرض" : "Announcement · إعلان"}</h2>
          <PairField
            en={titleEn}
            ar={titleArabic}
            value={title}
            valueAr={titleAr}
            onChange={setTitle}
            onChangeAr={setTitleAr}
          />
          <PairField
            en={detailEn}
            ar={detailArabic}
            value={detail}
            valueAr={detailAr}
            onChange={setDetail}
            onChangeAr={setDetailAr}
            multiline
          />
          {pane === "offer" && (
            <PairField
              en="Discount, sale, or offer"
              ar="خصم أو تخفيض أو عرض"
              value={off}
              valueAr={offAr}
              onChange={setOff}
              onChangeAr={setOffAr}
            />
          )}
          <div className="mt-4">
            <SquareCrop label="Main photo · الصورة الرئيسية" src={main} onPick={setMain} large />
            <div className="mt-3 flex flex-wrap gap-3">
              {subs.map((src, index) => (
                <SquareCrop
                  key={index}
                  label={`Photo ${index + 1} · صورة ${index + 1}`}
                  src={src}
                  onPick={(url) => setSubs((current) => current.map((item, i) => (i === index ? url : item)))}
                />
              ))}
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red">{error}</p>}
          <button type="submit" disabled={left === 0} className="mt-4 h-11 w-full rounded-md bg-ink font-semibold text-cream disabled:opacity-40">
            {pane === "offer" ? "Post offer · انشر العرض" : "Post announcement · انشر الإعلان"}
          </button>
        </form>
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {shown.length === 0 && <li className="p-4 text-sm text-mute">{pane === "offer" ? "No offers yet. · ما في عروض بعد." : "No announcements yet. · ما في إعلانات بعد."}</li>}
          {shown.map((promo) => (
            <li key={promo.id} className="p-4">
              {promo.images?.[0] && <OptImg src={promo.images[0]} alt="" className="mb-2 h-28 w-full rounded-md object-cover" />}
              {promo.images && promo.images.length > 1 && (
                <div className="mb-2 flex gap-2">
                  {promo.images.slice(1, 4).map((src) => <OptImg key={src} src={src} alt="" className="h-14 w-14 rounded-md object-cover" />)}
                </div>
              )}
              {(promo.off || promo.offAr) && <p className="text-xs uppercase tracking-wide text-mute">{ar ? promo.offAr || promo.off : promo.off}</p>}
              <p className="font-display text-xl">{ar ? promo.titleAr : promo.title}</p>
              <p className="text-sm text-mute">{ar ? promo.detailAr || promo.detail : promo.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PairField({
  en,
  ar,
  value,
  valueAr,
  onChange,
  onChangeAr,
  multiline,
}: {
  en: string;
  ar: string;
  value: string;
  valueAr: string;
  onChange: (value: string) => void;
  onChangeAr: (value: string) => void;
  multiline?: boolean;
}) {
  const field = "mt-1 w-full rounded-md border border-line bg-white px-3";
  return (
    <>
      <label className="mt-3 block text-sm">
        {en}
        {multiline ? (
          <textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} className={`${field} py-2`} />
        ) : (
          <input value={value} onChange={(event) => onChange(event.target.value)} className={`${field} h-11`} />
        )}
        <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (value.trim()) void translateText(value, "en").then((text) => text && onChangeAr(text)); }}>
          Auto translate · ترجمة تلقائية
        </button>
      </label>
      <label className="mt-3 block text-sm">
        {ar}
        {multiline ? (
          <textarea value={valueAr} rows={3} dir="rtl" onChange={(event) => onChangeAr(event.target.value)} className={`${field} py-2`} />
        ) : (
          <input value={valueAr} dir="rtl" onChange={(event) => onChangeAr(event.target.value)} className={`${field} h-11`} />
        )}
        <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => { if (valueAr.trim()) void translateText(valueAr, "ar").then((text) => text && onChange(text)); }}>
          Auto translate · ترجمة تلقائية
        </button>
      </label>
    </>
  );
}

function monthsWord(count: number, ar: boolean) {
  if (!ar) return count === 1 ? "1 free month" : `${count} free months`;
  if (count === 1) return "شهر مجاني";
  if (count === 2) return "شهران مجاناً";
  return "٣ أشهر مجاناً";
}

function StallShare({ slug, planId, ar }: { slug: string; planId: PlanId; ar: boolean }) {
  const accounts = useSession((s) => s.accounts);
  const user = useSession((s) => s.user);
  const code = user?.sellerCode ?? "";
  const ensureSellerCode = useSession((s) => s.ensureSellerCode);
  const linkRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<"" | "link" | "code">("");
  const paid = planId !== "free";
  const path = `/shop/${slug}`;
  const used = countCodeUses(accounts, code);
  const standing = campaignStanding(used);

  useEffect(() => {
    if (paid) ensureSellerCode();
  }, [ensureSellerCode, paid]);

  function write(text: string, which: "link" | "code") {
    const field = which === "link" ? linkRef.current : null;
    if (field) {
      field.focus();
      field.select();
      field.setSelectionRange(0, text.length);
    }
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    if (!ok) {
      const node = document.createElement("textarea");
      node.value = text;
      node.readOnly = true;
      node.style.position = "fixed";
      node.style.top = "0";
      node.style.left = "0";
      node.style.fontSize = "16px";
      document.body.appendChild(node);
      node.focus();
      node.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      node.remove();
    }
    if (!ok) void navigator.clipboard?.writeText(text);
    setCopied(which);
    window.setTimeout(() => setCopied(""), 1600);
  }

  function shareLink() {
    if (typeof navigator.share === "function") {
      void navigator.share({ title: "Souq Battuta", text: path }).catch(() => write(path, "link"));
      return;
    }
    write(path, "link");
  }

  return (
    <div className={`grid items-stretch gap-3 ${paid ? "lg:grid-cols-2" : ""}`}>
      <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mute">{ar ? "رابط الدكان" : "Share link"}</p>
        <div className="mt-3 flex gap-2">
          <input
            ref={linkRef}
            readOnly
            value={path}
            aria-label={ar ? "رابط الدكان" : "Share link"}
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-md border border-line bg-cream px-3 font-display text-lg text-ink"
          />
          <button type="button" onClick={() => write(path, "link")} className="h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-cream hover:bg-[#152648]">
            {copied === "link" ? (ar ? "تم النسخ" : "Copied") : ar ? "انسخ" : "Copy"}
          </button>
          <button type="button" onClick={shareLink} className="h-11 shrink-0 rounded-full border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-cream">
            {ar ? "شارك" : "Share"}
          </button>
        </div>
        <p className="mt-2 text-sm text-mute">
          {ar ? "أضفه على حساباتك." : "Add it to your socials."}
        </p>
      </div>
      {paid && (
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mute">{ar ? "رمزك" : "Your code"}</p>
            <button type="button" disabled={!code} onClick={() => write(code, "code")} className="h-11 shrink-0 rounded-full border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-cream disabled:opacity-40">
              {copied === "code" ? (ar ? "تم النسخ" : "Copied") : ar ? "انسخ" : "Copy"}
            </button>
          </div>
          <p className="mt-3 font-display text-3xl tracking-[0.18em] text-ink">{code || "····"}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CAMPAIGN_STEPS.map((step) => {
              const reached = used >= step.buyers;
              return (
                <div key={step.buyers} className={`rounded-lg px-2 py-1.5 text-center ${reached ? "bg-ink text-cream" : "bg-cream text-ink"}`}>
                  <p className="text-sm font-semibold leading-none">{step.buyers}</p>
                  <p className="mt-1 text-[11px]">{monthsWord(step.months, ar)}</p>
                </div>
              );
            })}
          </div>
          <div className="relative mt-3 h-1.5 rounded-full bg-sand" dir="ltr">
            <span className="absolute inset-y-0 start-0 rounded-full bg-ink" style={{ width: `${Math.min(100, used)}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink">
            <span className="font-semibold">{ar ? `${used} استخدموا الرمز` : `${used} used`}</span>
            <span className="text-mute">
              {" · "}
              {standing.next
                ? ar
                  ? `${standing.left} متبقون`
                  : `${standing.left} to the next month`
                : ar
                  ? "اكتملت الحملة"
                  : "Campaign complete"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
