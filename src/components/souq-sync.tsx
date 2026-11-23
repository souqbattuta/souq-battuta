import { useEffect } from "react";
import { getSouqMe, pushSouq } from "@/lib/souq-sync";
import { slugHasPhone } from "@/lib/site";
import { useSession } from "@/lib/session";

const PRIVATE = ["password", "role", "sellerPlan", "plan", "shopSlug", "orders", "messages", "phone"];

function remapShopSlug<T>(items: T[] | undefined, from: string, to: string) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const row = item as { shopSlug?: string };
    return row.shopSlug === from ? { ...row, shopSlug: to } : item;
  });
}

export function SouqSync() {
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let lastPushed = "";

    async function pull() {
      try {
        const me = await getSouqMe();
        if (stopped || !me.ok || !me.account) return;
        const account = me.account as {
          phone?: string;
          displayName?: string;
          shopName?: string;
          algoStamps?: Record<string, number>;
          interestWords?: string[];
          algoOrder?: string[];
          mutedWords?: string[];
          mutedStalls?: string[];
        };
        const state = useSession.getState() as { user?: { phone?: string; displayName?: string } | null };
        if (state.user?.phone && account.phone && state.user.phone !== account.phone) return;
        const phone = account.phone;
        const prevAccounts = useSession.getState().accounts;
        const prev = phone ? prevAccounts[phone] : undefined;
        const nextSlug = String((account as { shopSlug?: string }).shopSlug ?? "");
        const prevSlug = String(prev?.shopSlug ?? (state.user as { shopSlug?: string } | null)?.shopSlug ?? "");
        const move = Boolean(nextSlug && prevSlug && nextSlug !== prevSlug && slugHasPhone(prevSlug));
        const live = useSession.getState() as { listings?: { shopSlug?: string }[]; orders?: { shopSlug?: string }[] };
        useSession.setState({
          user: { ...(state.user ?? {}), ...account, displayName: account.shopName || account.displayName || state.user?.displayName },
          ...(move
            ? {
                listings: remapShopSlug(live.listings, prevSlug, nextSlug),
                orders: remapShopSlug(live.orders, prevSlug, nextSlug),
              }
            : {}),
          ...(phone && prev
            ? {
                accounts: {
                  ...prevAccounts,
                  [phone]: {
                    ...prev,
                    ...(nextSlug ? { shopSlug: nextSlug } : {}),
                    ...(move
                      ? {
                          listings: remapShopSlug(prev.listings as { shopSlug?: string }[] | undefined, prevSlug, nextSlug),
                          orders: remapShopSlug(prev.orders as { shopSlug?: string }[] | undefined, prevSlug, nextSlug),
                        }
                      : {}),
                    googleShopping: (account as { googleShopping?: boolean }).googleShopping !== false,
                  },
                },
              }
            : {}),
        });
        const apply = (useSession.getState() as { applyRemoteAlgo?: (algo: unknown) => void }).applyRemoteAlgo;
        if (apply && account.algoStamps) apply(account);
      } catch {
        /* the notebook is not ready yet */
      }
    }

    async function pushNow() {
      const state = useSession.getState() as { user?: { phone?: string } | null; accounts: Record<string, Record<string, unknown>> };
      const phone = state.user?.phone;
      const account = phone ? state.accounts[phone] : null;
      if (!phone || !account) return;
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(account)) {
        if (PRIVATE.includes(key)) continue;
        body[key] = value;
      }
      if (typeof body.whatsappPhone === "string") {
        const text = body.whatsappPhone.trim().replace(/[\s().-]/g, "");
        const digits = text.startsWith("+") ? text.slice(1).replace(/\D/g, "") : text.replace(/\D/g, "");
        const whatsapp = /^9620?7\d{8}$/.test(digits)
          ? `+962${digits.slice(-9)}`
          : /^07\d{8}$/.test(digits)
            ? `+962${digits.slice(1)}`
            : /^7\d{8}$/.test(digits)
              ? `+962${digits}`
              : "";
        if (!/^\+9627[789]\d{7}$/.test(whatsapp)) delete body.whatsappPhone;
        else body.whatsappPhone = whatsapp;
      }
      if (Array.isArray(body.categories)) {
        const launch = new Set(["food", "handicrafts", "jewelry", "farmers-market", "misc", "beauty", "clothes"]);
        body.categories = (body.categories as unknown[]).filter((id) => typeof id === "string" && launch.has(id)).slice(0, 2);
      }
      const snap = JSON.stringify(body);
      if (snap === lastPushed) return;
      try {
        const saved = await pushSouq({ data: { account: body } });
        if (saved.ok) lastPushed = snap;
      } catch {
        /* keep the local copy */
      }
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void pushNow(), 700);
    }

    void pull();
    const poll = window.setInterval(() => void pull(), 8000);
    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);
    const unsub = useSession.subscribe(((state: { user?: { phone?: string } | null; accounts: Record<string, unknown> }, prev: { accounts?: Record<string, unknown> }) => {
      const phone = state.user?.phone;
      if (!phone || !prev?.accounts) return;
      if (state.accounts[phone] === prev.accounts[phone]) return;
      schedule();
    }) as (state: unknown, prevState: unknown) => void);
    schedule();
    return () => {
      stopped = true;
      unsub();
      window.clearInterval(poll);
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return null;
}
