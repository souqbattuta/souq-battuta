import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { shopBySlug, type Shop } from "@/lib/data";
import { billingPhase, publicProduct, publicSocials, sellerByPublicSlug, stallHoursLabel, stallIsOpen, useSession, type BuyerAccount, type SellerListing } from "@/lib/session";
import { Shell } from "@/components/site-header";
import { ShopView } from "@/components/shop-page";

function ownedShop(slug: string, accounts: Record<string, BuyerAccount>, listings: SellerListing[], reviewReplies: Record<string, string> = {}): Shop | null {
  const account = sellerByPublicSlug(slug, accounts);
  if (!account || shopBySlug(slug)) return null;
  const premium = account.sellerPlan === "premium";
  const products = [...(account.listings ?? []), ...listings.filter((item) => item.shopSlug === slug || item.shopSlug === account.shopSlug)]
    .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
    .map((item) => publicProduct(item, premium))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return {
    slug,
    name: account.displayName || account.username,
    nameAr: account.displayName || account.username,
    area: account.city || "Amman",
    areaAr: account.city || "عمّان",
    category: "misc",
    plan: account.sellerPlan ?? "free",
    phone: "+962795636663",
    avatar: account.sellerPlan === "free" ? "/brand/avatars/seller-duck.jpg?v=2" : account.stallAvatar || "/brand/avatars/default-duck.jpg",
    cover: account.stallCover,
    bio: account.stallBio,
    bioAr: account.stallBioAr || account.stallBio,
    hours: stallHoursLabel(account),
    isOpen: stallIsOpen(account),
    contactWhenClosed: account.contactWhenClosed !== false,
    allowSellerMail: (account.sellerPlan === "grow" || account.sellerPlan === "premium") && account.allowSellerMail,
    openNote: account.openNote,
    openNoteAr: account.openNoteAr,
    closedNote: account.closedNote,
    closedNoteAr: account.closedNoteAr,
    socials: publicSocials(account),
    views: account.sellerPlan && account.sellerPlan !== "free" ? account.stallViews ?? 0 : undefined,
    askQty: account.askQty,
    products,
    reviews: (account.stallReviews ?? []).map((review, index) => ({
      ...review,
      reply: reviewReplies[`${slug}:${index}`] ?? review.reply,
    })),
    mode: "inquire",
    km: 0,
  };
}

export function ShopPage({ slug }: { slug: string }) {
  const accounts = useSession((s) => s.accounts);
  const listings = useSession((s) => s.listings);
  const reviewReplies = useSession((s) => s.reviewReplies);
  const shop = useMemo(() => {
    const base = shopBySlug(slug);
    const owner = sellerByPublicSlug(slug, accounts);
    if (owner && billingPhase(owner) === "paused" && !base) return null;
    if (!base) return ownedShop(slug, accounts, listings ?? [], reviewReplies ?? {});
    const premium = owner?.sellerPlan === "premium";
    const extra = (listings ?? [])
      .filter((item) => item.shopSlug === slug)
      .map((item) => publicProduct(item, Boolean(premium)))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const reviews = (base.reviews ?? []).map((review, index) => ({
      ...review,
      reply: reviewReplies?.[`${slug}:${index}`] ?? review.reply,
    }));
    return {
      ...base,
      products: [...extra, ...base.products],
      reviews,
      ...(owner
        ? {
            avatar: owner.sellerPlan === "free" ? "/brand/avatars/seller-duck.jpg?v=2" : owner.stallAvatar || base.avatar,
            cover: owner.stallCover || base.cover,
            isOpen: stallIsOpen(owner),
            hours: stallHoursLabel(owner) || base.hours,
            contactWhenClosed: owner.contactWhenClosed !== false,
            allowSellerMail: (owner.sellerPlan === "grow" || owner.sellerPlan === "premium") && owner.allowSellerMail,
            openNote: owner.openNote,
            openNoteAr: owner.openNoteAr,
            closedNote: owner.closedNote,
            closedNoteAr: owner.closedNoteAr,
            socials: publicSocials(owner) ?? base.socials,
          }
        : {}),
    };
  }, [accounts, listings, reviewReplies, slug]);
  const ensureDirectory = useSession((s) => s.ensureDirectory);
  const bumpStallViews = useSession((s) => s.bumpStallViews);
  const noteVisit = useSession((s) => s.noteVisit);
  useEffect(() => {
    ensureDirectory();
  }, [ensureDirectory]);
  const viewer = useSession((s) => s.user?.shopSlug);
  useEffect(() => {
    if (!shop || viewer === slug || typeof window === "undefined") return;
    noteVisit(slug);
    const key = `viewed:${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    bumpStallViews(slug);
  }, [bumpStallViews, noteVisit, shop, slug, viewer]);
  if (!shop) {
    return (
      <Shell>
        <main className="px-6 py-16">
          <h1 className="font-display text-2xl">Stall not found</h1>
          <Link to="/home" className="mt-4 inline-block underline">
            Back home
          </Link>
        </main>
      </Shell>
    );
  }
  return (
    <Shell>
      <ShopView shop={shop} />
      <SellerMail shop={shop} />
    </Shell>
  );
}

function ShopRoute() {
  const { slug } = Route.useParams();
  const hash = useRouterState({ select: (state) => state.location.hash });
  useEffect(() => {
    const id = hash.replace("#", "");
    if (!id) return;
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "center" }), 120);
    return () => window.clearTimeout(timer);
  }, [hash, slug]);
  return <ShopPage slug={slug} />;
}

export const Route = createFileRoute("/shop/$slug")({ component: ShopRoute });

function SellerMail({ shop }: { shop: Shop }) {
  const user = useSession((s) => s.user);
  const lang = useSession((s) => s.lang);
  const sendSellerMessage = useSession((s) => s.sendSellerMessage);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  if (!user || user.role !== "seller" || (user.sellerPlan !== "grow" && user.sellerPlan !== "premium") || user.shopSlug === shop.slug || !shop.allowSellerMail) return null;
  const ar = lang === "ar";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get("body") ?? "");
    const res = sendSellerMessage(shop.slug, body);
    if (!res.ok) {
      setSent(false);
      setError(res.error === "closed" ? (ar ? "هذا الدكان ما بيقبل رسائل." : "This stall is not taking seller messages.") : ar ? "اكتب رسالة." : "Write a message.");
      return;
    }
    setError("");
    setSent(true);
    event.currentTarget.reset();
  }

  return (
    <form className="mx-auto mb-12 w-full max-w-3xl px-4" onSubmit={onSubmit}>
      <h2 className="font-display text-2xl">{ar ? "راسل الدكان" : "Message this stall"}</h2>
      <p className="mt-1 text-sm text-mute">{ar ? "من بائع لبائع، داخل سوق بطوطة." : "Seller to seller, inside Souq Battuta."}</p>
      <textarea name="body" required rows={3} className="mt-3 w-full rounded-md border border-line bg-white px-3 py-2" />
      <button type="submit" className="mt-2 h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">
        {ar ? "إرسال" : "Send"}
      </button>
      {sent && <p className="mt-2 text-sm text-stamp-green">{ar ? "وصلت للوارد." : "Sent to their inbox."}</p>}
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </form>
  );
}
