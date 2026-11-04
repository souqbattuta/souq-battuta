// @ts-nocheck
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { HELLO_CAP, ammanDay, billedLength, normalizeHandles, toHandle } from "./hello";
import { DEFAULT_ALGO_ORDER, WORD_CAP, algoOrder, shopMuted, shopText } from "./shelves";
export type BookmarkList = any;
export type BuyerAccount = any;
export type FollowedList = any;
export type SavedAddress = any;
export type BuyerOrder = any;
export type MailThread = any;
export type OptionSet = any;
export type SocialNetwork = any;
export type StallSocial = any;
export type SellerListing = any;
import { claimSouq, patchSouqOrder, placeSouqOrder, recordShopView, saveSouqListing, saveSouqReview, sendSouqOtp, setSouqSignupPlan, signOutSouq, stageSouqSignup, uploadListingImage, verifySouqOtp } from "@/lib/souq-sync";
import { freePhotoQuota, hydrateImages, offloadImages } from "./image-store";
import { PLANS, SHOPS } from "./data";
import { checkPromo, PROMO_CODES } from "./promo-codes";
import { campaignStanding, mintSellerCode } from "./seller-campaign";
const NAME_HOLD_MS = 30 * 24 * 60 * 60 * 1e3;
function socialVerifyCode(phone) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let n = 2166136261;
  for (const ch of phone) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  let body = "";
  let x = n >>> 0;
  for (let i = 0; i < 4; i += 1) {
    body += alphabet[x % alphabet.length];
    x = Math.floor(x / alphabet.length) || (x + 17) * 33 >>> 0;
  }
  return `SB-${body}`;
}
function publicSocials(account) {
  if (!account?.sellerPlan || account.sellerPlan === "free") return void 0;
  const rows = (account.stallSocials ?? []).filter((item) => item.verified && item.href.trim());
  if (!rows.length) return void 0;
  return rows.map((item) => ({
    label: { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", snapchat: "Snapchat", youtube: "YouTube" }[item.network],
    href: item.href.trim()
  }));
}
function mailId(a, b) {
  return [a, b].sort().join("|");
}
function pair(a, b) {
  return [a, b].sort();
}
function upsertThread(mail, next) {
  const found = mail.find((thread) => thread.id === next.id);
  if (!found) return [next, ...mail];
  const known = new Set(found.lines.map((line) => line.id));
  return mail.map(
    (thread) => thread.id === next.id ? { ...found, names: { ...found.names, ...next.names }, lines: [...found.lines, ...next.lines.filter((line) => !known.has(line.id))] } : thread
  );
}
function cleanChoices(choices) {
  const next = (choices ?? []).map((choice) => ({
    en: choice.en.trim(),
    ar: choice.ar.trim() || choice.en.trim(),
    options: choice.options.map((option) => ({
      en: option.en.trim(),
      ar: option.ar.trim() || option.en.trim(),
      extra: Math.max(0, Number(option.extra) || 0),
      off: Boolean(option.off),
      reason: option.off ? option.reason : void 0,
      back: option.off ? option.back : void 0
    })).filter((option) => option.en.length > 0)
  })).filter((choice) => choice.en.length > 1 && choice.options.length > 0);
  return next.length ? next : void 0;
}
const ARAB_DIAL = [
  { code: "213", min: 8, max: 9 },
  { code: "973", min: 8, max: 8 },
  { code: "269", min: 7, max: 7 },
  { code: "253", min: 8, max: 8 },
  { code: "212", min: 9, max: 9 },
  { code: "216", min: 8, max: 8 },
  { code: "218", min: 8, max: 9 },
  { code: "222", min: 8, max: 8 },
  { code: "249", min: 9, max: 9 },
  { code: "252", min: 7, max: 8 },
  { code: "961", min: 7, max: 8 },
  { code: "962", min: 9, max: 9, mobile: /^7\d{8}$/ },
  { code: "963", min: 8, max: 9 },
  { code: "964", min: 10, max: 10 },
  { code: "965", min: 8, max: 8 },
  { code: "966", min: 9, max: 9, mobile: /^5\d{8}$/ },
  { code: "967", min: 9, max: 9 },
  { code: "968", min: 8, max: 8 },
  { code: "970", min: 8, max: 9 },
  { code: "971", min: 8, max: 9, mobile: /^5\d{7,8}$/ },
  { code: "974", min: 8, max: 8 },
  { code: "20", min: 10, max: 10, mobile: /^1\d{9}$/ }
].sort((a, b) => b.code.length - a.code.length);
function normalizePhone(raw) {
  let text = raw.trim().replace(/[\s().-]/g, "");
  if (text.startsWith("00")) text = `+${text.slice(2)}`;
  if (text.startsWith("+")) {
    const digits2 = text.slice(1).replace(/\D/g, "");
    return digits2 ? `+${digits2}` : "";
  }
  const digits = text.replace(/\D/g, "");
  if (/^07\d{8}$/.test(digits)) return `+962${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `+962${digits}`;
  return digits ? `+${digits}` : "";
}
function isValidArabPhone(raw) {
  const phone = normalizePhone(raw);
  if (!phone.startsWith("+")) return false;
  const digits = phone.slice(1);
  const rule = ARAB_DIAL.find((item) => digits.startsWith(item.code));
  if (!rule) return false;
  const national = digits.slice(rule.code.length);
  if (national.length < rule.min || national.length > rule.max) return false;
  if (rule.mobile && !rule.mobile.test(national)) return false;
  return true;
}
function isValidJoPhone(raw) {
  return /^\+9627\d{8}$/.test(normalizePhone(raw));
}
function slugForSeller(user) {
  const owned = SHOPS.find((shop) => shop.phone === user.phone);
  if (owned) return owned.slug;
  if (user.shopSlug && !SHOPS.some((shop) => shop.slug === user.shopSlug)) return user.shopSlug;
  return `stall-${user.phone.replace(/\D/g, "").slice(-9)}`;
}
function nameSlug(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}.-]+/gu, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function shareSlug(user, accounts) {
  const pretty = nameSlug(user.username);
  if (pretty.length < 2) return slugForSeller(user);
  const clash = accounts ? Object.values(accounts).some((item) => item.phone !== user.phone && item.role === "seller" && nameSlug(item.username) === pretty) : false;
  if (!clash) return pretty;
  return `${pretty}-${user.phone.replace(/\D/g, "").slice(-4)}`;
}
function sellerByPublicSlug(slug, accounts) {
  let key = slug;
  try {
    key = decodeURIComponent(slug);
  } catch {
    key = slug;
  }
  key = key.trim().toLowerCase();
  return Object.values(accounts).find((account) => {
    if (account.role !== "seller") return false;
    if (account.shopSlug === slug || slugForSeller(account) === slug || shareSlug(account, accounts) === key) return true;
    return (account.heldUsernames ?? []).some((held) => held.until > Date.now() && nameSlug(held.name) === key);
  });
}
function publicProduct(item, premium) {
  if (item.hidden && !premium) return null;
  const { shopSlug: _shop, hidden, ...product } = item;
  if (!hidden) return product;
  return { ...product, paused: true, hideReason: item.hideReason ?? "unavailable", hideBack: item.hideBack };
}
function livePromotions(accounts) {
  const month = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  return Object.values(accounts).flatMap(
    (account) => (account.promotions ?? []).filter((promo) => new Date(promo.at).toISOString().slice(0, 7) === month).map((promo) => ({ promo, slug: slugForSeller(account) }))
  ).sort((a, b) => b.promo.at - a.promo.at);
}
function directoryShops(accounts) {
  const extras = [];
  for (const account of Object.values(accounts)) {
    if (account.role !== "seller") continue;
    const slug = slugForSeller(account);
    if (SHOPS.some((shop) => shop.slug === slug)) continue;
    const products = (account.listings ?? []).filter((item) => item.shopSlug === slug || item.shopSlug === account.shopSlug).map((item) => publicProduct(item, account.sellerPlan === "premium")).filter((item) => Boolean(item));
    const reviews = account.stallReviews ?? [];
    const rating = reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length * 10) / 10 : void 0;
    const blob = products.map((product) => `${product.name} ${product.desc}`).join(" ").toLowerCase();
    const category = account.categories?.[0] ?? (/knafeh|maqluba|manakish|kaak|food|bread/.test(blob) ? "food" : "misc");
    const joined = account.joinedAt ? new Date(account.joinedAt) : null;
    extras.push({
      slug,
      name: account.displayName || account.username,
      nameAr: account.displayName || account.username,
      area: account.city || "Amman",
      areaAr: account.city === "Amman" || !account.city ? "\u0639\u0645\u0651\u0627\u0646" : account.city,
      category,
      categories: (account.categories?.length ? account.categories : [category]).slice(0, 2),
      plan: account.sellerPlan ?? "free",
      phone: "+962795636663",
      avatar: (account.sellerPlan ?? "free") === "free" ? "/brand/avatars/seller-duck.jpg?v=2" : account.stallAvatar || products[0]?.images[0] || "/brand/avatars/seller-duck.jpg?v=2",
      cover: account.stallCover || products[0]?.images[0],
      bio: account.stallBio,
      bioAr: account.stallBioAr || account.stallBio,
      hours: stallHoursLabel(account),
      isOpen: stallIsOpen(account),
      contactWhenClosed: account.contactWhenClosed !== false,
      views: account.stallViews ?? 0,
      likes: Object.values(accounts).filter((item) => (item.pageLikes ?? []).includes(slug)).length,
      rating,
      reviewCount: reviews.length,
      since: joined ? joined.toLocaleString("en", { month: "short", year: "numeric" }) : void 0,
      products,
      reviews,
      askQty: account.askQty,
      mode: account.sellerPlan === "grow" || account.sellerPlan === "premium" ? "both" : "inquire",
      handoff: "both",
      openNote: account.openNote,
      openNoteAr: account.openNoteAr,
      closedNote: account.closedNote,
      closedNoteAr: account.closedNoteAr,
      keywords: account.findWords,
      socials: publicSocials(account),
      km: 0
    });
  }
  return [...extras, ...SHOPS];
}
function alertNotes(get, words) {
  const ar = get().lang === "ar";
  const existing = new Set((get().notes ?? []).map((note) => note.id));
  const mutedWords = get().mutedWords ?? [];
  const mutedStalls = get().mutedStalls ?? [];
  const shops = directoryShops(get().accounts);
  const notes = [];
  for (const word of words) {
    const clean = String(word ?? "").trim().toLowerCase();
    if (clean.length < 2) continue;
    for (const shop of shops) {
      if (notes.length >= 12) return notes;
      const id = `alert-${shop.slug}-${clean}`;
      if (existing.has(id) || shopMuted(shop, mutedWords, mutedStalls)) continue;
      if (!shopText(shop).includes(clean)) continue;
      existing.add(id);
      const name = ar ? shop.nameAr : shop.name;
      notes.push({
        id,
        title: name,
        body: ar ? `طلبت خبر لما تطلع «${clean}». ${name} فيها.` : `You asked to be told when “${clean}” shows up. ${name} has it.`,
        href: `/shop/${shop.slug}`,
        at: Date.now(),
      });
    }
  }
  return notes;
}
const STALL_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function minutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}
function stallIsOpen(stall, now = /* @__PURE__ */ new Date()) {
  if (stall.stallForce === "open") return true;
  if (stall.stallForce === "closed") return false;
  const opens = minutes(stall.stallOpens);
  const closes = minutes(stall.stallCloses);
  if (opens == null || closes == null) return stall.stallOpen !== false;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Amman", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((part) => [part.type, part.value])
  );
  const day = (parts.weekday ?? "Sat").slice(0, 3).toLowerCase();
  const days = (stall.stallDays || STALL_DAYS.join(",")).split(",").filter(Boolean);
  if (!days.includes(day)) return false;
  const clock = Number(parts.hour) * 60 + Number(parts.minute);
  if (closes === opens) return true;
  if (closes > opens) return clock >= opens && clock < closes;
  return clock >= opens || clock < closes;
}
function stallHoursLabel(stall) {
  if (!stall.stallOpens || !stall.stallCloses) return stall.stallHours || "";
  const days = (stall.stallDays || "").split(",").filter(Boolean);
  const names = days.map((day) => day.slice(0, 1).toUpperCase() + day.slice(1, 3)).join(" ");
  return `${names ? `${names} \xB7 ` : ""}${stall.stallOpens}\u2013${stall.stallCloses}`;
}
function isValidUsername(name) {
  return /^[\p{L}\p{N}.]{4,24}$/u.test(name.trim());
}
function isValidSellerUsername(name) {
  const value = name.trim().replace(/\s+/g, " ");
  if (value.length < 2 || value.length > 40) return false;
  if (!/[\p{L}\p{N}]/u.test(value)) return false;
  return /^[\p{L}\p{N}\p{P}\p{S} ]+$/u.test(value);
}
function nameKey(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
const BRAND_LETTER: Record<string, string> = {
  ا: "a", أ: "a", إ: "a", آ: "a", ٱ: "a", ء: "", ئ: "i", ؤ: "o",
  ب: "b", ت: "t", ث: "t", ج: "j", ح: "h", خ: "h",
  د: "d", ذ: "d", ر: "r", ز: "z", س: "s", ش: "s", ص: "s", ض: "d",
  ط: "t", ظ: "z", ع: "a", غ: "g", ف: "f", ق: "q", ك: "k", ل: "l",
  م: "m", ن: "n", ه: "h", ة: "a", و: "o", ى: "a", ي: "i",
};
function isReservedBrand(name) {
  let raw = name.trim().toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
  raw = raw.replace(/[0٠]/g, "o").replace(/[1١]/g, "i").replace(/[3٣]/g, "e").replace(/[4٤]/g, "a").replace(/[5٥]/g, "s").replace(/[7٧]/g, "t");
  let folded = "";
  for (const ch of raw) folded += BRAND_LETTER[ch] ?? ch;
  const skeleton = folded.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
  const hasSouq = /s[ou]{1,2}[qk]/.test(skeleton);
  const hasBattuta = /b[aou]?t[ou]{0,2}t[aeiouh]{0,2}/.test(skeleton);
  return hasSouq && hasBattuta;
}
function stallNameTaken(name, accounts, exceptPhone) {
  if (isReservedBrand(name)) return true;
  const key = nameKey(name);
  if (key.length < 2) return false;
  return Object.values(accounts).some((account) => account.role === "seller" && account.phone !== exceptPhone && nameKey(account.displayName || "") === key);
}
function usernameTaken(name, accounts, exceptPhone, now = Date.now()) {
  if (isReservedBrand(name)) return true;
  const key = nameKey(name);
  if (!key) return false;
  return Object.values(accounts).some((account) => {
    if (account.phone === exceptPhone) return false;
    if (nameKey(account.username) === key) return true;
    return (account.heldUsernames ?? []).some((held) => held.until > now && nameKey(held.name) === key);
  });
}
function toUser(account) {
  return {
    phone: account.phone,
    username: account.username,
    displayName: account.displayName,
    city: account.city,
    bio: account.bio,
    address: account.address,
    role: account.role,
    friendsOfBattuta: account.friendsOfBattuta,
    referredBy: account.referredBy,
    sellerPlan: account.sellerPlan,
    shopSlug: account.shopSlug,
    whatsappPhone: account.whatsappPhone,
    stallOpen: account.stallOpen,
    stallHours: account.stallHours,
    stallOpens: account.stallOpens,
    stallCloses: account.stallCloses,
    stallDays: account.stallDays,
    stallForce: account.stallForce,
    contactWhenClosed: account.contactWhenClosed,
    stallBio: account.stallBio,
    stallBioAr: account.stallBioAr,
    stallAvatar: account.stallAvatar,
    stallCover: account.stallCover,
    openNote: account.openNote,
    openNoteAr: account.openNoteAr,
    closedNote: account.closedNote,
    closedNoteAr: account.closedNoteAr,
    askQty: account.askQty,
    stallViews: account.stallViews,
    joinedAt: account.joinedAt,
    planEnds: account.planEnds,
    categories: account.categories,
    promoCode: account.promoCode,
    promoMonths: account.promoMonths,
    areaLat: account.areaLat,
    areaLng: account.areaLng,
    sellerCode: account.sellerCode,
    campaignMonths: account.campaignMonths,
    usernameHistory: account.usernameHistory ?? [],
    usernameChanges: account.usernameChanges ?? [],
    shareLikes: account.shareLikes === true,
    shareBookmarks: account.shareBookmarks === true
  };
}
const PROFANITY = ["fuck", "shit", "bitch", "asshole", "\u0643\u0633", "\u0634\u0631\u0645\u0648\u0637", "\u0639\u0631\u0635"];
function hasProfanity(text) {
  const n = text.toLowerCase();
  return PROFANITY.some((word) => n.includes(word));
}
const SELLER_WELCOME = "Hala from Souq Battuta.\n\u0647\u0644\u0627 \u0645\u0646 \u0633\u0648\u0642 \u0628\u0637\u0648\u0637\u0629.\n\nYour stall is on the souq. You keep what you earn. When someone orders, it goes straight to your WhatsApp.\n\n\u062F\u0643\u0627\u0646\u0643 \u0639\u0644\u0649 \u0627\u0644\u0633\u0648\u0642. \u0627\u0644\u0631\u0628\u062D \u0625\u0644\u0643. \u0644\u0645\u0627 \u062D\u062F\u0627 \u064A\u0637\u0644\u0628\u060C \u0627\u0644\u0637\u0644\u0628 \u064A\u0648\u0635\u0644 \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u0643.\n\nEvery plan can write to Souq Battuta from this inbox. We only write back here, on the site. We never contact you on WhatsApp or any other app, and we never ask for private information there.\n\n\u0643\u0644 \u0627\u0644\u062E\u0637\u0637 \u062A\u0642\u062F\u0631 \u062A\u0631\u0627\u0633\u0644 \u0633\u0648\u0642 \u0628\u0637\u0648\u0637\u0629 \u0645\u0646 \u0647\u0627\u0644\u0648\u0627\u0631\u062F. \u0645\u0646\u0631\u062F \u0628\u0633 \u0645\u0646 \u0627\u0644\u0645\u0648\u0642\u0639. \u0645\u0627 \u0645\u0646\u0631\u0627\u0633\u0644\u0643 \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648 \u0623\u064A \u062A\u0637\u0628\u064A\u0642 \u062B\u0627\u0646\u064A\u060C \u0648\u0645\u0627 \u0645\u0646\u0637\u0644\u0628 \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0646 \u0647\u0646\u0627\u0643.";
const BUYER_WELCOME = {
  id: "souq-welcome",
  title: "Hala from Souq Battuta",
  body: "\u0647\u0644\u0627 \u0645\u0646 \u0633\u0648\u0642 \u0628\u0637\u0648\u0637\u0629.\nHala from Souq Battuta.\n\nThis is your inbox. Press Contact to write to Souq Battuta.\n\n\u0627\u0636\u063A\u0637 \u062A\u0648\u0627\u0635\u0644 \u0639\u0634\u0627\u0646 \u062A\u0631\u0627\u0633\u0644 \u0633\u0648\u0642 \u0628\u0637\u0648\u0637\u0629. \u0645\u0646\u0631\u062F \u0628\u0633 \u0645\u0646 \u0627\u0644\u0645\u0648\u0642\u0639. \u0645\u0627 \u0645\u0646\u0631\u0627\u0633\u0644\u0643 \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648 \u0623\u064A \u062A\u0637\u0628\u064A\u0642 \u062B\u0627\u0646\u064A\u060C \u0648\u0645\u0627 \u0645\u0646\u0637\u0644\u0628 \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0646 \u0647\u0646\u0627\u0643.\n\nWe only reply on this site. We never contact you on WhatsApp or any other app, and we never ask for your private information there."
};
function welcomeNote(at = Date.now()) {
  return { id: BUYER_WELCOME.id, title: BUYER_WELCOME.title, body: BUYER_WELCOME.body, at };
}
function buyerLists(account) {
  return {
    addresses: account?.addresses ?? [],
    interestWords: account?.interestWords ?? [],
    alertWords: account?.alertWords ?? [],
    mutedWords: account?.mutedWords ?? [],
    mutedStalls: account?.mutedStalls ?? [],
    dismissedSuggestions: account?.dismissedSuggestions ?? [],
    notes: account?.notes ?? [],
    restocks: account?.restocks ?? [],
    orders: account?.orders ?? [],
    ownReviews: account?.ownReviews ?? [],
    reviewVotes: account?.reviewVotes ?? {},
    removedReviews: account?.removedReviews ?? [],
    listings: account?.listings ?? [],
    reviewReplies: account?.reviewReplies ?? {},
    sellerSeen: account?.sellerSeen ?? [],
    sellerCleared: account?.sellerCleared ?? [],
    sellerHistory: account?.sellerHistory ?? [],
    helloHearts: account?.helloHearts ?? [],
    algoOrder: account?.algoOrder ?? DEFAULT_ALGO_ORDER,
    sharedSlugs: account?.sharedSlugs ?? []
  };
}
function buyerPack(s) {
  return {
    addresses: s.addresses,
    interestWords: s.interestWords,
    alertWords: s.alertWords,
    mutedWords: s.mutedWords ?? [],
    mutedStalls: s.mutedStalls ?? [],
    dismissedSuggestions: s.dismissedSuggestions ?? [],
    notes: s.notes,
    restocks: s.restocks,
    orders: s.orders,
    ownReviews: s.ownReviews,
    reviewVotes: s.reviewVotes,
    removedReviews: s.removedReviews,
    favorites: s.favorites,
    bookmarks: s.bookmarks,
    bookmarkLists: s.bookmarkLists,
    followedLists: s.followedLists,
    follows: s.follows,
    pageLikes: s.pageLikes,
    listings: s.listings,
    reviewReplies: s.reviewReplies,
    sellerSeen: s.sellerSeen,
    sellerCleared: s.sellerCleared,
    sellerHistory: s.sellerHistory,
    helloHearts: s.helloHearts ?? [],
    algoOrder: s.algoOrder ?? DEFAULT_ALGO_ORDER,
    sharedSlugs: s.sharedSlugs ?? []
  };
}
function withBuyer(get, set, patch) {
  const s = get();
  const phone = s.user?.phone;
  const prev = phone ? s.accounts[phone] : void 0;
  set({
    ...patch,
    accounts: prev && phone ? {
      ...s.accounts,
      [phone]: {
        ...prev,
        ...buyerPack({ ...s, ...patch }),
        username: patch.user?.username ?? prev.username,
        displayName: patch.user?.displayName || prev.displayName,
        city: patch.user?.city ?? prev.city,
        bio: patch.user?.bio ?? prev.bio,
        address: patch.user?.address ?? prev.address
      }
    } : s.accounts
  });
}
const useSession = create()(
  persist(
    (set, get) => ({
      lang: "en",
      user: null,
      pending: null,
      accounts: {},
      favorites: [],
      bookmarks: [],
      bookmarkLists: [],
      followedLists: [],
      follows: [],
      pageLikes: [],
      listings: [],
      mail: [],
      reviewReplies: {},
      sellerSeen: [],
      sellerCleared: [],
      sellerHistory: [],
      waTaps: {},
      recentSlugs: [],
      visitCounts: {},
      addresses: [],
      interestWords: [],
      alertWords: [],
      mutedWords: [],
      mutedStalls: [],
      dismissedSuggestions: [],
      helloHearts: [],
      helloHandles: [],
      algoOrder: DEFAULT_ALGO_ORDER,
      sharedSlugs: [],
      notes: [],
      restocks: [],
      orders: [],
      ownReviews: [],
      reviewVotes: {},
      removedReviews: [],
      promoRedemptions: [],
      promoCodes: PROMO_CODES,
      staff: false,
      reports: [],
      souqMail: [],
      setLang: (lang) => set({ lang }),
      startJoin: async (p) => {
        const phone = normalizePhone(p.phone);
        const pending = { ...p, phone };
        delete pending.password;
        set({ pending });
        const profile = {
          username: String(p.username || phone.slice(-4)).trim(),
          displayName: p.displayName,
          city: p.city,
          address: p.address,
          bio: p.bio,
          intent: p.intent === "seller" ? "seller" : "buyer",
          plan: p.plan,
          categories: p.categories,
          promoCode: p.promoCode,
          areaLat: p.areaLat,
          areaLng: p.areaLng,
          referral: p.referral
        };
        if (p.password) {
          const staged = await stageSouqSignup({ data: { phone, password: p.password, profile } });
          if (!staged.ok) return staged;
        }
        if (p.intent === "seller") {
          await setSouqSignupPlan({ data: { phone, plan: p.plan, promoCode: p.promoCode, categories: p.categories } });
        }
        return sendSouqOtp({ data: { phone } });
      },
      completeJoin: async (otp) => {
        const pending = get().pending;
        if (!pending) return { ok: false, error: "otp" };
        const code = String(otp).replace(/\s/g, "");
        const res = await verifySouqOtp({ data: { phone: pending.phone, code } });
        if (!res.ok) return res;
        const account = { ...res.account, usernameHistory: [], notes: res.account.role === "seller" ? void 0 : [welcomeNote()] };
        delete account.password;
        const user = toUser(account);
        set({
          user,
          pending: null,
          accounts: { ...get().accounts, [account.phone]: account },
          notes: account.role === "buyer" ? account.notes ?? [] : get().notes
        });
        return { ok: true };
      },
      signIn: async (phone, password, asRole = "buyer") => {
        const p = normalizePhone(phone);
        if (!isValidArabPhone(p)) return { ok: false, error: "phone" };
        if (password.length < 8) return { ok: false, error: "password" };
        let remote;
        try {
          remote = await claimSouq({ data: { phone: p, password, asRole } });
        } catch {
          return { ok: false, error: "password" };
        }
        if (!remote.ok) return remote;
        const account = { ...remote.account, usernameHistory: remote.account.usernameHistory ?? [] };
        delete account.password;
        set({
          user: toUser(account),
          ...buyerLists(account),
          accounts: { ...get().accounts, [p]: account }
        });
        return { ok: true };
      },
      signOut: () => {
        void signOutSouq();
        try { localStorage.removeItem("souq-sync-token"); } catch {}
        const s = get();
        const phone = s.user?.phone;
        const prev = phone ? s.accounts[phone] : void 0;
        set({
          user: null,
          favorites: [],
          bookmarks: [],
          bookmarkLists: [],
          followedLists: [],
          follows: [],
          pageLikes: [],
          ...buyerLists(),
          accounts: prev && phone && s.user ? {
            ...s.accounts,
            [phone]: {
              ...prev,
              ...buyerPack(s),
              username: s.user.username,
              displayName: s.user.displayName || s.user.username,
              city: s.user.city || "",
              bio: s.user.bio || "",
              address: s.user.address || "",
              joinedAt: s.user.joinedAt,
              usernameHistory: s.user.usernameHistory ?? []
            }
          } : s.accounts
        });
      },
      updateProfile: (patch) => {
        const user = get().user;
        if (!user) return;
        const next = {
          ...user,
          username: user.role === "seller" ? user.username : patch.username?.trim() || user.username,
          displayName: patch.displayName?.trim() ?? user.displayName,
          city: patch.city?.trim() ?? user.city,
          bio: patch.bio?.trim() ?? user.bio,
          address: patch.address?.trim() ?? user.address
        };
        const prev = get().accounts[user.phone];
        const changed = next.username.toLowerCase() !== user.username.toLowerCase();
        const usernameHistory = changed ? [user.username, ...prev?.usernameHistory ?? user.usernameHistory ?? []] : prev?.usernameHistory ?? user.usernameHistory ?? [];
        const joinedAt = prev?.joinedAt ?? user.joinedAt ?? Date.now();
        const savedUser = { ...next, usernameHistory, joinedAt };
        const base = prev ?? {
          phone: user.phone,
          username: next.username,
          displayName: next.displayName || next.username,
          city: next.city || "",
          bio: next.bio || "",
          address: next.address || "",
          role: user.role || "buyer",
          friendsOfBattuta: user.friendsOfBattuta,
          referredBy: user.referredBy,
          sellerPlan: user.sellerPlan,
          shopSlug: user.shopSlug
        };
        set({
          user: savedUser,
          accounts: {
            ...get().accounts,
            [user.phone]: {
              ...base,
              ...buyerPack(get()),
              username: savedUser.username,
              displayName: savedUser.displayName || savedUser.username,
              city: savedUser.city || "",
              bio: savedUser.bio || "",
              address: savedUser.address || "",
              joinedAt,
              usernameHistory
            }
          }
        });
      },
      setBuyerShare: (patch) => {
        const user = get().user;
        if (!user || user.role === "seller") return;
        const next = { ...user, ...patch };
        const prev = get().accounts[user.phone];
        set({
          user: next,
          accounts: prev ? { ...get().accounts, [user.phone]: { ...prev, shareLikes: next.shareLikes === true, shareBookmarks: next.shareBookmarks === true } } : get().accounts
        });
      },
      changeSellerUsername: (nextRaw) => {
        const user = get().user;
        if (!user || user.role !== "seller") return { ok: false, error: "role" };
        const next = nextRaw.trim().replace(/\s+/g, " ");
        if (!isValidSellerUsername(next)) return { ok: false, error: "format" };
        if (nameKey(next) === nameKey(user.username)) return { ok: true };
        const prev = get().accounts[user.phone];
        const changes = prev?.usernameChanges ?? user.usernameChanges ?? [];
        if (changes.length >= 3) return { ok: false, error: "limit" };
        if (usernameTaken(next, get().accounts, user.phone)) return { ok: false, error: "taken" };
        const at = Date.now();
        const usernameChanges = [...changes, { name: user.username, at }];
        const heldUsernames = [...prev?.heldUsernames ?? [], { name: user.username, until: at + NAME_HOLD_MS }];
        const usernameHistory = [user.username, ...prev?.usernameHistory ?? user.usernameHistory ?? []];
        const savedUser = { ...user, username: next, usernameHistory, usernameChanges };
        set({
          user: savedUser,
          accounts: {
            ...get().accounts,
            [user.phone]: {
              ...prev ?? {
                phone: user.phone,
                      displayName: user.displayName || next,
                city: user.city || "",
                bio: user.bio || "",
                address: user.address || "",
                role: "seller",
                friendsOfBattuta: user.friendsOfBattuta
              },
              username: next,
              usernameHistory,
              usernameChanges,
              heldUsernames
            }
          }
        });
        return { ok: true };
      },
      addAddress: (name, line, lat, lng) => {
        const trimmed = name.trim();
        const street = line.trim();
        if (!trimmed || !street) return "";
        const id = `a-${Date.now()}`;
        const addresses = [{ id, name: trimmed, line: street, lat, lng }, ...get().addresses];
        withBuyer(get, set, { addresses });
        return id;
      },
      updateAddress: (id, name, line, lat, lng) => {
        const trimmed = name.trim();
        const street = line.trim();
        if (!trimmed || !street) return;
        const addresses = get().addresses.map((item) => item.id === id ? { ...item, name: trimmed, line: street, lat, lng } : item);
        withBuyer(get, set, { addresses });
      },
      removeAddress: (id) => withBuyer(get, set, { addresses: get().addresses.filter((item) => item.id !== id) }),
      addWord: (kind, word) => {
        const clean = word.trim().toLowerCase();
        if (clean.length < 2) return;
        if (kind === "interest") {
          if (get().interestWords.includes(clean) || get().interestWords.length >= WORD_CAP) return;
          withBuyer(get, set, { interestWords: [...get().interestWords, clean] });
        } else {
          if (get().alertWords.includes(clean)) return;
          const notes = alertNotes(get, [clean]);
          withBuyer(get, set, { alertWords: [...get().alertWords, clean], notes: [...notes, ...get().notes] });
        }
      },
      removeWord: (kind, word) => {
        if (kind === "interest") withBuyer(get, set, { interestWords: get().interestWords.filter((item) => item !== word) });
        else withBuyer(get, set, { alertWords: get().alertWords.filter((item) => item !== word) });
      },
      syncAlerts: () => {
        const notes = alertNotes(get, get().alertWords ?? []);
        if (notes.length) withBuyer(get, set, { notes: [...notes, ...get().notes] });
      },
      muteWord: (word) => {
        const clean = word.trim().toLowerCase();
        if (clean.length < 2 || (get().mutedWords ?? []).includes(clean)) return;
        withBuyer(get, set, { mutedWords: [...get().mutedWords ?? [], clean] });
      },
      unmuteWord: (word) => withBuyer(get, set, { mutedWords: (get().mutedWords ?? []).filter((item) => item !== word) }),
      muteStall: (slug) => {
        if (!slug || (get().mutedStalls ?? []).includes(slug)) return;
        withBuyer(get, set, { mutedStalls: [...get().mutedStalls ?? [], slug] });
      },
      unmuteStall: (slug) => withBuyer(get, set, { mutedStalls: (get().mutedStalls ?? []).filter((item) => item !== slug) }),
      dismissSuggestion: (word) => {
        const clean = word.trim().toLowerCase();
        if (!clean || (get().dismissedSuggestions ?? []).includes(clean)) return;
        withBuyer(get, set, { dismissedSuggestions: [...get().dismissedSuggestions ?? [], clean] });
      },
      placeOrder: (order) => {
        const id = `o-${Date.now()}`;
        const saved = { ...order, buyerPhone: get().user?.phone, id, at: Date.now(), reviewed: false, status: "new" };
        const notes = [
          {
            id: `n-${Date.now()}`,
            title: `Review ${order.shopName}`,
            body: `You asked about ${order.productName}${order.addressName ? ` \xB7 ${order.addressName}` : ""}.`,
            href: `/shop/${order.shopSlug}`,
            at: Date.now()
          },
          ...get().notes
        ];
        withBuyer(get, set, { orders: [saved, ...get().orders], notes });
        void placeSouqOrder({ data: { shopSlug: order.shopSlug, productName: order.productName, addressName: order.addressName } });
      },
      voteReview: (key, vote) => {
        const phone = get().user?.phone;
        if (!phone) return;
        const current = get().reviewVotes[key] ?? { up: [], down: [] };
        const up = current.up.filter((item) => item !== phone);
        const down = current.down.filter((item) => item !== phone);
        const next = vote === "up" ? { up: [...up, phone], down } : { up, down: [...down, phone] };
        const own = get().ownReviews.find((review) => key.endsWith(`:${review.id}`));
        const notes = own ? [
          {
            id: `n-${Date.now()}`,
            title: vote === "up" ? "Review marked useful" : "Review marked not useful",
            body: `A buyer voted on your note about a stall.`,
            at: Date.now()
          },
          ...get().notes
        ] : get().notes;
        withBuyer(get, set, { reviewVotes: { ...get().reviewVotes, [key]: next }, notes });
      },
      reportReview: (key, comment) => {
        const report = { id: `rep-${Date.now()}`, key, comment, at: Date.now(), removed: hasProfanity(comment) };
        set({ reports: [report, ...get().reports ?? []] });
        if (!report.removed) {
          withBuyer(get, set, {
            notes: [
              { id: `n-${Date.now()}`, title: "Report received", body: "Souq Battuta removes a review only when the words are profane.", at: Date.now() },
              ...get().notes
            ]
          });
          return { removed: false };
        }
        withBuyer(get, set, {
          removedReviews: get().removedReviews.includes(key) ? get().removedReviews : [...get().removedReviews, key],
          notes: [
            { id: `n-${Date.now()}`, title: "Review removed", body: "A reported review used profanity, so Souq Battuta took it down.", at: Date.now() },
            ...get().notes
          ]
        });
        return { removed: true };
      },
      reportStall: (slug) => {
        const user = get().user;
        if (!user || user.role === "seller" || !slug) return { ok: false };
        const key = `stall:${slug}`;
        if ((get().reports ?? []).some((item) => item.key === key && item.by === user.phone)) return { ok: true };
        const report = { id: `rep-${Date.now()}`, key, comment: "stall", by: user.phone, at: Date.now(), removed: false };
        set({ reports: [report, ...get().reports ?? []] });
        withBuyer(get, set, {
          notes: [
            { id: `n-${Date.now()}`, title: "Report received", body: "Souq Battuta will look at this stall.", href: `/shop/${slug}`, at: Date.now() },
            ...get().notes,
          ],
        });
        return { ok: true };
      },
      addReview: (review) => {
        const user = get().user;
        if (!user || user.role === "seller") return;
        const saved = {
          id: `r-${Date.now()}`,
          shopSlug: review.shopSlug,
          score: review.score,
          comment: review.comment.trim(),
          user: user.displayName || user.username,
          area: user.city || "Amman",
          authorPhone: user.phone
        };
        if (!saved.comment) return;
        const orders = review.orderId ? get().orders.map((order) => order.id === review.orderId ? { ...order, reviewed: true } : order) : get().orders;
        withBuyer(get, set, {
          ownReviews: [saved, ...get().ownReviews],
          orders,
          notes: [{ id: `n-${Date.now()}`, title: "Review posted", body: saved.comment, href: `/shop/${saved.shopSlug}`, at: Date.now() }, ...get().notes]
        });
        void saveSouqReview({ data: { shopSlug: saved.shopSlug, score: saved.score, comment: saved.comment, authorName: saved.user, area: saved.area } });
      },
      deleteReview: (id) => {
        const user = get().user;
        const review = get().ownReviews.find((item) => item.id === id);
        if (!user || !review || review.authorPhone !== user.phone) return { ok: false };
        withBuyer(get, set, { ownReviews: get().ownReviews.filter((item) => item.id !== id) });
        return { ok: true };
      },
      toggleFavorite: (id) => {
        const user = get().user;
        if (!user || user.role === "seller") return;
        const favorites = get().favorites.includes(id) ? get().favorites.filter((item) => item !== id) : [...get().favorites, id];
        withBuyer(get, set, { favorites });
      },
      togglePageLike: (slug) => {
        const user = get().user;
        if (!user || user.role === "seller") return;
        const current = get().pageLikes ?? [];
        const pageLikes = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
        withBuyer(get, set, { pageLikes });
      },
      toggleBookmark: (slug) => {
        const user = get().user;
        if (user?.role === "seller") return;
        const bookmarks = get().bookmarks.includes(slug) ? get().bookmarks.filter((item) => item !== slug) : [...get().bookmarks, slug];
        const bookmarkLists = bookmarks.includes(slug) ? get().bookmarkLists ?? [] : (get().bookmarkLists ?? []).map((list) => ({ ...list, slugs: list.slugs.filter((item) => item !== slug) }));
        withBuyer(get, set, { bookmarks, bookmarkLists });
      },
      saveBookmark: (slug) => {
        const user = get().user;
        if (user?.role === "seller") return;
        const bookmarks = get().bookmarks.includes(slug) ? get().bookmarks : [...get().bookmarks, slug];
        withBuyer(get, set, { bookmarks });
      },
      removeBookmark: (slug) => {
        const user = get().user;
        if (user?.role === "seller") return;
        withBuyer(get, set, {
          bookmarks: get().bookmarks.filter((item) => item !== slug),
          bookmarkLists: (get().bookmarkLists ?? []).map((list) => ({ ...list, slugs: list.slugs.filter((item) => item !== slug) }))
        });
      },
      addBookmarkToList: (slug, listId) => {
        const user = get().user;
        if (user?.role === "seller") return;
        const bookmarks = get().bookmarks.includes(slug) ? get().bookmarks : [...get().bookmarks, slug];
        const bookmarkLists = (get().bookmarkLists ?? []).map((list) => {
          if (list.id !== listId) return list;
          const has = list.slugs.includes(slug);
          return { ...list, slugs: has ? list.slugs.filter((item) => item !== slug) : [...list.slugs, slug] };
        });
        withBuyer(get, set, { bookmarks, bookmarkLists });
      },
      createBookmarkList: (name, slug, visibility = "private") => {
        const user = get().user;
        if (user?.role === "seller") return;
        const clean = name.trim();
        if (!clean) return;
        const id = `bl-${Date.now()}`;
        const bookmarks = !slug || get().bookmarks.includes(slug) ? get().bookmarks : [...get().bookmarks, slug];
        const bookmarkLists = [...get().bookmarkLists ?? [], { id, name: clean, slugs: slug ? [slug] : [], visibility }];
        withBuyer(get, set, { bookmarks, bookmarkLists });
      },
      setListVisibility: (listId, visibility) => {
        const user = get().user;
        if (user?.role === "seller") return;
        const bookmarkLists = (get().bookmarkLists ?? []).map((list) => list.id === listId ? { ...list, visibility } : list);
        withBuyer(get, set, { bookmarkLists });
      },
      followList: (phone, listId) => {
        const user = get().user;
        if (!user || user.role === "seller" || user.phone === phone) return;
        const current = get().followedLists ?? [];
        const has = current.some((item) => item.phone === phone && item.listId === listId);
        const followedLists = has ? current.filter((item) => !(item.phone === phone && item.listId === listId)) : [...current, { phone, listId }];
        withBuyer(get, set, { followedLists });
      },
      unfollowList: (phone, listId) => {
        const user = get().user;
        if (!user || user.role === "seller") return;
        const followedLists = (get().followedLists ?? []).filter((item) => !(item.phone === phone && item.listId === listId));
        withBuyer(get, set, { followedLists });
      },
      copyList: (phone, listId) => {
        const user = get().user;
        if (!user || user.role === "seller") return;
        const source = get().accounts[phone]?.bookmarkLists?.find((list) => list.id === listId && list.visibility === "public");
        if (!source) return;
        const id = `bl-${Date.now()}`;
        const bookmarks = Array.from(/* @__PURE__ */ new Set([...get().bookmarks, ...source.slugs]));
        const bookmarkLists = [...get().bookmarkLists ?? [], { id, name: source.name, slugs: [...source.slugs], visibility: "private" }];
        withBuyer(get, set, { bookmarks, bookmarkLists });
      },
      reorderBookmarks: (slugs) => {
        const user = get().user;
        if (user?.role === "seller") return;
        const listed = new Set((get().bookmarkLists ?? []).flatMap((list) => list.slugs));
        const loose = slugs.filter((slug) => get().bookmarks.includes(slug) && !listed.has(slug));
        const rest = get().bookmarks.filter((slug) => !loose.includes(slug));
        withBuyer(get, set, { bookmarks: [...loose, ...rest] });
      },
      reorderBookmarkLists: (ids) => {
        const user = get().user;
        if (user?.role === "seller") return;
        const byId = new Map((get().bookmarkLists ?? []).map((list) => [list.id, list]));
        const next = ids.map((id) => byId.get(id)).filter((list) => Boolean(list));
        withBuyer(get, set, { bookmarkLists: next });
      },
      reorderBookmarkList: (listId, slugs) => {
        const user = get().user;
        if (user?.role === "seller") return;
        const bookmarkLists = (get().bookmarkLists ?? []).map((list) => list.id === listId ? { ...list, slugs } : list);
        withBuyer(get, set, { bookmarkLists });
      },
      toggleFollow: (slug) => {
        const user = get().user;
        if (!user || user.role === "seller") return;
        const current = get().follows ?? [];
        const follows = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
        withBuyer(get, set, { follows });
      },
      recordWa: (slug) => set((s) => ({ waTaps: { ...s.waTaps ?? {}, [slug]: ((s.waTaps ?? {})[slug] ?? 0) + 1 } })),
      addListing: (listing) => {
        const user = get().user;
        if (!user?.shopSlug || user.role !== "seller") return { ok: false, error: "auth" };
        const name = listing.name.trim();
        const nameAr = listing.nameAr.trim() || name;
        if (name.length < 2) return { ok: false, error: "name" };
        const plan = PLANS[user.sellerPlan ?? "free"];
        const mine = (get().listings ?? []).filter((item) => item.shopSlug === user.shopSlug);
        if (mine.length >= plan.listings) return { ok: false, error: "limit" };
        const cap = user.sellerPlan === "grow" || user.sellerPlan === "premium" ? 6 : plan.images;
        const images = listing.images.filter(Boolean).slice(0, cap);
        const next = {
          id: `sku-${Date.now()}`,
          shopSlug: user.shopSlug,
          name,
          nameAr,
          price: listing.priceMode && listing.priceMode !== "price" ? 0 : Math.max(0, Number(listing.price) || 0),
          priceMode: listing.priceMode ?? "price",
          desc: listing.desc.trim(),
          descAr: listing.descAr.trim() || listing.desc.trim(),
          images: images.length ? images : ["/brand/avatars/default-duck.jpg"],
          group: listing.group?.trim() || void 0,
          groupAr: listing.groupAr?.trim() || void 0,
          choices: user.sellerPlan === "premium" ? cleanChoices(listing.choices) : void 0,
          chart: user.sellerPlan === "premium" ? listing.chart || void 0 : void 0
        };
        const listings = [next, ...get().listings ?? []];
        withBuyer(get, set, { listings });
        void (async () => {
          const urls = [];
          for (const img of images) {
            if (typeof img === "string" && img.startsWith("data:")) {
              const up = await uploadListingImage({ data: { dataUrl: img } });
              if (up.ok) urls.push(up.url);
            } else if (typeof img === "string" && (img.startsWith("https://") || img.startsWith("/"))) urls.push(img);
          }
          const imageUrl = urls.find((url) => !url.startsWith("data:"));
          await saveSouqListing({ data: { id: next.id, name, price: next.price, imageUrl, body: { nameAr, desc: next.desc } } });
          if (imageUrl) {
            const current = get().listings ?? [];
            set({ listings: current.map((item) => item.id === next.id ? { ...item, images: urls.length ? urls : item.images } : item) });
          }
        })();
        return { ok: true };
      },
      updateListing: (id, listing) => {
        const user = get().user;
        if (!user?.shopSlug) return { ok: false };
        const name = listing.name.trim();
        if (name.length < 2) return { ok: false };
        const planId = user.sellerPlan ?? "free";
        const cap = planId === "grow" || planId === "premium" ? 6 : PLANS[planId].images;
        const images = listing.images.filter(Boolean).slice(0, cap);
        const listings = (get().listings ?? []).map(
          (item) => item.id === id ? {
            ...item,
            name,
            nameAr: listing.nameAr.trim() || name,
            price: listing.priceMode && listing.priceMode !== "price" ? 0 : Math.max(0, Number(listing.price) || 0),
            priceMode: listing.priceMode ?? "price",
            desc: listing.desc.trim(),
            descAr: listing.descAr.trim() || listing.desc.trim(),
            images: images.length ? images : item.images,
            group: listing.group?.trim() || void 0,
            groupAr: listing.groupAr?.trim() || listing.group?.trim() || void 0,
            choices: user.sellerPlan === "premium" ? cleanChoices(listing.choices) : void 0,
            chart: user.sellerPlan === "premium" ? listing.chart || void 0 : void 0
          } : item
        );
        withBuyer(get, set, { listings });
        return { ok: true };
      },
      removeListing: (id) => {
        const user = get().user;
        if (!user?.shopSlug) return;
        const listings = (get().listings ?? []).filter((item) => item.id !== id);
        withBuyer(get, set, { listings });
      },
      toggleListing: (id) => {
        const listings = (get().listings ?? []).map((item) => item.id === id ? { ...item, hidden: !item.hidden } : item);
        withBuyer(get, set, { listings });
      },
      hideListing: (id, reason, back) => {
        const listings = (get().listings ?? []).map(
          (item) => item.id === id ? { ...item, hidden: true, hideReason: reason, hideBack: back || void 0 } : item
        );
        withBuyer(get, set, { listings });
      },
      showListing: (id) => {
        const current = get().listings ?? [];
        const item = current.find((entry) => entry.id === id);
        const listings = current.map((entry) => entry.id === id ? { ...entry, hidden: false } : entry);
        withBuyer(get, set, { listings });
        if (!item?.hidden) return;
        const accounts = { ...get().accounts };
        for (const phone of Object.keys(accounts)) {
          const watches = accounts[phone].restocks ?? [];
          if (!watches.some((watch) => watch.productId === id)) continue;
          const note = {
            id: `back-${id}`,
            title: `${item.name} is available`,
            body: `${item.name} is back. ${item.nameAr} \u0631\u062C\u0639.`,
            href: `/shop/${item.shopSlug}`,
            at: Date.now()
          };
          accounts[phone] = {
            ...accounts[phone],
            restocks: watches.filter((watch) => watch.productId !== id),
            notes: [note, ...(accounts[phone].notes ?? []).filter((entry) => entry.id !== note.id)]
          };
        }
        const me = get().user?.phone;
        set({
          accounts,
          notes: me && accounts[me] ? accounts[me].notes ?? [] : get().notes,
          restocks: me && accounts[me] ? accounts[me].restocks ?? [] : get().restocks
        });
      },
      watchRestock: (watch) => {
        const user = get().user;
        if (!user || user.role === "seller") return { ok: false };
        const restocks = get().restocks ?? [];
        if (restocks.some((item) => item.productId === watch.productId)) return { ok: true };
        withBuyer(get, set, { restocks: [...restocks, watch] });
        return { ok: true };
      },
      addPromotion: (input) => {
        const user = get().user;
        if (!user || user.role !== "seller" || user.sellerPlan !== "premium" && user.sellerPlan !== "grow") return { ok: false, error: "plan" };
        const title = input.title.trim();
        if (title.length < 2) return { ok: false, error: "name" };
        const account = get().accounts[user.phone];
        if (!account) return { ok: false, error: "plan" };
        const month = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
        const used = (account.promotions ?? []).filter((promo2) => new Date(promo2.at).toISOString().slice(0, 7) === month).length;
        const cap = user.sellerPlan === "premium" ? 4 : 1;
        if (used >= cap) return { ok: false, error: "limit" };
        const slug = slugForSeller(user);
        const promo = {
          id: `promo-${Date.now()}`,
          shopSlug: slug,
          shopName: user.displayName || user.username,
          title,
          titleAr: input.titleAr.trim() || title,
          detail: input.detail.trim(),
          detailAr: input.detailAr.trim() || input.detail.trim(),
          kind: input.kind,
          off: input.off.trim(),
          offAr: input.offAr?.trim() || input.off.trim(),
          images: (input.images ?? []).filter(Boolean).slice(0, 4),
          views: 0,
          clicks: 0,
          at: Date.now()
        };
        const accounts = {
          ...get().accounts,
          [user.phone]: { ...account, promotions: [promo, ...account.promotions ?? []] }
        };
        for (const phone of Object.keys(accounts)) {
          if (phone === user.phone) continue;
          if (!(accounts[phone].follows ?? []).includes(slug)) continue;
          const note = {
            id: `promo-${promo.id}`,
            title: input.kind === "announcement" ? `${promo.shopName} posted an announcement` : `${promo.shopName} posted an offer`,
            body: `${promo.title}. ${promo.titleAr}`,
            href: `/shop/${slug}`,
            at: Date.now()
          };
          accounts[phone] = {
            ...accounts[phone],
            notes: [note, ...(accounts[phone].notes ?? []).filter((entry) => entry.id !== note.id)]
          };
        }
        set({ accounts });
        return { ok: true };
      },
      replyToReview: (key, reply) => {
        const user = get().user;
        if (!user || user.role !== "seller") return { ok: false, error: "auth" };
        if (!PLANS[user.sellerPlan ?? "free"].reviews) return { ok: false, error: "plan" };
        const text = reply.trim();
        if (!text) return { ok: false, error: "auth" };
        const reviewReplies = { ...get().reviewReplies ?? {}, [key]: text };
        withBuyer(get, set, { reviewReplies });
        return { ok: true };
      },
      clearSellerAlert: (id, item) => {
        const sellerCleared = Array.from(/* @__PURE__ */ new Set([...get().sellerCleared ?? [], id]));
        const sellerHistory = item ? [{ id, title: item.title, detail: item.detail, at: Date.now(), kind: item.kind }, ...(get().sellerHistory ?? []).filter((entry) => entry.id !== id)] : get().sellerHistory ?? [];
        withBuyer(get, set, { sellerCleared, sellerHistory });
      },
      completeDeskOrder: (id) => {
        const accounts = { ...get().accounts };
        let owner = "";
        let hit;
        for (const phone of Object.keys(accounts)) {
          hit = (accounts[phone].orders ?? []).find((order) => order.id === id);
          if (hit) {
            owner = phone;
            break;
          }
        }
        if (!hit || !owner) return;
        const done = { ...hit, status: "done" };
        accounts[owner] = {
          ...accounts[owner],
          orders: (accounts[owner].orders ?? []).map((order) => order.id === id ? done : order)
        };
        const buyerPhone = done.buyerPhone && accounts[done.buyerPhone] ? done.buyerPhone : owner;
        const sellerPhone = get().user?.phone;
        if (buyerPhone !== sellerPhone && accounts[buyerPhone]) {
          const note = {
            id: `review-${id}`,
            title: "Review your order",
            body: `${done.productName} from ${done.shopName} is complete. You can leave a review. \u0637\u0644\u0628\u0643 \u0627\u0643\u062A\u0645\u0644\u060C \u0648\u062A\u0642\u062F\u0631 \u062A\u0642\u064A\u0651\u0645\u0647.`,
            href: "/inbox",
            at: Date.now()
          };
          accounts[buyerPhone] = {
            ...accounts[buyerPhone],
            notes: [note, ...(accounts[buyerPhone].notes ?? []).filter((item) => item.id !== note.id)]
          };
        }
        set({
          accounts,
          orders: (get().orders ?? []).map((order) => order.id === id ? done : order),
          notes: get().user?.phone === buyerPhone ? accounts[buyerPhone].notes ?? [] : get().notes
        });
        void patchSouqOrder({ data: { orderId: id, status: "done" } });
      },
      ensureDirectory: () => {},
      ensureHalaDemo: () => {},
      markSellerSeen: (ids) => {
        const sellerSeen = Array.from(/* @__PURE__ */ new Set([...get().sellerSeen ?? [], ...ids]));
        withBuyer(get, set, { sellerSeen });
      },
      setSellerContact: (patch) => {
        const user = get().user;
        const account = user ? get().accounts[user.phone] : void 0;
        if (!user || !account) return { ok: false, error: "auth" };
        let whatsappPhone = account.whatsappPhone;
        if (patch.whatsapp !== void 0) {
          const raw = patch.whatsapp.trim();
          if (!raw) whatsappPhone = void 0;
          else {
            const next2 = normalizePhone(raw);
            if (!isValidJoPhone(next2)) return { ok: false, error: "phone" };
            whatsappPhone = next2;
          }
        }
        const next = { ...account, whatsappPhone, displayName: patch.displayName?.trim() || account.displayName };
        set({ user: toUser(next), accounts: { ...get().accounts, [user.phone]: next } });
        return { ok: true };
      },
      setSellerCode: (raw) => {
        const user = get().user;
        const account = user ? get().accounts[user.phone] : void 0;
        if (!user || !account || user.role !== "seller") return { ok: false, error: "auth" };
        if (!user.sellerPlan || user.sellerPlan === "free") return { ok: false, error: "plan" };
        const code = raw.trim().toUpperCase();
        if (!/^[A-Z0-9]{4,12}$/.test(code)) return { ok: false, error: "format" };
        const taken = Object.values(get().accounts).some((item) => item.phone !== user.phone && item.sellerCode?.toUpperCase() === code);
        if (taken) return { ok: false, error: "taken" };
        const used = Object.values(get().accounts).filter(
          (item) => item.role === "buyer" && item.referral?.trim().toLowerCase() === account.sellerCode?.trim().toLowerCase()
        ).length;
        if (account.sellerCode && used > 0 && account.sellerCode.toUpperCase() !== code) return { ok: false, error: "locked" };
        const next = { ...account, sellerCode: code };
        set({ user: toUser(next), accounts: { ...get().accounts, [user.phone]: next } });
        return { ok: true };
      },
      ensureSellerCode: () => {
        const user = get().user;
        const account = user ? get().accounts[user.phone] : void 0;
        if (!user || !account || user.role !== "seller" || !user.sellerPlan || user.sellerPlan === "free" || account.sellerCode) return;
        const sellerCode = mintSellerCode(Object.values(get().accounts).map((item) => item.sellerCode));
        const next = { ...account, sellerCode };
        set({ user: toUser(next), accounts: { ...get().accounts, [user.phone]: next } });
      },
      sendSellerMessage: (slug, body) => {
        const user = get().user;
        const text = body.trim();
        if (!user || user.role !== "seller" || text.length < 2) return { ok: false, error: "auth" };
        if (user.sellerPlan !== "grow" && user.sellerPlan !== "premium") return { ok: false, error: "closed" };
        const target = sellerByPublicSlug(slug, get().accounts);
        if (!target || target.phone === user.phone) return { ok: false, error: "auth" };
        if (!target.allowSellerMail || target.sellerPlan !== "grow" && target.sellerPlan !== "premium") return { ok: false, error: "closed" };
        const id = mailId(user.phone, target.phone);
        const line = { id: `m-${Date.now()}`, fromPhone: user.phone, fromName: user.username, body: text, at: Date.now() };
        const mail = upsertThread(get().mail ?? [], {
          id,
          phones: pair(user.phone, target.phone),
          names: { [user.phone]: user.username, [target.phone]: target.username },
          lines: [line]
        });
        set({ mail });
        return { ok: true };
      },
      openSellerMessage: (id) => {
        const user = get().user;
        if (!user) return;
        const thread = (get().mail ?? []).find((item) => item.id === id);
        if (!thread || !thread.lines.some((line) => line.fromPhone !== user.phone && !line.readAt)) return;
        const now = Date.now();
        set({
          mail: (get().mail ?? []).map(
            (item) => item.id === id ? { ...item, lines: item.lines.map((line) => line.fromPhone !== user.phone && !line.readAt ? { ...line, readAt: now } : line) } : item
          )
        });
      },
      replySellerMessage: (id, body) => {
        const user = get().user;
        const text = body.trim();
        if (!user || !text) return;
        const line = { id: `m-${Date.now()}`, fromPhone: user.phone, fromName: user.username, body: text, at: Date.now() };
        const mail = (get().mail ?? []).map((thread2) => thread2.id === id ? { ...thread2, lines: [...thread2.lines, line] } : thread2);
        set({ mail });
        const thread = mail.find((item) => item.id === id);
        const other = thread?.phones.find((phone) => phone !== user.phone);
        if (other === "souq") {
          const copy = { id: line.id, fromPhone: user.phone, fromName: user.displayName || user.username, role: "seller", body: text, at: line.at };
          set({ souqMail: [copy, ...(get().souqMail ?? []).filter((item) => item.id !== copy.id)] });
          globalThis.setTimeout(() => {
            const current = get().mail ?? [];
            set({
              mail: current.map(
                (item) => item.id === id ? { ...item, lines: item.lines.map((entry) => entry.id === line.id ? { ...entry, readAt: Date.now() } : entry) } : item
              )
            });
          }, 900);
        }
      },
      deleteSellerThread: (id) => {
        set({ mail: (get().mail ?? []).filter((thread) => thread.id !== id) });
      },
      deleteSellerLine: (threadId, lineId) => {
        set({
          mail: (get().mail ?? []).flatMap((thread) => {
            if (thread.id !== threadId) return [thread];
            const lines = thread.lines.filter((line) => line.id !== lineId);
            return lines.length ? [{ ...thread, lines }] : [];
          })
        });
      },
      ensureSouqInbox: () => {
        const user = get().user;
        const account = user ? get().accounts[user.phone] : void 0;
        if (!user || user.role !== "seller" || !account) return;
        let mail = get().mail ?? [];
        for (const message of account.messages ?? []) {
          const other = message.fromPhone || "souq";
          const id = mailId(user.phone, other);
          if (mail.some((thread) => thread.lines.some((line2) => line2.id === message.id))) continue;
          const line = { id: message.id, fromPhone: other, fromName: message.fromName, body: message.body, at: message.at, readAt: message.read ? message.at : void 0 };
          mail = upsertThread(mail, { id, phones: pair(user.phone, other), names: { [user.phone]: user.username, [other]: message.fromName }, lines: [line] });
        }
        const souqId = mailId(user.phone, "souq");
        const welcomeId = `souq-${user.phone}`;
        const welcome = { id: welcomeId, fromPhone: "souq", fromName: "Souq Battuta", body: SELLER_WELCOME, at: Date.now() };
        if (!mail.some((thread) => thread.id === souqId)) {
          mail = upsertThread(mail, {
            id: souqId,
            phones: pair(user.phone, "souq"),
            names: { [user.phone]: user.username, souq: "Souq Battuta" },
            lines: [welcome]
          });
        } else {
          mail = mail.map((thread) => {
            if (thread.id !== souqId) return thread;
            const lines = thread.lines.some((line) => line.id === welcomeId) ? thread.lines.map((line) => line.id === welcomeId ? { ...line, body: SELLER_WELCOME, fromName: "Souq Battuta" } : line) : [...thread.lines, welcome];
            return { ...thread, lines };
          });
        }
        set({ mail });
      },
      ensureBuyerWelcome: () => {
        const user = get().user;
        const account = user ? get().accounts[user.phone] : void 0;
        if (!user || user.role === "seller" || !account) return;
        const note = welcomeNote(account.joinedAt);
        const existing = (account.notes ?? get().notes).find((item) => item.id === BUYER_WELCOME.id);
        if (existing?.body === BUYER_WELCOME.body && existing.title === BUYER_WELCOME.title) return;
        const notes = existing ? (account.notes ?? get().notes).map((item) => item.id === BUYER_WELCOME.id ? { ...item, title: note.title, body: note.body } : item) : [note, ...account.notes ?? get().notes];
        set({ notes, accounts: { ...get().accounts, [user.phone]: { ...account, notes } } });
      },
      messageSouq: (body) => {
        const user = get().user;
        const text = body.trim();
        if (!user || text.length < 2) return { ok: false };
        const role = user.role === "seller" ? "seller" : "buyer";
        const item = { id: `sq-${Date.now()}`, fromPhone: user.phone, fromName: user.displayName || user.username, role, body: text, at: Date.now() };
        const souqMail = [item, ...get().souqMail ?? []];
        if (role === "seller") {
          const id = mailId(user.phone, "souq");
          const line = { id: item.id, fromPhone: user.phone, fromName: item.fromName, body: text, at: item.at };
          const mail = upsertThread(get().mail ?? [], { id, phones: pair(user.phone, "souq"), names: { [user.phone]: user.username, souq: "Souq Battuta" }, lines: [line] });
          set({ souqMail, mail });
          return { ok: true };
        }
        const note = { id: `sent-${item.id}`, title: "You wrote to Souq Battuta", body: text, at: item.at };
        withBuyer(get, set, { notes: [note, ...get().notes], souqMail });
        return { ok: true };
      },
      markNoteRead: (id) => {
        const notes = get().notes.map((note) => note.id === id ? { ...note, read: true } : note);
        withBuyer(get, set, { notes });
      },
      dismissNote: (id) => {
        withBuyer(get, set, { notes: get().notes.filter((note) => note.id !== id) });
      },
      deskReply: (id, body) => {
        const text = body.trim();
        const message = (get().souqMail ?? []).find((item) => item.id === id);
        if (!message || text.length < 2) return;
        const souqMail = (get().souqMail ?? []).map((item) => item.id === id ? { ...item, read: true } : item);
        if (message.role === "seller") {
          const threadId = mailId(message.fromPhone, "souq");
          const line = { id: `sq-r-${Date.now()}`, fromPhone: "souq", fromName: "Souq Battuta", body: text, at: Date.now() };
          const mail = upsertThread(get().mail ?? [], { id: threadId, phones: pair(message.fromPhone, "souq"), names: { [message.fromPhone]: message.fromName, souq: "Souq Battuta" }, lines: [line] });
          set({ souqMail, mail });
          return;
        }
        const account = get().accounts[message.fromPhone];
        const note = { id: `sq-r-${Date.now()}`, title: "Souq Battuta", body: text, at: Date.now() };
        if (!account) {
          set({ souqMail });
          return;
        }
        const notes = [note, ...account.notes ?? []];
        set({
          souqMail,
          notes: get().user?.phone === message.fromPhone ? notes : get().notes,
          accounts: { ...get().accounts, [message.fromPhone]: { ...account, notes } }
        });
      },
      readSouq: (id) => {
        set({ souqMail: (get().souqMail ?? []).map((item) => item.id === id ? { ...item, read: true } : item) });
      },
      enterDesk: () => false,
      leaveDesk: () => set({ staff: false }),
      issuePromo: (promo) => {
        const code = promo.code.trim().toUpperCase().replace(/\s+/g, "-");
        if (code.length < 4) return { ok: false, error: "short" };
        const list = get().promoCodes?.length ? get().promoCodes : [...PROMO_CODES];
        if (list.some((item) => item.code.toLowerCase() === code.toLowerCase())) return { ok: false, error: "taken" };
        set({ promoCodes: [{ ...promo, code, closed: false }, ...list] });
        return { ok: true };
      },
      closePromo: (code) => {
        const list = get().promoCodes?.length ? get().promoCodes : [...PROMO_CODES];
        set({ promoCodes: list.map((item) => item.code.toLowerCase() === code.toLowerCase() ? { ...item, closed: !item.closed } : item) });
      },
      extendStall: (phone, months) => {
        const account = get().accounts[phone];
        if (!account || account.role !== "seller" || months < 1) return;
        const now = Date.now();
        const base = Math.max(account.planEnds ?? 0, now);
        const next = { ...account, planEnds: base + months * 30 * 864e5 };
        set({ accounts: { ...get().accounts, [phone]: next } });
      },
      deskRemoveReview: (key) => {
        set({
          removedReviews: get().removedReviews.includes(key) ? get().removedReviews : [...get().removedReviews, key],
          reports: (get().reports ?? []).map((item) => item.key === key ? { ...item, removed: true } : item)
        });
      },
      setStall: (patch) => {
        const user = get().user;
        const account = user ? get().accounts[user.phone] : void 0;
        if (!user || !account) return;
        const next = { ...account, ...patch };
        set({ user: toUser(next), accounts: { ...get().accounts, [user.phone]: next } });
      },
      bumpStallViews: (slug) => {
        if (!slug || slug === get().user?.shopSlug) return;
        void recordShopView({ data: { slug } });
      },
      addHelloPost: (input) => {
        const user = get().user;
        if (!user || user.role !== "seller") return { ok: false, error: "auth" };
        const cap = HELLO_CAP[user.sellerPlan ?? "free"];
        if (!cap) return { ok: false, error: "plan" };
        const account = get().accounts[user.phone];
        if (!account) return { ok: false, error: "auth" };
        const handles = (get().helloHandles ?? []).map((item) => item.handle);
        const text = normalizeHandles(String(input.text ?? "").trim(), handles);
        if (text.length < 2 || !input.image || hasProfanity(text)) return { ok: false, error: "name" };
        if (billedLength(text, handles) > 88) return { ok: false, error: "limit" };
        const day = ammanDay();
        const already = account.helloSpent?.day === day ? account.helloSpent.count : 0;
        const stillUp = (account.helloPosts ?? []).filter((post) => ammanDay(post.at) === day).length;
        const spent = Math.max(already, stillUp);
        if (spent >= cap) return { ok: false, error: "limit" };
        const post = {
          id: `hw-${Date.now()}`,
          shopSlug: user.shopSlug || slugForSeller(user),
          text,
          lang: input.lang === "ar" ? "ar" : "en",
          image: input.image,
          at: Date.now(),
          views: 0,
          hearts: 0
        };
        set({ accounts: { ...get().accounts, [user.phone]: { ...account, helloPosts: [post, ...account.helloPosts ?? []], helloSpent: { day, count: spent + 1 } } } });
        return { ok: true };
      },
      pruneHello: () => {
        const user = get().user;
        const account = user ? get().accounts[user.phone] : void 0;
        if (!user || !account) return;
        const keep = Date.now() - 30 * 864e5;
        const posts = account.helloPosts ?? [];
        const next = posts.filter((post) => post.at >= keep);
        if (next.length === posts.length) return;
        set({ accounts: { ...get().accounts, [user.phone]: { ...account, helloPosts: next } } });
      },
      deleteHello: (id) => {
        const user = get().user;
        const account = user ? get().accounts[user.phone] : void 0;
        if (!user || user.role !== "seller" || !account) return;
        const posts = account.helloPosts ?? [];
        if (!posts.some((post) => post.id === id)) return;
        const day = ammanDay();
        const todayCount = posts.filter((post) => ammanDay(post.at) === day).length;
        const already = account.helloSpent?.day === day ? account.helloSpent.count : 0;
        set({
          accounts: {
            ...get().accounts,
            [user.phone]: {
              ...account,
              helloPosts: posts.filter((post) => post.id !== id),
              helloSpent: { day, count: Math.max(already, todayCount) },
            },
          },
        });
      },
      toggleHelloHeart: (id) => {
        const user = get().user;
        if (!user || user.role === "seller") return;
        const current = get().helloHearts ?? [];
        withBuyer(get, set, { helloHearts: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] });
      },
      viewHello: (id) => {
        const accounts = { ...get().accounts };
        let changed = false;
        for (const phone of Object.keys(accounts)) {
          const posts = accounts[phone].helloPosts ?? [];
          if (!posts.some((post) => post.id === id)) continue;
          accounts[phone] = { ...accounts[phone], helloPosts: posts.map((post) => post.id === id ? { ...post, views: (post.views ?? 0) + 1 } : post) };
          changed = true;
        }
        if (changed) set({ accounts });
      },
      reportHello: (id) => {
        const accounts = { ...get().accounts };
        for (const phone of Object.keys(accounts)) {
          const posts = accounts[phone].helloPosts ?? [];
          if (!posts.some((post) => post.id === id)) continue;
          accounts[phone] = { ...accounts[phone], helloPosts: posts.map((post) => post.id === id ? { ...post, reported: true } : post) };
        }
        set({ accounts });
      },
      deskAddHandle: (name, note) => {
        const handle = toHandle(name);
        if (!handle) return { ok: false, error: "name" };
        const handles = get().helloHandles ?? [];
        if (handles.some((item) => item.handle.toLowerCase() === handle.toLowerCase())) return { ok: false, error: "taken" };
        set({ helloHandles: [...handles, { handle, name: String(name).trim(), note: String(note ?? "").trim(), at: Date.now() }] });
        return { ok: true };
      },
      deskRemoveHandle: (handle) => set({ helloHandles: (get().helloHandles ?? []).filter((item) => item.handle !== handle) }),
      deskDeleteHello: (id) => {
        const accounts = { ...get().accounts };
        for (const phone of Object.keys(accounts)) {
          const posts = accounts[phone].helloPosts ?? [];
          if (!posts.some((post) => post.id === id)) continue;
          accounts[phone] = { ...accounts[phone], helloPosts: posts.filter((post) => post.id !== id) };
        }
        set({ accounts });
      },
      setAlgoOrder: (order) => withBuyer(get, set, { algoOrder: algoOrder(order) }),
      noteShare: (slug) => {
        const user = get().user;
        if (!slug || !user || user.role === "seller") return;
        const current = get().sharedSlugs ?? [];
        if (current.includes(slug)) return;
        withBuyer(get, set, { sharedSlugs: [...current, slug] });
      },
      noteVisit: (slug) => {
        if (!slug || get().user?.shopSlug === slug) return;
        const recentSlugs = [slug, ...(get().recentSlugs ?? []).filter((item) => item !== slug)].slice(0, 24);
        const visitCounts = { ...get().visitCounts ?? {} };
        visitCounts[slug] = (visitCounts[slug] ?? 0) + 1;
        set({ recentSlugs, visitCounts });
      },
      bumpPromotionViews: (ids) => {
        if (!ids.length) return;
        const viewer = get().user?.phone;
        const accounts = { ...get().accounts };
        let changed = false;
        for (const phone of Object.keys(accounts)) {
          if (phone === viewer) continue;
          const promos = accounts[phone].promotions ?? [];
          if (!promos.some((promo) => ids.includes(promo.id))) continue;
          accounts[phone] = {
            ...accounts[phone],
            promotions: promos.map((promo) => ids.includes(promo.id) ? { ...promo, views: (promo.views ?? 0) + 1 } : promo)
          };
          changed = true;
        }
        if (changed) set({ accounts });
      },
      bumpPromotionClick: (id) => {
        if (!id || typeof window === "undefined") return;
        const mark = `promo-click:${id}`;
        if (sessionStorage.getItem(mark)) return;
        const viewer = get().user?.phone;
        const accounts = { ...get().accounts };
        for (const phone of Object.keys(accounts)) {
          if (phone === viewer) continue;
          const promos = accounts[phone].promotions ?? [];
          if (!promos.some((promo) => promo.id === id)) continue;
          sessionStorage.setItem(mark, "1");
          accounts[phone] = {
            ...accounts[phone],
            promotions: promos.map((promo) => promo.id === id ? { ...promo, clicks: (promo.clicks ?? 0) + 1 } : promo)
          };
          set({ accounts });
          return;
        }
      },
      attachSellerShop: () => {
        const user = get().user;
        if (!user) return "";
        const slug = slugForSeller(user);
        const previous = user.shopSlug;
        const listings = (get().listings ?? []).map(
          (item) => previous && previous !== slug && item.shopSlug === previous ? { ...item, shopSlug: slug } : item
        );
        const next = { ...user, sellerPlan: user.sellerPlan ?? "free", shopSlug: slug, role: "seller" };
        const prev = get().accounts[user.phone];
        set({
          user: next,
          listings,
          accounts: {
            ...get().accounts,
            [user.phone]: {
              ...prev ?? {
                phone: user.phone,
                username: user.username,
                      displayName: user.displayName || user.username,
                city: user.city || "",
                bio: user.bio || "",
                address: user.address || "",
                role: "seller",
                friendsOfBattuta: user.friendsOfBattuta
              },
              ...buyerPack({ ...get(), listings }),
              username: user.username,
              sellerPlan: next.sellerPlan,
              shopSlug: slug,
              role: "seller"
            }
          }
        });
        return slug;
      },
      redeemPlanCode: (code) => {
        const user = get().user;
        if (!user || user.role !== "seller") return { ok: false, error: "auth" };
        const result = checkPromo(code, get().promoRedemptions ?? [], Date.now(), get().promoCodes);
        if (!result.ok) return { ok: false, error: result.error };
        const now = Date.now();
        const planEnds = Math.max(user.planEnds ?? get().accounts[user.phone]?.planEnds ?? 0, now) + result.promo.months * 30 * 864e5;
        const prev = get().accounts[user.phone];
        const shopSlug = user.shopSlug || prev?.shopSlug || slugForSeller(user);
        const sellerCode = prev?.sellerCode || mintSellerCode(Object.values(get().accounts).map((item) => item.sellerCode));
        set({
          user: { ...user, sellerPlan: result.promo.plan, planEnds, shopSlug, sellerCode, role: "seller" },
          accounts: prev ? { ...get().accounts, [user.phone]: { ...prev, sellerPlan: result.promo.plan, planEnds, shopSlug, sellerCode, role: "seller" } } : get().accounts,
          promoRedemptions: [...get().promoRedemptions ?? [], { code: result.promo.code, phone: user.phone, plan: result.promo.plan, months: result.promo.months, at: now, endsAt: planEnds }]
        });
        return { ok: true };
      },
      becomeSeller: (plan, shopSlug) => set((s) => {
        if (!s.user) return {};
        const now = Date.now();
        const term = (plan === "free" ? 90 : 30) * 864e5;
        const current = s.user.planEnds ?? s.accounts[s.user.phone]?.planEnds ?? 0;
        const planEnds = plan === s.user.sellerPlan && current > now ? current + term : now + term;
        const user = { ...s.user, sellerPlan: plan, shopSlug, role: "seller", planEnds };
        const prev = s.accounts[s.user.phone];
        const sellerCode = prev?.sellerCode || (plan === "free" ? void 0 : mintSellerCode(Object.values(s.accounts).map((item) => item.sellerCode)));
        return {
          user: { ...user, sellerCode: sellerCode ?? user.sellerCode },
          accounts: prev ? { ...s.accounts, [s.user.phone]: { ...prev, sellerPlan: plan, shopSlug, role: "seller", planEnds, sellerCode } } : s.accounts
        };
      })
    }),
    {
      name: "souq-battuta-session",
      partialize: (state) => {
        const accounts = {};
        for (const [phone, account] of Object.entries(state.accounts ?? {})) {
          if (!account || typeof account !== "object") continue;
          const copy = { ...account };
          delete copy.password;
          accounts[phone] = copy;
        }
        const pending = state.pending ? { ...state.pending } : null;
        if (pending) delete pending.password;
        return { ...state, accounts, pending };
      },
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw);
            const state = parsed?.state ?? parsed;
            if (state?.accounts) {
              for (const account of Object.values(state.accounts)) {
                if (account && typeof account === "object") delete account.password;
              }
            }
            if (state?.pending) delete state.pending.password;
            return JSON.stringify(await hydrateImages(parsed));
          } catch {
            try {
              localStorage.removeItem(name);
            } catch {
            }
            return null;
          }
        },
        setItem: async (name, value) => {
          let slim = value;
          try {
            slim = JSON.stringify(await offloadImages(JSON.parse(value)));
          } catch {
            slim = value;
          }
          freePhotoQuota();
          try {
            localStorage.removeItem(name);
          } catch {
          }
          try {
            localStorage.setItem(name, slim);
          } catch {
          }
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
          return Promise.resolve();
        }
      }))
    }
  )
);
export {
  directoryShops,
  isValidArabPhone,
  isValidJoPhone,
  isValidSellerUsername,
  isValidUsername,
  livePromotions,
  nameSlug,
  normalizePhone,
  publicProduct,
  publicSocials,
  sellerByPublicSlug,
  shareSlug,
  slugForSeller,
  socialVerifyCode,
  stallHoursLabel,
  stallIsOpen,
  stallNameTaken,
  useSession,
  usernameTaken
};
