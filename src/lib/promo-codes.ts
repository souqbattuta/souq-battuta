import type { PlanId } from "@/lib/data";

export type PromoCode = {
  code: string;
  plan: PlanId;
  months: number;
  maxUses: number;
  expiresAt?: number;
  note: string;
  noteAr: string;
  closed?: boolean;
};

export type PromoRedemption = {
  code: string;
  phone: string;
  plan: PlanId;
  months: number;
  at: number;
  endsAt: number;
};

/** Codes Souq Battuta issues. Edit this list to open or close a campaign. */
export const PROMO_CODES: PromoCode[] = [
  { code: "HALA-FREE6", plan: "free", months: 6, maxUses: 200, note: "Free stall for 6 months", noteAr: "دكان مجاني لستة أشهر" },
  { code: "HALA-BASIC3", plan: "basic", months: 3, maxUses: 100, note: "Basic for 3 months", noteAr: "أساسي لثلاثة أشهر" },
  { code: "HALA-GROW2", plan: "grow", months: 2, maxUses: 50, note: "Grow for 2 months", noteAr: "نمو لشهرين" },
  { code: "HALA-PRO1", plan: "premium", months: 1, maxUses: 20, note: "Premium for 1 month", noteAr: "مميز لشهر واحد" },
  { code: "TEST-BASIC", plan: "basic", months: 1, maxUses: 80, note: "Friend test · Basic", noteAr: "تجربة الأصدقاء · أساسي" },
  { code: "TEST-GROW", plan: "grow", months: 1, maxUses: 80, note: "Friend test · Grow", noteAr: "تجربة الأصدقاء · نمو" },
  { code: "TEST-PRO", plan: "premium", months: 1, maxUses: 80, note: "Friend test · Premium", noteAr: "تجربة الأصدقاء · مميز" },
  { code: "TEST-PREMIUM", plan: "premium", months: 1, maxUses: 80, note: "Friend test · Premium", noteAr: "تجربة الأصدقاء · مميز" },
];

export function checkPromo(code: string, redemptions: PromoRedemption[], now = Date.now(), list: PromoCode[] = PROMO_CODES) {
  const found = list.find((item) => item.code.toLowerCase() === code.trim().toLowerCase());
  if (!found || found.closed) return { ok: false as const, error: "unknown" as const };
  if (found.expiresAt && found.expiresAt < now) return { ok: false as const, error: "expired" as const };
  const used = redemptions.filter((item) => item.code.toLowerCase() === found.code.toLowerCase()).length;
  if (used >= found.maxUses) return { ok: false as const, error: "full" as const };
  return { ok: true as const, promo: found };
}
