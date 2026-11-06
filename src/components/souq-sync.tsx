import { useEffect } from "react";
import { getSouqMe, pushSouq } from "@/lib/souq-sync";
import { useSession } from "@/lib/session";

const PRIVATE = ["password", "role", "sellerPlan", "plan", "shopSlug", "orders", "messages", "phone"];

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
        useSession.setState({
          user: { ...(state.user ?? {}), ...account, displayName: account.shopName || account.displayName || state.user?.displayName },
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
