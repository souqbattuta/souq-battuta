import { useEffect } from "react";
import { claimSouq, listSouqAccounts, pushSouq } from "@/lib/souq-sync";
import { useSession } from "@/lib/session";

const TOKEN = "souq-sync-token";

export function SouqSync() {
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let lastPushed = "";

    async function pull() {
      try {
        const rows = await listSouqAccounts();
        if (stopped || !Array.isArray(rows)) return;
        const state = useSession.getState() as { user?: { phone?: string } | null; accounts: Record<string, { updatedAt?: string; password?: string }> };
        const mine = state.user?.phone;
        const next = { ...state.accounts };
        let changed = false;
        for (const row of rows) {
          const phone = String(row.phone ?? "");
          if (!phone || phone === mine) continue;
          if (next[phone]?.updatedAt === row.updatedAt) continue;
          next[phone] = { ...row, password: next[phone]?.password };
          changed = true;
        }
        if (changed) useSession.setState({ accounts: next });
      } catch {
        /* the notebook is not ready yet */
      }
    }

    async function pushNow() {
      const state = useSession.getState() as { user?: { phone?: string } | null; accounts: Record<string, { password?: string }> };
      const phone = state.user?.phone;
      const account = phone ? state.accounts[phone] : null;
      if (!phone || !account) return;
      const body = { ...account, phone };
      const snap = JSON.stringify(body);
      if (snap === lastPushed) return;
      try {
        let token = localStorage.getItem(TOKEN);
        if (!token && account.password) {
          const claimed = await claimSouq({ data: { phone, password: String(account.password), account: body } });
          if (!claimed.ok) return;
          token = claimed.token;
          localStorage.setItem(TOKEN, token);
        }
        if (!token) return;
        const saved = await pushSouq({ data: { token, account: body } });
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
