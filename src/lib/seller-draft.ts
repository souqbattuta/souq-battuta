import type { CategoryId } from "@/lib/data";

const KEY = "souq-seller-draft";

export type SellerDraft = {
  phone: string;
  username: string;
  address: string;
  city?: string;
  areaLat?: number;
  areaLng?: number;
  categories: CategoryId[];
};

export function saveSellerDraft(draft: SellerDraft) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function readSellerDraft(): SellerDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SellerDraft;
    if (!data.phone || !data.username || !Array.isArray(data.categories)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSellerDraft() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(KEY);
}
