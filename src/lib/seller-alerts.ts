import { PLANS, SHOPS, type PlanId } from "./data";
import type { SellerListing } from "./session";

export type SellerAlert = {
  id: string;
  title: string;
  detail: string;
  at: number;
  tab: "analytics" | "orders" | "edit" | "inbox" | "reviews" | "notes";
  kind: "reviews" | "orders" | "views" | "plan";
  action: "fix" | "read";
  listingId?: string;
  orderId?: string;
};

type Order = { id?: string; shopSlug: string; productName: string; at: number; status?: "new" | "done" };

export function buildSellerAlerts(input: {
  role?: "buyer" | "seller";
  shopSlug?: string;
  plan?: PlanId;
  lang: "en" | "ar";
  listings: SellerListing[];
  orders: Order[];
  taps: number;
  reviewReplies: Record<string, string>;
  reviews?: { user: string; comment: string; reply?: string }[];
  cleared: string[];
  views?: number;
  daysLeft?: number;
}): SellerAlert[] {
  if (input.role !== "seller" || !input.shopSlug) return [];
  const ar = input.lang === "ar";
  const slug = input.shopSlug;
  const plan = PLANS[input.plan ?? "free"];
  const mine = input.listings.filter((item) => item.shopSlug === slug);
  const alerts: SellerAlert[] = [];

  for (const item of mine) {
    const missing: string[] = [];
    if (!/[\u0600-\u06FF]/.test(item.nameAr)) missing.push(ar ? "اسم عربي" : "an Arabic name");
    if (!item.images.some((src) => src && !src.includes("default-duck") && !src.includes("seller-duck"))) missing.push(ar ? "صورة" : "a photo");
    if ((item.priceMode ?? "price") === "price" && !item.price) missing.push(ar ? "سعر" : "a price");
    if (!missing.length) continue;
    alerts.push({
      id: `gap:${item.id}`,
      title: item.name,
      detail: (ar ? "يحتاج " : "Needs ") + missing.join(", "),
      at: Date.now(),
      tab: "edit",
      kind: "plan",
      action: "fix",
      listingId: item.id,
    });
  }

  if (mine.length >= plan.listings) {
    alerts.push({
      id: `limit:${slug}`,
      title: ar ? "حد المنتجات" : "Listing limit",
      detail: ar ? "وصلت حد هذه الخطة." : "This plan is full. Hide or remove one, or upgrade.",
      at: Date.now(),
      tab: "edit",
      kind: "plan",
      action: "fix",
    });
  }

  for (const order of input.orders.filter((item) => item.shopSlug === slug && item.status !== "done")) {
    alerts.push({
      id: `order:${order.id ?? order.at}`,
      title: order.productName,
      detail: ar ? "طلب جديد على المكتب." : "A new order is on the desk.",
      at: order.at,
      tab: "orders",
      kind: "orders",
      action: "read",
      orderId: order.id,
    });
  }

  const shop = SHOPS.find((item) => item.slug === slug);
  const reviews = input.reviews ?? shop?.reviews ?? [];
  reviews.forEach((review, index) => {
    if (!plan.reviews) return;
    if (input.reviewReplies[`${slug}:${index}`] || review.reply) return;
    alerts.push({
      id: `review:${slug}:${index}`,
      title: review.user,
      detail: ar ? `تقييم بانتظار ردك. ${review.comment}` : `A review is waiting for your reply. ${review.comment}`,
      at: Date.now() - index * 86400000,
      tab: "reviews",
      kind: "reviews",
      action: "fix",
    });
  });

  if ((input.views ?? 0) > 0) {
    alerts.push({
      id: `views:${slug}:${input.views}`,
      title: ar ? "مشاهدات" : "Views",
      detail: ar ? `${input.views} شافوا دكانك.` : `${input.views} people viewed your stall.`,
      at: Date.now(),
      tab: "analytics",
      kind: "views",
      action: "read",
    });
  }

  if (input.daysLeft != null && input.daysLeft <= 5) {
    alerts.push({
      id: `membership:${slug}`,
      title: input.daysLeft < 0 ? (ar ? "انتهى الاشتراك" : "Membership ended") : ar ? "الاشتراك قرب يخلص" : "Membership is ending",
      detail:
        input.daysLeft < 0
          ? ar
            ? "جدّد الخطة عشان الدكان يضل ظاهر."
            : "Renew the plan so the stall stays up."
          : ar
            ? `باقي ${input.daysLeft} أيام.`
            : `${input.daysLeft} days left.`,
      at: Date.now(),
      tab: "notes",
      kind: "plan",
      action: "fix",
    });
  }

  return alerts.filter((alert) => !input.cleared.includes(alert.id));
}
