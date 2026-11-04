import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PLANS, type PlanId } from "@/lib/data";
import { slugForSeller, useSession } from "@/lib/session";
import { campaignStanding, countCodeUses } from "@/lib/seller-campaign";
import { Shell } from "@/components/site-header";
import { HelloDesk } from "@/components/hello-board";

export const Route = createFileRoute("/desk")({ component: DeskPage });

type Pane = "overview" | "inbox" | "codes" | "stalls" | "reviews" | "hello";

function daysLeft(ends?: number) {
  if (!ends) return 0;
  return Math.max(0, Math.ceil((ends - Date.now()) / 86400000));
}

function DeskPage() {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const staff = useSession((s) => s.staff);
  const enterDesk = useSession((s) => s.enterDesk);
  const leaveDesk = useSession((s) => s.leaveDesk);
  const accounts = useSession((s) => s.accounts);
  const promoCodes = useSession((s) => s.promoCodes);
  const redemptions = useSession((s) => s.promoRedemptions);
  const reports = useSession((s) => s.reports) ?? [];
  const souqMail = useSession((s) => s.souqMail) ?? [];
  const deskReply = useSession((s) => s.deskReply);
  const readSouq = useSession((s) => s.readSouq);
  const issuePromo = useSession((s) => s.issuePromo);
  const closePromo = useSession((s) => s.closePromo);
  const extendStall = useSession((s) => s.extendStall);
  const deskRemoveReview = useSession((s) => s.deskRemoveReview);
  const [pane, setPane] = useState<Pane>("overview");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [plan, setPlan] = useState<PlanId>("basic");
  const [months, setMonths] = useState("3");
  const [uses, setUses] = useState("50");
  const [note, setNote] = useState("");
  const [openMail, setOpenMail] = useState("");
  const people = Object.values(accounts);
  const sellers = people.filter((item) => item.role === "seller");
  const buyers = people.filter((item) => item.role !== "seller");
  const openReports = reports.filter((item) => !item.removed);
  const unread = souqMail.filter((item) => !item.read).length;

  function unlock(event: FormEvent) {
    event.preventDefault();
    if (!enterDesk(pass)) setError(ar ? "الرمز غلط." : "That passcode is wrong.");
  }

  function createCode(event: FormEvent) {
    event.preventDefault();
    const result = issuePromo({
      code,
      plan,
      months: Math.max(1, Number(months) || 1),
      maxUses: Math.max(1, Number(uses) || 1),
      note: note.trim() || `${plan} for ${months} months`,
      noteAr: note.trim() || `${plan} لمدة ${months} أشهر`,
    });
    setError(result.ok ? "" : result.error === "taken" ? (ar ? "الرمز موجود." : "That code already exists.") : ar ? "الرمز قصير." : "Code is too short.");
    if (result.ok) setCode("");
  }

  if (!staff) {
    return (
      <Shell>
        <main className="mx-auto max-w-md px-4 py-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mute">{ar ? "سوق بطوطة" : "Souq Battuta"}</p>
          <h1 className="mt-2 font-display text-4xl">{ar ? "مكتب السوق" : "Souq desk"}</h1>
          <p className="mt-2 text-sm text-mute">{ar ? "هذا المكتب لإدارة السوق، مو للبائعين." : "This desk runs the souq. It is not the seller workstation."}</p>
          <form className="mt-6" onSubmit={unlock}>
            <label className="text-sm">
              {ar ? "رمز المكتب" : "Desk passcode"}
              <input value={pass} onChange={(event) => setPass(event.target.value)} type="password" className="mt-1 h-11 w-full rounded-md border border-line px-3" />
            </label>
            {error && <p className="mt-2 text-sm text-red">{error}</p>}
            <button type="submit" className="mt-4 h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">{ar ? "ادخل" : "Enter"}</button>
          </form>
        </main>
      </Shell>
    );
  }

  const tabs: { id: Pane; en: string; ar: string }[] = [
    { id: "overview", en: "Overview", ar: "نظرة" },
    { id: "inbox", en: "Inbox", ar: "الوارد" },
    { id: "codes", en: "Codes", ar: "الرموز" },
    { id: "stalls", en: "Stalls", ar: "الدكاكين" },
    { id: "reviews", en: "Reviews", ar: "التقييمات" },
    { id: "hello", en: "Hello, World!", ar: "Hello, World!" },
  ];

  return (
    <Shell>
      <main className="px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mute">{ar ? "سوق بطوطة" : "Souq Battuta"}</p>
            <h1 className="font-display text-4xl">{ar ? "مكتب السوق" : "Souq desk"}</h1>
          </div>
          <button type="button" className="h-10 rounded-md border border-line px-3 text-sm" onClick={leaveDesk}>{ar ? "خروج" : "Leave"}</button>
        </div>
        <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-sand p-1">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={`h-10 shrink-0 rounded-lg px-4 text-sm font-semibold ${pane === tab.id ? "bg-ink text-cream" : ""}`} onClick={() => setPane(tab.id)}>
              {ar ? tab.ar : tab.en}
              {tab.id === "reviews" && openReports.length > 0 && <span className="ms-2">{openReports.length}</span>}
              {tab.id === "inbox" && unread > 0 && <span className="ms-2">{unread}</span>}
            </button>
          ))}
        </div>

        {pane === "overview" && (
          <section className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              [ar ? "المشترون" : "Buyers", buyers.length],
              [ar ? "الدكاكين" : "Stalls", sellers.length],
              [ar ? "رموز مفتوحة" : "Open codes", promoCodes.filter((item) => !item.closed).length],
              [ar ? "بلاغات" : "Open reports", openReports.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-line bg-cream p-4">
                <p className="text-xs uppercase tracking-wide text-mute">{label}</p>
                <p className="mt-2 font-display text-3xl">{value}</p>
              </div>
            ))}
          </section>
        )}

        {pane === "hello" && <HelloDesk />}

        {pane === "inbox" && (
          <section className="mt-6 grid gap-4 lg:grid-cols-[18rem_1fr]">
            <ul className="divide-y divide-line rounded-xl border border-line bg-white">
              {souqMail.length === 0 && <li className="p-4 text-sm text-mute">{ar ? "ما في رسائل." : "No messages yet."}</li>}
              {souqMail.map((item) => (
                <li key={item.id}>
                  <button type="button" className={`block w-full px-4 py-3 text-start ${openMail === item.id ? "bg-sand" : ""}`} onClick={() => { setOpenMail(item.id); readSouq(item.id); }}>
                    <b className="block">{item.fromName}</b>
                    <span className="block text-xs text-mute">{item.role === "seller" ? (ar ? "بائع" : "Seller") : ar ? "مشتري" : "Buyer"}{item.read ? "" : " ·"}</span>
                    <span className="block truncate text-sm">{item.body}</span>
                  </button>
                </li>
              ))}
            </ul>
            {souqMail.find((item) => item.id === openMail) && (
              <form
                className="rounded-xl border border-line bg-white p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = String(new FormData(event.currentTarget).get("body") ?? "");
                  deskReply(openMail, body);
                  event.currentTarget.reset();
                }}
              >
                <p className="text-sm text-mute">{souqMail.find((item) => item.id === openMail)?.fromName}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{souqMail.find((item) => item.id === openMail)?.body}</p>
                <textarea name="body" required rows={4} className="mt-4 w-full rounded-md border border-line px-3 py-2" placeholder={ar ? "رد من الموقع" : "Reply on the site"} />
                <button type="submit" className="mt-3 h-10 rounded-md bg-ink px-4 text-sm font-semibold text-cream">{ar ? "أرسل الرد" : "Send reply"}</button>
              </form>
            )}
          </section>
        )}

        {pane === "codes" && (
          <section className="mt-6 grid gap-4 lg:grid-cols-[18rem_1fr]">
            <form className="rounded-xl border border-line bg-white p-4" onSubmit={createCode}>
              <p className="font-semibold">{ar ? "رمز جديد" : "New code"}</p>
              <label className="mt-3 block text-sm">{ar ? "الرمز" : "Code"}<input value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
              <label className="mt-3 block text-sm">
                {ar ? "الخطة" : "Plan"}
                <select value={plan} onChange={(event) => setPlan(event.target.value as PlanId)} className="mt-1 h-11 w-full rounded-md border border-line px-3">
                  {(Object.keys(PLANS) as PlanId[]).map((id) => <option key={id} value={id}>{PLANS[id].name}</option>)}
                </select>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-sm">{ar ? "أشهر" : "Months"}<input value={months} onChange={(event) => setMonths(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
                <label className="text-sm">{ar ? "حد" : "Uses"}<input value={uses} onChange={(event) => setUses(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
              </div>
              <label className="mt-3 block text-sm">{ar ? "ملاحظة" : "Note"}<input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" /></label>
              {error && <p className="mt-2 text-sm text-red">{error}</p>}
              <button type="submit" className="mt-4 h-11 w-full rounded-md bg-ink text-sm font-semibold text-cream">{ar ? "أصدر الرمز" : "Issue code"}</button>
            </form>
            <ul className="divide-y divide-line rounded-xl border border-line bg-white">
              {promoCodes.map((item) => {
                const used = redemptions.filter((row) => row.code.toLowerCase() === item.code.toLowerCase()).length;
                return (
                  <li key={item.code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span>
                      <b className="block">{item.code}</b>
                      <span className="text-sm text-mute">{PLANS[item.plan].name} · {item.months} {ar ? "شهر" : "mo"} · {used}/{item.maxUses}{item.closed ? (ar ? " · مقفل" : " · Closed") : ""}</span>
                    </span>
                    <button type="button" className="h-9 rounded-md border border-line px-3 text-xs" onClick={() => closePromo(item.code)}>{item.closed ? (ar ? "افتح" : "Reopen") : ar ? "اقفل" : "Close"}</button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {pane === "stalls" && (
          <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
            {sellers.length === 0 && <li className="p-4 text-sm text-mute">{ar ? "ما في دكاكين." : "No stalls yet."}</li>}
            {sellers.map((seller) => {
              const slug = slugForSeller(seller);
              const used = seller.sellerCode ? countCodeUses(accounts, seller.sellerCode) : 0;
              const standing = campaignStanding(used);
              return (
                <li key={seller.phone} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <Link to="/shop/$slug" params={{ slug }} className="font-semibold underline">{seller.displayName || seller.username}</Link>
                    <span className="mt-1 block text-sm text-mute">
                      {PLANS[seller.sellerPlan ?? "free"].name} · {daysLeft(seller.planEnds)} {ar ? "يوم" : "days"} · {seller.sellerCode || (ar ? "بدون رمز" : "No code")} · {used} {ar ? "مستخدم" : "used"}
                      {standing.next ? ` · ${standing.left} ${ar ? "للجاي" : "to next"}` : ""}
                    </span>
                  </span>
                  <button type="button" className="h-9 rounded-md bg-ink px-3 text-xs font-semibold text-cream" onClick={() => extendStall(seller.phone, 1)}>{ar ? "زيد شهر" : "Add 1 month"}</button>
                </li>
              );
            })}
          </ul>
        )}

        {pane === "reviews" && (
          <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
            {reports.length === 0 && <li className="p-4 text-sm text-mute">{ar ? "ما في بلاغات." : "No reports yet."}</li>}
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <b className="block text-sm">{report.key}</b>
                  <span className="mt-1 block text-sm text-mute">{report.comment}</span>
                </span>
                {report.removed ? (
                  <span className="text-xs text-mute">{ar ? "انشال" : "Removed"}</span>
                ) : (
                  <button type="button" className="h-9 rounded-md bg-ink px-3 text-xs font-semibold text-cream" onClick={() => deskRemoveReview(report.key)}>{ar ? "شيل التقييم" : "Remove review"}</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </Shell>
  );
}
