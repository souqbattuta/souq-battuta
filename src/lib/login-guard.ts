/** A real bcrypt hash so a missing account takes the same compare as a wrong password. Not a user secret. */
export const DUMMY_PASSWORD_HASH = "$2b$12$e2GfR0QgHMCDjXa0OzXTAeJ3KfdqIyDiOYffjRXHPiNyX/vQ/d4UK";

export type LoginAccount = {
  phone_verified: boolean;
  must_reset: boolean;
  password_hash: string | null;
  failed_logins: number | null;
  locked_until: string | Date | null;
  role: string | null;
};

export type LoginDecision =
  | { ok: false; error: "lockout"; lock?: boolean; fails?: number }
  | { ok: false; error: "credentials"; fails?: number }
  | { ok: false; error: "notSeller" | "notBuyer" }
  | { ok: true };

/**
 * Missing, unverified, wrong password, and must-reset all return `credentials`
 * after one bcrypt compare. Lockout stays distinct. Role errors only after a match.
 */
export async function decideLogin(args: {
  account: LoginAccount | null;
  password: string;
  asRole?: "buyer" | "seller";
  compare: (password: string, hash: string) => Promise<boolean>;
  now?: number;
  lockAfter?: number;
}): Promise<LoginDecision> {
  const now = args.now ?? Date.now();
  const account = args.account;
  if (account?.locked_until && new Date(account.locked_until).getTime() > now) {
    return { ok: false, error: "lockout" };
  }
  const hash = account?.password_hash || "";
  const usable = Boolean(account && account.phone_verified && !account.must_reset && hash);
  const match = await args.compare(args.password, hash || DUMMY_PASSWORD_HASH);
  if (!usable || !match) {
    if (usable && account) {
      const fails = Number(account.failed_logins ?? 0) + 1;
      const lockAfter = args.lockAfter ?? 5;
      if (fails >= lockAfter) return { ok: false, error: "lockout", lock: true, fails };
      return { ok: false, error: "credentials", fails };
    }
    return { ok: false, error: "credentials" };
  }
  const role = account?.role === "seller" ? "seller" : "buyer";
  if (args.asRole === "seller" && role !== "seller") return { ok: false, error: "notSeller" };
  if (args.asRole === "buyer" && role === "seller") return { ok: false, error: "notBuyer" };
  return { ok: true };
}
