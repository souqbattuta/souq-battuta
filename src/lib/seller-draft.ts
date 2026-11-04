import type { CategoryId, PlanId } from "@/lib/data";

const KEY = "souq-seller-draft";
const PENDING_KEY = "souq-join-pending";

export type SellerDraft = {
  phone: string;
  username: string;
  shopName: string;
  address: string;
  city?: string;
  areaLat?: number;
  areaLng?: number;
  categories: CategoryId[];
  plan?: PlanId;
  billingPeriod?: "monthly" | "yearly";
  paymentMethod?: "free" | "cliq" | "card";
  paymentRef?: string;
  promoCode?: string;
  promoMonths?: number;
};

function readRaw(key: string) {
  try {
    if (typeof sessionStorage !== "undefined") {
      const fromSession = sessionStorage.getItem(key);
      if (fromSession) return fromSession;
    }
  } catch {
    /* private mode */
  }
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
  } catch {
    /* private mode */
  }
  return null;
}

function writeRaw(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function dropRaw(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function saveSellerDraft(draft: SellerDraft) {
  writeRaw(KEY, JSON.stringify(draft));
}

export function readSellerDraft(): SellerDraft | null {
  try {
    const raw = readRaw(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SellerDraft;
    if (!data.phone || !data.username || !Array.isArray(data.categories)) return null;
    if (!data.shopName) data.shopName = data.username;
    return data;
  } catch {
    return null;
  }
}

export function clearSellerDraft() {
  dropRaw(KEY);
}

export function saveJoinPending(pending: Record<string, unknown>) {
  const copy = { ...pending };
  delete copy.password;
  writeRaw(PENDING_KEY, JSON.stringify(copy));
}

export function readJoinPending(): Record<string, unknown> | null {
  try {
    const raw = readRaw(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data.phone !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export function clearJoinPending() {
  dropRaw(PENDING_KEY);
}
