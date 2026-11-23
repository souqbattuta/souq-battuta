/** What this phone may keep in localStorage. Never a map of accounts, orders, or numbers. */

const PHONE_DIGITS = /\d{7,}/;

export function safeStrings(value: unknown, cap = 40) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text || PHONE_DIGITS.test(text)) continue;
    out.push(text);
    if (out.length >= cap) break;
  }
  return out;
}

export function persistedSession(state: {
  lang?: unknown;
  signedIn?: unknown;
  follows?: unknown;
  pageLikes?: unknown;
  interestWords?: unknown;
  mutedWords?: unknown;
  recentSlugs?: unknown;
} | null | undefined) {
  const lang = state?.lang === "ar" ? "ar" : "en";
  if (state?.signedIn !== true) {
    return {
      lang,
      signedIn: false as const,
      follows: [] as string[],
      pageLikes: [] as string[],
      interestWords: [] as string[],
      mutedWords: [] as string[],
      recentSlugs: [] as string[],
    };
  }
  return {
    lang,
    signedIn: true as const,
    follows: safeStrings(state.follows),
    pageLikes: safeStrings(state.pageLikes),
    interestWords: safeStrings(state.interestWords, 24),
    mutedWords: safeStrings(state.mutedWords, 40),
    recentSlugs: safeStrings(state.recentSlugs, 24),
  };
}

/** Old blobs kept every phone that used this device. Drop that, and drop a signed-out person's orders and places. */
export function scrubStoredSession(state: any) {
  if (!state || typeof state !== "object") return state;
  const signedOut = state.signedIn !== true && !state.user;
  delete state.accounts;
  if (state.user && typeof state.user === "object") delete state.user.password;
  if (state.pending && typeof state.pending === "object") delete state.pending.password;
  if (signedOut) {
    delete state.orders;
    delete state.addresses;
    delete state.mail;
    delete state.souqMail;
    delete state.staff;
    delete state.pending;
    delete state.promoRedemptions;
    delete state.notes;
    delete state.listings;
    delete state.user;
  }
  return state;
}

export function mergeDeviceSession(
  persisted: any,
  current: any,
  flags: { liveUser: boolean; livePending: boolean; joinPending: any },
) {
  const raw = persisted && typeof persisted === "object" ? { ...persisted } : {};
  scrubStoredSession(raw);
  const next = { ...(current ?? {}) };
  const wasSignedIn = raw.signedIn === true || Boolean(raw.user && (raw.user.phone || raw.user.username || raw.user.displayName));
  if (raw.lang === "ar" || raw.lang === "en") next.lang = raw.lang;
  if (!flags.liveUser && wasSignedIn) {
    next.signedIn = true;
    next.follows = safeStrings(raw.follows);
    next.pageLikes = safeStrings(raw.pageLikes);
    next.interestWords = safeStrings(raw.interestWords, 24);
    next.mutedWords = safeStrings(raw.mutedWords, 40);
    next.recentSlugs = safeStrings(raw.recentSlugs, 24);
    next.user = current?.user ?? null;
    next.accounts = current?.user ? current.accounts : {};
    next.orders = current?.user ? current.orders ?? [] : [];
    next.addresses = current?.user ? current.addresses ?? [] : [];
    next.mail = current?.user ? current.mail ?? [] : [];
    next.souqMail = current?.user ? current.souqMail ?? [] : [];
    next.staff = false;
  }
  if (!flags.liveUser && !wasSignedIn) {
    next.signedIn = false;
    next.user = null;
    next.accounts = {};
    next.orders = [];
    next.addresses = [];
    next.mail = [];
    next.souqMail = [];
    next.follows = [];
    next.pageLikes = [];
    next.interestWords = [];
    next.mutedWords = [];
    next.recentSlugs = [];
    next.notes = [];
    next.listings = [];
    next.staff = false;
  }
  if (flags.liveUser) {
    next.user = current.user;
    next.signedIn = Boolean(current.user) || current.signedIn === true;
    next.accounts = current.accounts;
    next.addresses = current.addresses;
    next.orders = current.orders;
    next.follows = current.follows;
    next.pageLikes = current.pageLikes;
    next.interestWords = current.interestWords;
    next.mutedWords = current.mutedWords;
    next.recentSlugs = current.recentSlugs;
    next.mail = current.mail;
    next.listings = current.listings;
    next.staff = current.staff;
  }
  if (flags.livePending) next.pending = current.pending ?? flags.joinPending;
  if (!next.pending?.phone && flags.joinPending?.phone) next.pending = flags.joinPending;
  return next;
}

export function deviceMarkKey(key: string) {
  return key === "souq-sync-token" || key.startsWith("souq-places-moved:");
}
