import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PLANS, SELLER_CATEGORY_IDS, SHOP_WHATSAPP, WHATSAPP_REQUIRED, normalizePlan, type Shop } from "@/lib/data";
import { rankHello } from "@/lib/hello";
import { checkPromo } from "@/lib/promo-codes";
import { allowTestOtp, productionDatabaseMissing } from "@/lib/runtime-flags";
import { allowDailyCodeSend, resetUnsent, signupUnsent } from "@/lib/otp-limit";
import { queueOwnedMedia, sweepHelloStorage } from "@/lib/hello-cleanup";
import { effectivePlan } from "@/lib/hello-archive";
import { isReservedBrand, usernameKey } from "@/lib/reserved-brand";
import { assignShopSlug, renameShopSlug } from "@/lib/shop-slug";
import { decideLogin } from "@/lib/login-guard";
import { slugHasPhone, souqWriteAllowed } from "@/lib/site";
import { allowPhotoUpload, allowReport, allowReviewWrite, deleteBuyerReview, fileReport, reviewAuthorName, shopAcceptsReviews, writeBuyerReview } from "@/lib/abuse";
import { deleteConfirmedAccount, releaseOwnedMedia } from "@/lib/account-delete";
import { buyerReplyHref, readShopOrders, replyLinkForShop, sellerShopSlug } from "@/lib/shop-orders";
import { encodeShopPhoto, saveShopPhoto } from "@/lib/object-store";
import { searchLiveShops } from "@/lib/public-search";

const COOKIE = "souq_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const OTP_SECONDS = 60 * 5;
const MAX_OTP_ATTEMPTS = 5;
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const BCRYPT_COST = 12;
const passwordSchema = z
  .string()
  .min(8)
  .max(80)
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/);

const ORDER_STATUS = z.enum(["new", "preparing", "done", "cancelled"]);
const SELLER_CAT = z.enum(SELLER_CATEGORY_IDS);
const PLAN = z.enum(["free", "basic", "pro", "premium", "grow"]);

const profileSchema = z
  .object({
    username: z.string().trim().min(2).max(40),
    displayName: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    address: z.string().trim().max(200).optional(),
    bio: z.string().trim().max(500).optional(),
    intent: z.enum(["buyer", "seller"]).optional(),
    plan: PLAN.optional(),
    categories: z.array(SELLER_CAT).max(2).optional(),
    promoCode: z.string().trim().max(40).optional(),
    areaLat: z.number().finite().optional(),
    areaLng: z.number().finite().optional(),
    shopName: z.string().trim().min(2).max(80).optional(),
    referral: z.string().trim().max(40).optional(),
    billingPeriod: z.enum(["monthly", "yearly"]).optional(),
    paymentStatus: z.enum(["pending", "active"]).optional(),
    paymentMethod: z.enum(["free", "cliq", "card"]).optional(),
    paymentRef: z.string().trim().max(80).optional(),
    pendingPlan: PLAN.optional(),
    whatsappPhone: z.string().trim().max(20).optional(),
  })
  .strict();

const pushSchema = z
  .object({
    displayName: z.string().trim().max(80).optional(),
    username: z.string().trim().min(2).max(40).optional(),
    city: z.string().trim().max(80).optional(),
    bio: z.string().trim().max(500).optional(),
    address: z.string().trim().max(200).optional(),
    categories: z.array(SELLER_CAT).max(2).optional(),
    stallOpens: z.string().trim().max(8).optional(),
    stallCloses: z.string().trim().max(8).optional(),
    stallDays: z.string().trim().max(40).optional(),
    stallBio: z.string().trim().max(500).optional(),
    stallBioAr: z.string().trim().max(500).optional(),
    findWords: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    droppedKeywords: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    stallAvatar: z.string().trim().max(500).optional(),
    stallCover: z.string().trim().max(500).optional(),
    stallHours: z.string().trim().max(80).optional(),
    stallForce: z.enum(["auto", "open", "closed"]).optional(),
    whatsappPhone: z.string().trim().max(20).optional(),
    googleShopping: z.boolean().optional(),
    shopName: z.string().trim().min(2).max(80).optional(),
  });

type Profile = z.infer<typeof profileSchema>;

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function tx<T>(fn: (sql: Awaited<ReturnType<typeof db>>) => Promise<T>) {
  const { withSqlTransaction } = await import("@/lib/db");
  return withSqlTransaction(fn);
}

function planIdOf(plan: string | null | undefined) {
  return normalizePlan(plan);
}

function membershipPaused(account: { plan: string | null; data?: Record<string, unknown> | null }) {
  const blob = account.data ?? {};
  const plan = account.plan || "free";
  const ends = typeof blob.planEnds === "number" ? blob.planEnds : 0;
  const pending = blob.paymentStatus === "pending" && blob.pendingPlan && !ends;
  const graceOver = Boolean(ends) && Date.now() > ends + (plan === "free" ? 0 : 5 * 86400000);
  return Boolean(pending || graceOver);
}

type Kit = {
  createHash: typeof import("node:crypto").createHash;
  randomBytes: typeof import("node:crypto").randomBytes;
  randomInt: typeof import("node:crypto").randomInt;
  timingSafeEqual: typeof import("node:crypto").timingSafeEqual;
  hash: typeof import("bcryptjs").hash;
  compare: typeof import("bcryptjs").compare;
  setCookie: typeof import("@tanstack/react-start/server").setCookie;
  deleteCookie: typeof import("@tanstack/react-start/server").deleteCookie;
  getCookie: typeof import("@tanstack/react-start/server").getCookie;
  getRequest: typeof import("@tanstack/react-start/server").getRequest;
  getRequestIP: typeof import("@tanstack/react-start/server").getRequestIP;
};

async function kit(): Promise<Kit> {
  const [crypto, bcrypt, http] = await Promise.all([
    import("node:crypto"),
    import("bcryptjs"),
    import("@tanstack/react-start/server"),
  ]);
  return {
    createHash: crypto.createHash,
    randomBytes: crypto.randomBytes,
    randomInt: crypto.randomInt,
    timingSafeEqual: crypto.timingSafeEqual,
    hash: bcrypt.hash,
    compare: bcrypt.compare,
    setCookie: http.setCookie,
    deleteCookie: http.deleteCookie,
    getCookie: http.getCookie,
    getRequest: http.getRequest,
    getRequestIP: http.getRequestIP,
  };
}

function sha256(s: Kit, value: string) {
  return s.createHash("sha256").update(value).digest("hex");
}

function hashOtp(s: Kit, code: string, salt: string) {
  return s.createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function otpMatches(s: Kit, code: string, salt: string, digest: string) {
  const next = Buffer.from(hashOtp(s, code, salt));
  const prev = Buffer.from(digest);
  return next.length === prev.length && s.timingSafeEqual(next, prev);
}

function crossSiteWrite(s: Kit) {
  try {
    const request = s.getRequest();
    if (!request || request.method !== "POST") return false;
    return !souqWriteAllowed(request);
  } catch {
    return false;
  }
}

function clientIp(s: Kit) {
  try {
    return s.getRequestIP({ xForwardedFor: true }) || "unknown";
  } catch {
    return "unknown";
  }
}

function cookieSecure() {
  return true;
}

function setSessionCookie(s: Kit, token: string) {
  s.setCookie(COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

function clearSessionCookie(s: Kit) {
  s.deleteCookie(COOKIE, { path: "/" });
}

async function hitRate(sql: Awaited<ReturnType<typeof db>>, bucket: string, limit: number, windowSeconds: number) {
  const rows = await sql<{ hits: number }>`
    insert into souq_rate (bucket, hits, window_start)
    values (${bucket}, 1, now())
    on conflict (bucket) do update set
      hits = case
        when souq_rate.window_start < now() - (${windowSeconds} * interval '1 second') then 1
        else souq_rate.hits + 1
      end,
      window_start = case
        when souq_rate.window_start < now() - (${windowSeconds} * interval '1 second') then now()
        else souq_rate.window_start
      end
    returning hits
  `;
  return Number(rows[0]?.hits ?? 1) <= limit;
}

async function sessionPhone(sql: Awaited<ReturnType<typeof db>>) {
  const s = await kit();
  if (crossSiteWrite(s)) return null;
  const token = s.getCookie(COOKIE);
  if (!token || token.length < 20) return null;
  const rows = await sql<{ phone: string }>`
    select phone from souq_tokens
    where token = ${sha256(s, token)}
      and (expires_at is null or expires_at > now())
  `;
  return rows[0]?.phone ?? null;
}

async function openSession(sql: Awaited<ReturnType<typeof db>>, s: Kit, phone: string) {
  const token = s.randomBytes(32).toString("hex");
  await sql`
    insert into souq_tokens (token, phone, expires_at)
    values (${sha256(s, token)}, ${phone}, now() + (${SESSION_SECONDS} * interval '1 second'))
  `;
  setSessionCookie(s, token);
}

function shopWa(raw: unknown) {
  const phone = canonPhone(String(raw ?? ""));
  return SHOP_WHATSAPP.test(phone) ? phone : "";
}

function canonPhone(raw: string) {
  let text = String(raw ?? "").trim().replace(/[\s().-]/g, "");
  if (text.startsWith("00")) text = `+${text.slice(2)}`;
  const digits = text.startsWith("+") ? text.slice(1).replace(/\D/g, "") : text.replace(/\D/g, "");
  if (/^9620?7\d{8}$/.test(digits)) return `+962${digits.slice(-9)}`;
  if (/^07\d{8}$/.test(digits)) return `+962${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `+962${digits}`;
  return digits ? `+${digits}` : "";
}

function publicProfile(phone: string, data: Record<string, unknown>, row: { role: string; shop_slug: string | null; plan: string | null }) {
  return {
    phone,
    username: String(data.username ?? ""),
    displayName: String(data.shopName || data.displayName || data.username || ""),
    shopName: String(data.shopName || data.displayName || ""),
    city: String(data.city ?? ""),
    bio: String(data.bio ?? ""),
    address: String(data.address ?? ""),
    role: row.role === "seller" ? "seller" : "buyer",
    sellerPlan: row.plan ?? undefined,
    shopSlug: row.shop_slug ?? undefined,
    planEnds: typeof data.planEnds === "number" ? data.planEnds : undefined,
    trial: data.trial === true,
    paymentStatus: typeof data.paymentStatus === "string" ? data.paymentStatus : undefined,
    pendingPlan: typeof data.pendingPlan === "string" ? data.pendingPlan : undefined,
    billingPeriod: data.billingPeriod === "yearly" ? "yearly" : data.billingPeriod === "monthly" ? "monthly" : undefined,
    paymentRef: typeof data.paymentRef === "string" ? data.paymentRef : undefined,
    categories: Array.isArray(data.categories) ? data.categories : undefined,
    whatsappPhone: typeof data.whatsappPhone === "string" ? data.whatsappPhone : undefined,
    stallOpens: typeof data.stallOpens === "string" ? data.stallOpens : undefined,
    stallCloses: typeof data.stallCloses === "string" ? data.stallCloses : undefined,
    stallDays: typeof data.stallDays === "string" ? data.stallDays : undefined,
    stallHours: typeof data.stallHours === "string" ? data.stallHours : undefined,
    stallForce: data.stallForce === "open" || data.stallForce === "closed" || data.stallForce === "auto" ? data.stallForce : undefined,
    stallBio: typeof data.stallBio === "string" ? data.stallBio : undefined,
    stallBioAr: typeof data.stallBioAr === "string" ? data.stallBioAr : undefined,
    googleShopping: data.googleShopping === false ? false : true,
    contactWhenClosed: typeof data.contactWhenClosed === "boolean" ? data.contactWhenClosed : undefined,
    areaLat: typeof data.areaLat === "number" ? data.areaLat : undefined,
    areaLng: typeof data.areaLng === "number" ? data.areaLng : undefined,
    joinedAt: typeof data.joinedAt === "number" ? data.joinedAt : undefined,
    usernameHistory: [],
  };
}

async function loadAccount(sql: Awaited<ReturnType<typeof db>>, phone: string) {
  const rows = await sql<{
    phone: string;
    password_hash: string | null;
    must_reset: boolean;
    phone_verified: boolean;
    failed_logins: number;
    locked_until: string | null;
    role: string;
    shop_slug: string | null;
    plan: string | null;
    data: Record<string, unknown>;
  }>`
    select phone, password_hash, must_reset, phone_verified, failed_logins, locked_until, role, shop_slug, plan, data
    from souq_accounts where phone = ${phone}
  `;
  return rows[0] ?? null;
}

function namesReserved(...values: unknown[]) {
  return values.some((value) => isReservedBrand(value));
}

function nameTakenError(error: unknown) {
  const err = error as { code?: string; constraint?: string } | null;
  if (!err) return false;
  if (err.code === "taken") return true;
  if (err.code !== "23505") return false;
  return !err.constraint || err.constraint === "souq_accounts_username_key";
}

async function rejectTakenUsername(sql: Awaited<ReturnType<typeof db>>, phone: string, username: string) {
  const key = usernameKey(username);
  if (!key) return;
  await sql`select pg_advisory_xact_lock(hashtext(${`souq-user:${key}`}))`;
  const rows = await sql<{ phone: string }>`
    select phone from souq_accounts
    where phone <> ${phone}
      and lower(btrim(regexp_replace(coalesce(data->>'username', ''), '\\s+', ' ', 'g'))) = ${key}
    limit 1
  `;
  if (rows[0]) {
    const err = new Error("taken") as Error & { code?: string };
    err.code = "taken";
    throw err;
  }
  const pending = await sql<{ phone: string }>`
    select phone from souq_pending
    where phone <> ${phone}
      and expires_at > now()
      and lower(btrim(regexp_replace(coalesce(profile->>'username', ''), '\\s+', ' ', 'g'))) = ${key}
    limit 1
  `;
  if (pending[0]) {
    const err = new Error("taken") as Error & { code?: string };
    err.code = "taken";
    throw err;
  }
}

export const stageSouqSignup = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().trim().min(8).max(20),
      password: passwordSchema,
      profile: profileSchema,
    }),
  )
  .handler(async ({ data: raw }) => {
    const data = { ...raw, phone: canonPhone(raw.phone) };
    if (data.profile.intent === "seller") {
      const whatsapp = shopWa(data.profile.whatsappPhone);
      if (!whatsapp) return { ok: false as const, error: "whatsapp" as const, message: WHATSAPP_REQUIRED };
      data.profile = { ...data.profile, whatsappPhone: whatsapp };
    }
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:stage:${ip}`, 10, 3600))) return { ok: false as const, error: "rate" as const };
    if (!(await hitRate(sql, `phone:stage:${data.phone}`, 6, 3600))) return { ok: false as const, error: "rate" as const };
    const existing = await loadAccount(sql, data.phone);
    if (existing && existing.phone_verified && !existing.must_reset) return { ok: false as const, error: "exists" as const };
    const profile = { ...data.profile, phone: data.phone };
    if (namesReserved(profile.username, profile.displayName, profile.shopName)) return { ok: false as const, error: "reserved" as const };
    const passwordHash = await s.hash(data.password, BCRYPT_COST);
    try {
      await tx(async (trx) => {
        await rejectTakenUsername(trx, data.phone, profile.username);
        await trx`
          insert into souq_pending (phone, password_hash, profile, expires_at)
          values (${data.phone}, ${passwordHash}, ${JSON.stringify(profile)}::jsonb, now() + interval '30 minutes')
          on conflict (phone) do update set
            password_hash = excluded.password_hash,
            profile = excluded.profile,
            expires_at = excluded.expires_at,
            created_at = now()
        `;
      });
    } catch (error) {
      if (nameTakenError(error)) return { ok: false as const, error: "taken" as const };
      console.error("[souq] stage failed", error);
      return { ok: false as const, error: "server" as const };
    }
    return { ok: true as const };
  });

export const setSouqSignupPlan = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().trim().min(8).max(20),
      plan: PLAN.optional(),
      promoCode: z.string().trim().max(40).optional(),
      categories: z.array(SELLER_CAT).max(2).optional(),
      shopName: z.string().trim().min(2).max(80).optional(),
      billingPeriod: z.enum(["monthly", "yearly"]).optional(),
      paymentStatus: z.enum(["pending", "active"]).optional(),
      paymentMethod: z.enum(["free", "cliq", "card"]).optional(),
      paymentRef: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ data: raw }) => {
    const data = { ...raw, phone: canonPhone(raw.phone) };
    const sql = await db();
    const rows = await sql<{ profile: Profile }>`
      select profile from souq_pending where phone = ${data.phone} and expires_at > now()
    `;
    const profile = rows[0]?.profile;
    if (!profile) return { ok: false as const, error: "missing" as const };
    if (!shopWa(profile.whatsappPhone)) return { ok: false as const, error: "whatsapp" as const, message: WHATSAPP_REQUIRED };
    const nextName = data.shopName || profile.shopName || profile.displayName;
    if (namesReserved(profile.username, profile.displayName, profile.shopName, data.shopName, nextName)) {
      return { ok: false as const, error: "reserved" as const };
    }
    const chosen = data.plan;
    const paid = chosen === "basic" || chosen === "pro" || chosen === "premium" || chosen === "grow";
    if (!(paid && data.paymentStatus === "pending") && !data.promoCode) {
      const used = await sql<{ phone: string }>`select phone from souq_trial_phones where phone = ${data.phone}`;
      if (used[0]) return { ok: false as const, error: "trial" as const };
    }
    const next = {
      ...profile,
      intent: "seller" as const,
      plan: data.plan,
      promoCode: data.promoCode,
      categories: data.categories ?? profile.categories,
      displayName: data.shopName || profile.displayName,
      shopName: data.shopName || profile.shopName || profile.displayName,
      billingPeriod: data.billingPeriod,
      paymentStatus: data.paymentStatus,
      paymentMethod: data.paymentMethod,
      paymentRef: data.paymentRef,
      pendingPlan: data.paymentStatus === "pending" ? data.plan : undefined,
    };
    await sql`update souq_pending set profile = ${JSON.stringify(next)}::jsonb where phone = ${data.phone}`;
    return { ok: true as const };
  });

export const sendSouqOtp = createServerFn({ method: "POST" })
  .validator(z.object({ phone: z.string().trim().min(8).max(20) }))
  .handler(async ({ data: raw }) => {
    const data = { ...raw, phone: canonPhone(raw.phone) };
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    const phone = data.phone;
    const pending = await sql<{ phone: string }>`
      select phone from souq_pending where phone = ${phone} and expires_at > now()
    `;
    const account = await loadAccount(sql, phone);
    const allowed = pending[0] || (account && account.must_reset);
    if (!allowed) return { ok: false as const, error: "missing" as const, retryAfter: 0 };
    const recent = await sql<{ sent_at: string }>`select sent_at from souq_otp where phone = ${phone}`;
    if (recent[0]) {
      const age = Date.now() - new Date(recent[0].sent_at).getTime();
      if (age < 60_000) {
        const retryAfter = Math.ceil((60_000 - age) / 1000);
        return { ok: false as const, error: "cooldown" as const, retryAfter };
      }
    }
    if (!(await hitRate(sql, `ip:otp:${ip}`, 8, 3600))) return { ok: false as const, error: "rate" as const, retryAfter: 3600 };
    if (!(await hitRate(sql, `phone:otp:${phone}`, 5, 3600))) return { ok: false as const, error: "rate" as const, retryAfter: 3600 };
    if (!(await allowDailyCodeSend((bucket, limit, windowSeconds) => hitRate(sql, bucket, limit, windowSeconds), ip, phone))) {
      return { ok: false as const, error: "rate" as const, retryAfter: 3600 };
    }
    const code = s.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const salt = s.randomBytes(16).toString("hex");
    const { sendWhatsAppCode } = await import("@/lib/whatsapp-otp");
    const sent = await sendWhatsAppCode(phone, code);
    if (!sent.ok) {
      const fallback = signupUnsent(sent.error, allowTestOtp());
      if (!fallback.ok) return { ok: false as const, error: fallback.error, retryAfter: 0 };
      return { ok: true as const, retryAfter: 60 };
    }
    await sql`
        insert into souq_otp (phone, code_hash, salt, expires_at, attempts, sent_at, purpose)
        values (${phone}, ${hashOtp(s, code, salt)}, ${salt}, now() + (${OTP_SECONDS} * interval '1 second'), 0, now(), 'signup')
        on conflict (phone) do update set
          code_hash = excluded.code_hash,
          salt = excluded.salt,
          expires_at = excluded.expires_at,
          attempts = 0,
          sent_at = now(),
          purpose = 'signup'
      `;
    return { ok: true as const, retryAfter: 60 };
  });

export const verifySouqOtp = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().trim().min(8).max(20),
      code: z.string().trim().regex(/^\d{6}$/),
    }),
  )
  .handler(async ({ data: raw }) => {
    const data = { ...raw, phone: canonPhone(raw.phone) };
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:verify:${ip}`, 20, 3600))) return { ok: false as const, error: "rate" as const };
    const allowTest = allowTestOtp();
    const testCode = data.code === "424242" && allowTest;
    const rows = await sql<{ code_hash: string; salt: string; attempts: number; expires_at: string; purpose: string }>`
      select code_hash, salt, attempts, expires_at, purpose from souq_otp where phone = ${data.phone}
    `;
    const otp = rows[0];
    if (!testCode) {
      if (!otp || otp.purpose === "reset" || otp.purpose === "delete") return { ok: false as const, error: "otp" as const };
      if (new Date(otp.expires_at).getTime() <= Date.now()) {
        await sql`delete from souq_otp where phone = ${data.phone}`;
        return { ok: false as const, error: "expired" as const };
      }
      if (otp.attempts >= MAX_OTP_ATTEMPTS) {
        await sql`delete from souq_otp where phone = ${data.phone}`;
        return { ok: false as const, error: "attempts" as const };
      }
      if (!otpMatches(s, data.code, otp.salt, otp.code_hash)) {
        await sql`update souq_otp set attempts = attempts + 1 where phone = ${data.phone}`;
        return { ok: false as const, error: "otp" as const };
      }
    }
    const pendingRows = await sql<{ password_hash: string; profile: Profile }>`
      select password_hash, profile from souq_pending where phone = ${data.phone} and expires_at > now()
    `;
    const pending = pendingRows[0];
    if (!pending) return { ok: false as const, error: "missing" as const };
    const profile = pending.profile;
    if (profile.intent === "seller") {
      const whatsapp = shopWa(profile.whatsappPhone);
      if (!whatsapp) return { ok: false as const, error: "whatsapp" as const, message: WHATSAPP_REQUIRED };
      profile.whatsappPhone = whatsapp;
    }
    const existing = await loadAccount(sql, data.phone);
    let role: "buyer" | "seller" = profile.intent === "seller" ? "seller" : "buyer";
    let plan: string | null = null;
    let slug: string | null = existing?.shop_slug ?? null;
    let planEnds: number | undefined;
    let paymentStatus: string | undefined;
    let pendingPlan: string | undefined;
    let billingPeriod: string | undefined;
    let promoGrant: { code: string; plan: string; months: number } | null = null;
    let wantsTrial = false;
    if (role === "seller") {
      const chosen = profile.pendingPlan || profile.plan;
      const paid = chosen === "basic" || chosen === "pro" || chosen === "premium" || chosen === "grow";
      const now = Date.now();
      plan = "basic";
      planEnds = now + 30 * 86400000;
      paymentStatus = "active";
      billingPeriod = profile.billingPeriod === "yearly" ? "yearly" : "monthly";
      if (profile.promoCode) {
        const used = await sql<{ code: string }>`select code from souq_promo_uses where code = ${profile.promoCode}`;
        const promo = checkPromo(profile.promoCode, used.map((row) => ({
          code: row.code,
          phone: "",
          plan: "free" as const,
          months: 0,
          at: 0,
          endsAt: 0,
        })));
        if (!promo.ok) return { ok: false as const, error: "promo" as const };
        plan = promo.promo.plan;
        planEnds = now + promo.promo.months * 30 * 86400000;
        promoGrant = { code: promo.promo.code, plan: promo.promo.plan, months: promo.promo.months };
      } else if (paid && profile.paymentStatus === "pending") {
        pendingPlan = chosen;
        paymentStatus = "pending";
        planEnds = undefined;
      } else {
        const usedTrial = await sql<{ phone: string }>`select phone from souq_trial_phones where phone = ${data.phone}`;
        if (usedTrial[0]) return { ok: false as const, error: "trial" as const };
        wantsTrial = true;
      }
    }
    if (role === "seller" && slug && slugHasPhone(slug)) slug = null;
    if (productionDatabaseMissing()) return { ok: false as const, error: "database" as const };
    const shopName = profile.shopName || profile.displayName || profile.username;
    const safe = {
      username: profile.username,
      displayName: shopName,
      shopName,
      city: profile.city ?? "",
      bio: profile.bio ?? "",
      address: profile.address ?? "",
      categories: profile.categories ?? [],
      areaLat: profile.areaLat,
      areaLng: profile.areaLng,
      referral: profile.referral,
      planEnds,
      paymentStatus,
      pendingPlan,
      billingPeriod,
      paymentRef: profile.paymentRef,
      paymentMethod: profile.paymentMethod,
      trial: wantsTrial,
      joinedAt: Date.now(),
      ...(role === "seller" ? { whatsappPhone: profile.whatsappPhone } : {}),
    };
    if (namesReserved(safe.username, safe.displayName, safe.shopName, slug)) return { ok: false as const, error: "reserved" as const };
    try {
      await tx(async (trx) => {
        await rejectTakenUsername(trx, data.phone, safe.username);
        if (wantsTrial && planEnds) {
          const locked = await trx<{ phone: string }>`
            insert into souq_trial_phones (phone, trial_start, trial_end)
            values (${data.phone}, now(), to_timestamp(${Math.floor(planEnds / 1000)}))
            on conflict (phone) do nothing
            returning phone
          `;
          if (!locked[0]) {
            const err = new Error("trial") as Error & { code?: string };
            err.code = "trial";
            throw err;
          }
        }
        if (role === "seller") {
          const owned = await trx<{ slug: string }>`select slug from souq_shops where owner_phone = ${data.phone} limit 1`;
          const current = owned[0]?.slug || slug || "";
          if (current && !slugHasPhone(current)) {
            slug = current;
          } else {
            const next = await assignShopSlug(trx, [shopName, profile.displayName, profile.username]);
            if (owned[0]) await renameShopSlug(trx, owned[0].slug, next, data.phone);
            slug = next;
          }
        }
        if (!existing) {
          await trx`
            insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan, failed_logins)
            values (${data.phone}, '', ${pending.password_hash}, ${JSON.stringify(safe)}::jsonb, false, true, ${role}, ${slug}, ${plan}, 0)
          `;
        } else {
          await trx`
            update souq_accounts set
              secret = '',
              password_hash = ${pending.password_hash},
              data = ${JSON.stringify({ ...(existing.data ?? {}), ...safe })}::jsonb,
              must_reset = false,
              phone_verified = true,
              failed_logins = 0,
              locked_until = null,
              role = ${role},
              shop_slug = ${slug},
              plan = ${plan},
              updated_at = now()
            where phone = ${data.phone}
          `;
          await trx`delete from souq_tokens where phone = ${data.phone}`;
        }
        if (role === "seller" && slug) {
          await trx`
            insert into souq_shops (slug, owner_phone, name, area, plan, category, publishable, name_hold)
            values (${slug}, ${data.phone}, ${safe.displayName}, ${safe.city}, ${plan ?? "free"}, ${(profile.categories ?? [])[0] ?? ""}, ${shopWa(profile.whatsappPhone) !== ""}, false)
            on conflict (slug) do update set
              owner_phone = excluded.owner_phone,
              name = excluded.name,
              area = excluded.area,
              plan = excluded.plan,
              category = excluded.category,
              publishable = excluded.publishable,
              name_hold = false,
              updated_at = now()
          `;
          await trx`
            insert into souq_views (shop_slug) values (${slug})
            on conflict (shop_slug) do nothing
          `;
        }
        if (promoGrant) {
          await trx`
            insert into souq_promo_uses (code, phone, plan, months)
            values (${promoGrant.code}, ${data.phone}, ${promoGrant.plan}, ${promoGrant.months})
            on conflict (code, phone) do nothing
          `;
        }
      });
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === "trial") {
        return { ok: false as const, error: "trial" as const };
      }
      if (nameTakenError(error)) return { ok: false as const, error: "taken" as const };
      console.error("[souq] signup failed", error);
      return { ok: false as const, error: "server" as const };
    }
    await sql`delete from souq_otp where phone = ${data.phone}`;
    await sql`delete from souq_pending where phone = ${data.phone}`;
    await openSession(sql, s, data.phone);
    const account = await loadAccount(sql, data.phone);
    return { ok: true as const, account: publicProfile(data.phone, safe, account ?? { role, shop_slug: slug, plan }) };
  });

export const claimSouq = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().trim().min(8).max(20),
      password: passwordSchema,
      asRole: z.enum(["buyer", "seller"]).optional(),
    }),
  )
  .handler(async ({ data: raw }) => {
    const data = { ...raw, phone: canonPhone(raw.phone) };
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:login:${ip}`, 30, 900))) return { ok: false as const, error: "lockout" as const };
    const account = await loadAccount(sql, data.phone);
    const decided = await decideLogin({
      account,
      password: data.password,
      asRole: data.asRole,
      compare: (password, hash) => s.compare(password, hash),
      lockAfter: LOCK_AFTER,
    });
    if (!decided.ok) {
      if (decided.error === "lockout" && decided.lock && account) {
        await sql`
          update souq_accounts
          set failed_logins = ${decided.fails ?? LOCK_AFTER}, locked_until = now() + (${LOCK_MINUTES} * interval '1 minute')
          where phone = ${data.phone}
        `;
      } else if (decided.error === "credentials" && decided.fails && account) {
        await sql`update souq_accounts set failed_logins = ${decided.fails} where phone = ${data.phone}`;
      }
      return { ok: false as const, error: decided.error };
    }
    if (!account) return { ok: false as const, error: "credentials" as const };
    await sql`update souq_accounts set failed_logins = 0, locked_until = null where phone = ${data.phone}`;
    await openSession(sql, s, data.phone);
    return { ok: true as const, account: publicProfile(data.phone, account.data ?? {}, account) };
  });

export const signOutSouq = createServerFn({ method: "POST" }).handler(async () => {
  const s = await kit();
  if (crossSiteWrite(s)) return { ok: false as const, error: "auth" as const };
  const sql = await db();
  const token = s.getCookie(COOKIE);
  if (token) await sql`delete from souq_tokens where token = ${sha256(s, token)}`;
  clearSessionCookie(s);
  return { ok: true as const };
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(z.object({ phone: z.string().trim().min(8).max(20) }))
  .handler(async ({ data: raw }) => {
    const phone = canonPhone(raw.phone);
    if (!/^\+\d{8,15}$/.test(phone)) return { ok: false as const, error: "phone" as const };
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:otp:${ip}`, 8, 3600))) return { ok: false as const, error: "rate" as const };
    if (!(await hitRate(sql, `phone:otp:${phone}`, 5, 3600))) return { ok: false as const, error: "rate" as const };
    const account = await loadAccount(sql, phone);
    if (!account?.phone_verified) return { ok: true as const, retryAfter: 60 };
    const recent = await sql<{ sent_at: string; purpose: string }>`
      select sent_at, purpose from souq_otp where phone = ${phone}
    `;
    const age = recent[0] ? Date.now() - new Date(recent[0].sent_at).getTime() : 60_000;
    if (recent[0]?.purpose === "reset" && age < 60_000) return { ok: true as const, retryAfter: 60 };
    if (!(await allowDailyCodeSend((bucket, limit, windowSeconds) => hitRate(sql, bucket, limit, windowSeconds), ip, phone))) {
      return { ok: false as const, error: "rate" as const };
    }
    const code = s.randomInt(0, 1_000_000).toString().padStart(6, "0");
    let store = code;
    try {
      const { sendWhatsAppCode } = await import("@/lib/whatsapp-otp");
      const sent = await sendWhatsAppCode(phone, code);
      if (!sent.ok) {
        const fallback = resetUnsent(sent.error, allowTestOtp());
        if (!fallback.ok) return { ok: false as const, error: "unconfigured" as const };
        if (!fallback.storeTest) return { ok: true as const, retryAfter: 60 };
        store = "424242";
      }
    } catch (error) {
      console.error("[souq] reset code failed", error);
      return { ok: true as const, retryAfter: 60 };
    }
    const salt = s.randomBytes(16).toString("hex");
    await sql`
      insert into souq_otp (phone, code_hash, salt, expires_at, attempts, sent_at, purpose)
      values (${phone}, ${hashOtp(s, store, salt)}, ${salt}, now() + (${OTP_SECONDS} * interval '1 second'), 0, now(), 'reset')
      on conflict (phone) do update set
        code_hash = excluded.code_hash,
        salt = excluded.salt,
        expires_at = excluded.expires_at,
        attempts = 0,
        sent_at = now(),
        purpose = 'reset'
    `;
    return { ok: true as const, retryAfter: 60 };
  });

export const confirmPasswordReset = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().trim().min(8).max(20),
      code: z.string().trim().regex(/^\d{6}$/),
      password: z.string().min(8).max(80),
    }),
  )
  .handler(async ({ data: raw }) => {
    const phone = canonPhone(raw.phone);
    if (!passwordSchema.safeParse(raw.password).success) return { ok: false as const, error: "password" as const };
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:reset:${ip}`, 30, 3600))) return { ok: false as const, error: "rate" as const };
    const rows = await sql<{ code_hash: string; salt: string; attempts: number; expires_at: string; purpose: string }>`
      select code_hash, salt, attempts, expires_at, purpose from souq_otp where phone = ${phone}
    `;
    const otp = rows[0];
    if (!otp || otp.purpose !== "reset") {
      if (!(await hitRate(sql, `phone:reset-guess:${phone}`, 5, 3600))) return { ok: false as const, error: "attempts" as const };
      return { ok: false as const, error: "otp" as const };
    }
    if (new Date(otp.expires_at).getTime() <= Date.now()) {
      await sql`delete from souq_otp where phone = ${phone}`;
      return { ok: false as const, error: "expired" as const };
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await sql`delete from souq_otp where phone = ${phone}`;
      return { ok: false as const, error: "attempts" as const };
    }
    if (!otpMatches(s, raw.code, otp.salt, otp.code_hash)) {
      await sql`update souq_otp set attempts = attempts + 1 where phone = ${phone}`;
      return { ok: false as const, error: "otp" as const };
    }
    const account = await loadAccount(sql, phone);
    if (!account?.phone_verified) return { ok: false as const, error: "otp" as const };
    const passwordHash = await s.hash(raw.password, BCRYPT_COST);
    await sql`
      update souq_accounts set
        password_hash = ${passwordHash},
        must_reset = false,
        failed_logins = 0,
        locked_until = null,
        updated_at = now()
      where phone = ${phone}
    `;
    await sql`delete from souq_tokens where phone = ${phone}`;
    await sql`delete from souq_otp where phone = ${phone}`;
    clearSessionCookie(s);
    return { ok: true as const };
  });

type AlgoField = { value: string[]; updatedAt: number };
type AlgoBox = {
  interestWords?: AlgoField;
  algoOrder?: AlgoField;
  mutedWords?: AlgoField;
  mutedStalls?: AlgoField;
};

function readAlgo(data: Record<string, unknown>) {
  const box = (data.algoFields ?? {}) as AlgoBox;
  const field = (key: keyof AlgoBox, legacy: unknown) => box[key]?.value ?? (Array.isArray(legacy) ? (legacy as string[]) : []);
  return {
    interestWords: field("interestWords", data.interestWords),
    algoOrder: field("algoOrder", data.algoOrder),
    mutedWords: field("mutedWords", data.mutedWords),
    mutedStalls: field("mutedStalls", data.mutedStalls),
    algoStamps: {
      interestWords: box.interestWords?.updatedAt ?? 0,
      algoOrder: box.algoOrder?.updatedAt ?? 0,
      mutedWords: box.mutedWords?.updatedAt ?? 0,
      mutedStalls: box.mutedStalls?.updatedAt ?? 0,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      /* body stayed a string */
    }
  }
  return {};
}

function listingFromRow(row: { id: string; shop_slug: string; name: string; price: string | number | null; image_url: string | null; images: unknown; body: unknown }) {
  const body = asRecord(row.body);
  const fromColumn = Array.isArray(row.images) ? row.images.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  const fromBody = Array.isArray(body.images) ? body.images.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  const images = fromColumn.length ? fromColumn : fromBody.length ? fromBody : [row.image_url].filter((item): item is string => Boolean(item));
  return {
    id: row.id,
    shopSlug: row.shop_slug,
    name: row.name,
    nameAr: typeof body.nameAr === "string" && body.nameAr ? body.nameAr : row.name,
    price: row.price == null ? 0 : Number(row.price),
    priceMode: typeof body.priceMode === "string" ? body.priceMode : "price",
    desc: typeof body.desc === "string" ? body.desc : "",
    descAr: typeof body.descAr === "string" ? body.descAr : "",
    images,
    ...(typeof body.video === "string" && body.video ? { video: body.video } : {}),
    ...(typeof body.group === "string" && body.group ? { group: body.group } : {}),
    ...(typeof body.groupAr === "string" && body.groupAr ? { groupAr: body.groupAr } : {}),
    ...(body.choices ? { choices: body.choices } : {}),
    ...(typeof body.chart === "string" && body.chart ? { chart: body.chart } : {}),
    ...(body.hidden === true ? { hidden: true, hideReason: body.hideReason, hideBack: body.hideBack } : {}),
  };
}

export const getSouqMe = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const phone = await sessionPhone(sql);
  if (!phone) return { ok: false as const, error: "auth" as const };
  const account = await loadAccount(sql, phone);
  if (!account) return { ok: false as const, error: "auth" as const };
  const orders = await sql<{ id: string; shop_slug: string; status: string; product_name: string; address_name: string }>`
    select id, shop_slug, status, product_name, address_name from souq_orders where buyer_phone = ${phone} order by created_at desc limit 100
  `;
  const listings = await sql<{ id: string; shop_slug: string; name: string; price: string | number | null; image_url: string | null; images: unknown; body: unknown }>`
    select id, shop_slug, name, price, image_url, images, body from souq_listings where owner_phone = ${phone} order by created_at asc
  `;
  const counts = account.shop_slug
    ? await sql<{ views: number; review_count: number; order_count: number }>`
        select views, review_count, order_count from souq_views where shop_slug = ${account.shop_slug}
      `
    : [];
    return {
    ok: true as const,
    account: {
      ...publicProfile(phone, account.data ?? {}, account),
      ...readAlgo(account.data ?? {}),
      stallViews: Number(counts[0]?.views ?? 0),
      orders: orders.map((order) => ({
        id: order.id,
        shopSlug: order.shop_slug,
        status: order.status,
        productName: order.product_name,
        addressName: order.address_name,
      })),
      listings: listings.map(listingFromRow),
    },
  };
});

export const listSouqAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const phone = await sessionPhone(sql);
  if (!phone) return { ok: false as const, error: "auth" as const };
  const admins = (process.env.SOUQ_ADMIN_PHONES ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!admins.includes(phone)) return { ok: false as const, error: "auth" as const };
  const shops = await sql<{ slug: string; name: string; area: string }>`
    select slug, name, area from souq_shops order by updated_at desc limit 200
  `;
  const listings = await sql<{ id: string; shop_slug: string; name: string; price: string | null; image_url: string | null }>`
    select id, shop_slug, name, price, image_url from souq_listings order by created_at desc limit 1000
  `;
  const byShop = new Map<string, { id: string; name: string; price: number | null; imageUrl: string | null }[]>();
  for (const item of listings) {
    const list = byShop.get(item.shop_slug) ?? [];
    list.push({
      id: item.id,
      name: item.name,
      price: item.price == null ? null : Number(item.price),
      imageUrl: item.image_url,
    });
    byShop.set(item.shop_slug, list);
  }
  return {
    ok: true as const,
    stalls: shops.map((shop) => ({
      name: shop.name,
      slug: shop.slug,
      area: shop.area,
      listings: byShop.get(shop.slug) ?? [],
    })),
  };
});

export const pushSouq = createServerFn({ method: "POST" })
  .validator(z.object({ account: z.unknown() }))
  .handler(async ({ data }) => {
    const parsed = pushSchema.safeParse(data.account);
    if (!parsed.success) return { ok: false as const, error: "invalid" as const };
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    if (!account) return { ok: false as const, error: "auth" as const };
    const next = { ...(account.data ?? {}) };
    for (const key of ["password", "role", "sellerPlan", "plan", "shopSlug", "orders", "messages", "phone", "interestWords", "algoOrder", "mutedWords", "mutedStalls", "algoUpdatedAt"] as const) {
      delete next[key];
    }
    const incoming = { ...parsed.data };
    if (incoming.findWords) {
      incoming.findWords = incoming.findWords.slice(0, PLANS[planIdOf(account.plan)].keywords);
    }
    Object.assign(next, incoming);
    if (typeof parsed.data.displayName === "string" && parsed.data.displayName.trim() && (account.role === "seller" || isReservedBrand(next.shopName))) {
      next.shopName = parsed.data.displayName.trim();
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "whatsappPhone")) {
      const incoming = shopWa(parsed.data.whatsappPhone);
      const current = shopWa(account.data?.whatsappPhone);
      if (!incoming) return { ok: false as const, error: "whatsapp" as const, message: WHATSAPP_REQUIRED };
      next.whatsappPhone = current && incoming !== current ? current : current || undefined;
      if (!current) delete next.whatsappPhone;
    }
    for (const key of ["stallAvatar", "stallCover"] as const) {
      const value = next[key];
      if (typeof value === "string" && value.startsWith("data:")) delete next[key];
    }
    if (namesReserved(next.username, next.displayName, next.shopName)) return { ok: false as const, error: "reserved" as const };
    const hold = isReservedBrand(account.shop_slug);
    try {
      await tx(async (trx) => {
        if (typeof next.username === "string") await rejectTakenUsername(trx, phone, next.username);
        await trx`
          update souq_accounts set data = ${JSON.stringify(next)}::jsonb, updated_at = now() where phone = ${phone}
        `;
        if (account.shop_slug) {
          const categories = Array.isArray(next.categories) ? (next.categories as string[]) : [];
          const words = Array.isArray(next.findWords) ? (next.findWords as string[]) : [];
          const avatar = typeof next.stallAvatar === "string" ? next.stallAvatar : null;
          const cover = typeof next.stallCover === "string" ? next.stallCover : null;
          await trx`
            update souq_shops set
              name = ${String(next.displayName || next.shopName || next.username || account.shop_slug)},
              area = ${String(next.city ?? "")},
              category = ${categories[0] ?? ""},
              keywords = ${JSON.stringify(words)}::jsonb,
              bio = ${String(next.stallBio || next.bio || "")},
              avatar_url = ${avatar},
              cover_url = ${cover},
              thumb_url = ${avatar},
              demo = case when ${next.demo === true} then true else demo end,
              publishable = ${shopWa(next.whatsappPhone) !== ""},
              name_hold = ${hold},
              updated_at = now()
            where slug = ${account.shop_slug} and owner_phone = ${phone}
          `;
        }
      });
    } catch (error) {
      if (nameTakenError(error)) return { ok: false as const, error: "taken" as const };
      console.error("[souq] profile save failed", error);
      return { ok: false as const, error: "server" as const };
    }
    return { ok: true as const };
  });

export const requestWhatsappChange = createServerFn({ method: "POST" })
  .validator(z.object({ phone: z.string().trim().min(8).max(20) }))
  .handler(async ({ data }) => {
    const whatsapp = shopWa(data.phone);
    if (!whatsapp) return { ok: false as const, error: "whatsapp" as const, message: WHATSAPP_REQUIRED };
    const s = await kit();
    const sql = await db();
    const owner = await sessionPhone(sql);
    if (!owner) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, owner);
    if (!account || account.role !== "seller") return { ok: false as const, error: "auth" as const };
    const current = shopWa(account.data?.whatsappPhone);
    if (current && current === whatsapp) return { ok: true as const, phone: whatsapp, same: true as const };
    const taken = await sql<{ phone: string }>`
      select phone from souq_accounts
      where phone <> ${owner}
        and (phone = ${whatsapp} or data->>'whatsappPhone' = ${whatsapp})
      limit 1
    `;
    if (taken[0]) return { ok: false as const, error: "whatsapp" as const, message: WHATSAPP_REQUIRED };
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:wa:${ip}`, 8, 3600))) return { ok: false as const, error: "rate" as const };
    if (!(await hitRate(sql, `phone:wa:${whatsapp}`, 5, 3600))) return { ok: false as const, error: "rate" as const };
    const recent = await sql<{ sent_at: string }>`select sent_at from souq_otp where phone = ${whatsapp}`;
    if (recent[0] && Date.now() - new Date(recent[0].sent_at).getTime() < 60_000) {
      return { ok: false as const, error: "cooldown" as const };
    }
    if (!(await allowDailyCodeSend((bucket, limit, windowSeconds) => hitRate(sql, bucket, limit, windowSeconds), ip, whatsapp))) {
      return { ok: false as const, error: "rate" as const };
    }
    const code = s.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const salt = s.randomBytes(16).toString("hex");
    const { sendWhatsAppCode } = await import("@/lib/whatsapp-otp");
    const sent = await sendWhatsAppCode(whatsapp, code);
    if (!sent.ok && !(sent.error === "unconfigured" && allowTestOtp())) {
      return { ok: false as const, error: sent.error === "unconfigured" ? "unconfigured" as const : "send" as const };
    }
    if (sent.ok || allowTestOtp()) {
      await sql`
        insert into souq_otp (phone, code_hash, salt, expires_at, attempts, sent_at, purpose)
        values (${whatsapp}, ${hashOtp(s, code, salt)}, ${salt}, now() + (${OTP_SECONDS} * interval '1 second'), 0, now(), 'whatsapp')
        on conflict (phone) do update set
          code_hash = excluded.code_hash,
          salt = excluded.salt,
          expires_at = excluded.expires_at,
          attempts = 0,
          sent_at = now(),
          purpose = 'whatsapp'
      `;
    }
    const next = { ...(account.data ?? {}), pendingWhatsapp: whatsapp };
    await sql`update souq_accounts set data = ${JSON.stringify(next)}::jsonb, updated_at = now() where phone = ${owner}`;
    return { ok: true as const, phone: whatsapp };
  });

export const confirmWhatsappChange = createServerFn({ method: "POST" })
  .validator(z.object({
    phone: z.string().trim().min(8).max(20),
    code: z.string().trim().regex(/^\d{6}$/),
  }))
  .handler(async ({ data }) => {
    const whatsapp = shopWa(data.phone);
    if (!whatsapp) return { ok: false as const, error: "whatsapp" as const, message: WHATSAPP_REQUIRED };
    const s = await kit();
    const sql = await db();
    const owner = await sessionPhone(sql);
    if (!owner) return { ok: false as const, error: "auth" as const };
    if (!(await hitRate(sql, `ip:wa-confirm:${clientIp(s)}`, 20, 3600))) return { ok: false as const, error: "rate" as const };
    const account = await loadAccount(sql, owner);
    if (!account || account.role !== "seller") return { ok: false as const, error: "auth" as const };
    if (account.data?.pendingWhatsapp !== whatsapp) return { ok: false as const, error: "otp" as const };
    const rows = await sql<{ code_hash: string; salt: string; attempts: number; expires_at: string; purpose: string }>`
      select code_hash, salt, attempts, expires_at, purpose from souq_otp where phone = ${whatsapp}
    `;
    const otp = rows[0];
    const testCode = data.code === "424242" && allowTestOtp();
    if (!testCode) {
      if (!otp || otp.purpose !== "whatsapp") return { ok: false as const, error: "otp" as const };
      if (new Date(otp.expires_at).getTime() <= Date.now()) return { ok: false as const, error: "expired" as const };
      if (otp.attempts >= MAX_OTP_ATTEMPTS) return { ok: false as const, error: "attempts" as const };
      if (!otpMatches(s, data.code, otp.salt, otp.code_hash)) {
        await sql`update souq_otp set attempts = attempts + 1 where phone = ${whatsapp}`;
        return { ok: false as const, error: "otp" as const };
      }
    }
    const taken = await sql<{ phone: string }>`
      select phone from souq_accounts
      where phone <> ${owner}
        and (phone = ${whatsapp} or data->>'whatsappPhone' = ${whatsapp})
      limit 1
    `;
    if (taken[0]) return { ok: false as const, error: "whatsapp" as const, message: WHATSAPP_REQUIRED };
    const previous = shopWa(account.data?.whatsappPhone);
    const next = { ...(account.data ?? {}), whatsappPhone: whatsapp };
    delete next.pendingWhatsapp;
    await sql`update souq_accounts set data = ${JSON.stringify(next)}::jsonb, updated_at = now() where phone = ${owner}`;
    if (account.shop_slug) {
      await sql`update souq_shops set publishable = true, updated_at = now() where slug = ${account.shop_slug} and owner_phone = ${owner}`;
    }
    await sql`delete from souq_otp where phone = ${whatsapp}`;
    if (previous && previous !== whatsapp) {
      const { sendWhatsAppNotice } = await import("@/lib/whatsapp-otp");
      await sendWhatsAppNotice(previous, "Souq Battuta: the WhatsApp number on your shop was changed. If this was not you, sign in and set it back.");
    }
    return { ok: true as const, phone: whatsapp };
  });

const algoField = z.object({
  value: z.array(z.string().trim().min(1).max(80)).max(40),
  updatedAt: z.number().int().nonnegative(),
});

export const syncSouqAlgo = createServerFn({ method: "POST" })
  .validator(
    z.object({
      interestWords: algoField.optional(),
      algoOrder: algoField.optional(),
      mutedWords: algoField.optional(),
      mutedStalls: algoField.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    if (!account) return { ok: false as const, error: "auth" as const };
    const blob = { ...(account.data ?? {}) } as Record<string, unknown>;
    const box = { ...((blob.algoFields ?? {}) as AlgoBox) };
    for (const key of ["interestWords", "algoOrder", "mutedWords", "mutedStalls"] as const) {
      const incoming = data[key];
      if (!incoming) continue;
      const prev = box[key]?.updatedAt ?? 0;
      if (incoming.updatedAt >= prev) box[key] = incoming;
    }
    blob.algoFields = box;
    delete blob.interestWords;
    delete blob.algoOrder;
    delete blob.mutedWords;
    delete blob.mutedStalls;
    await sql`update souq_accounts set data = ${JSON.stringify(blob)}::jsonb, updated_at = now() where phone = ${phone}`;
    return { ok: true as const, algo: readAlgo(blob) };
  });

export const shopTopItems = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    const sql = await db();
    const listings = await sql<{ id: string; name: string }>`
      select id, name from souq_listings where shop_slug = ${data.slug}
    `;
    const ids = new Set(listings.map((row) => row.id));
    const names = new Map(listings.map((row) => [row.id, row.name]));
    const done = await sql<{ product_name: string; n: number }>`
      select product_name, count(*)::int as n from souq_orders
      where shop_slug = ${data.slug} and status = 'done'
      group by product_name
    `;
    const byName = new Map(done.map((row) => [row.product_name, Number(row.n)]));
    const likes = new Map<string, number>();
    if (ids.size) {
      const accounts = await sql<{ data: { favorites?: unknown } }>`select data from souq_accounts`;
      for (const row of accounts) {
        const favs = row.data?.favorites;
        if (!Array.isArray(favs)) continue;
        for (const id of favs) {
          if (typeof id === "string" && ids.has(id)) likes.set(id, (likes.get(id) ?? 0) + 1);
        }
      }
    }
    const items = listings
      .map((row) => ({ id: row.id, name: names.get(row.id) || row.name, score: (likes.get(row.id) ?? 0) + (byName.get(row.name) ?? 0) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    return { ok: true as const, items };
  });

export const patchSouqOrder = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.string().trim().min(2).max(80), status: ORDER_STATUS }))
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    if (!account?.shop_slug || account.role !== "seller") return { ok: false as const, error: "auth" as const };
    const rows = await sql<{ shop_slug: string; status: string }>`
      select shop_slug, status from souq_orders where id = ${data.orderId}
    `;
    const order = rows[0];
    if (!order || order.shop_slug !== account.shop_slug) return { ok: false as const, error: "auth" as const };
    await sql`update souq_orders set status = ${data.status} where id = ${data.orderId}`;
    if (data.status === "done" && order.status !== "done") {
      await sql`
        insert into souq_views (shop_slug, order_count) values (${order.shop_slug}, 1)
        on conflict (shop_slug) do update set order_count = souq_views.order_count + 1
      `;
    }
    return { ok: true as const };
  });

export const placeSouqOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      shopSlug: z.string().trim().min(2).max(80),
      productName: z.string().trim().min(1).max(120),
      addressName: z.string().trim().max(160).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const open = await sql<{ slug: string; whatsapp: string | null }>`
      select s.slug, a.data->>'whatsappPhone' as whatsapp
      from souq_shops s
      join souq_accounts a on a.phone = s.owner_phone
      where s.slug = ${data.shopSlug}
        and s.hidden = false
        and s.name_hold = false
        and s.demo = false
        and s.publishable = true
        and a.data->>'whatsappPhone' ~ '^\\+9627[789][0-9]{7}$'
      limit 1
    `;
    if (!open[0]) return { ok: false as const, error: "phone" as const };
    if (!(await hitRate(sql, `order:day:${phone}`, 20, 86400))) return { ok: false as const, error: "rate" as const };
    if (!(await hitRate(sql, `order:hour:${phone}:${data.shopSlug}`, 5, 3600))) return { ok: false as const, error: "rate" as const };
    const waPhone = String(open[0].whatsapp ?? "").replace(/\D/g, "");
    if (!/^9627[789]\d{7}$/.test(waPhone)) return { ok: false as const, error: "phone" as const };
    const s = await kit();
    const id = `o-${s.randomBytes(8).toString("hex")}`;
    await sql`
      insert into souq_orders (id, shop_slug, buyer_phone, status, product_name, address_name)
      values (${id}, ${data.shopSlug}, ${phone}, 'new', ${data.productName}, ${data.addressName ?? ""})
    `;
    await sql`
      insert into souq_views (shop_slug, order_count) values (${data.shopSlug}, 1)
      on conflict (shop_slug) do update set order_count = souq_views.order_count + 1
    `;
    return { ok: true as const, id, waPhone };
  });

export const listShopOrders = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const phone = await sessionPhone(sql);
  if (!phone) return { ok: false as const, error: "auth" as const };
  const account = await loadAccount(sql, phone);
  const slug = sellerShopSlug(account);
  if (!slug) return { ok: false as const, error: "auth" as const };
  const orders = await readShopOrders(sql, slug);
  return { ok: true as const, orders };
});

export const orderReplyLink = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.string().trim().min(2).max(80) }).strict())
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    const slug = sellerShopSlug(account);
    if (!slug) return { ok: false as const, error: "auth" as const };
    const linked = await replyLinkForShop(sql, slug, data.orderId);
    if (!linked.ok) return linked;
    if (!(await hitRate(sql, `order-reply:${phone}`, 60, 3600))) return { ok: false as const, error: "rate" as const };
    const href = buyerReplyHref(linked.href.replace("https://wa.me/", ""));
    if (!href) return { ok: false as const, error: "missing" as const };
    return { ok: true as const, href };
  });

const JORDAN = { latMin: 29.18, latMax: 33.38, lngMin: 34.88, lngMax: 39.3 };
const placeBody = z.object({
  id: z.string().trim().min(2).max(40).optional(),
  name: z.string().trim().min(1).max(30),
  label: z.string().trim().max(160).optional(),
  lat: z.number().gte(JORDAN.latMin).lte(JORDAN.latMax),
  lng: z.number().gte(JORDAN.lngMin).lte(JORDAN.lngMax),
});

function placeRow(row: { id: string; name: string; label: string | null; lat: number; lng: number }) {
  return { id: row.id, name: row.name, line: row.label ?? "", lat: Number(row.lat), lng: Number(row.lng) };
}

export const listMyPlaces = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const phone = await sessionPhone(sql);
  if (!phone) return { ok: false as const, error: "auth" as const };
  const rows = await sql<{ id: string; name: string; label: string | null; lat: number; lng: number }>`
    select id, name, label, lat, lng from souq_buyer_places
    where owner_phone = ${phone}
    order by updated_at desc
    limit 10
  `;
  return { ok: true as const, places: rows.map(placeRow) };
});

export const saveMyPlace = createServerFn({ method: "POST" })
  .validator(placeBody)
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    if (!account || account.role === "seller") return { ok: false as const, error: "auth" as const };
    const label = data.label ?? "";
    if (data.id) {
      const rows = await sql<{ id: string; name: string; label: string | null; lat: number; lng: number }>`
        update souq_buyer_places
        set name = ${data.name}, label = ${label}, lat = ${data.lat}, lng = ${data.lng}, updated_at = now()
        where id = ${data.id} and owner_phone = ${phone}
        returning id, name, label, lat, lng
      `;
      if (!rows[0]) return { ok: false as const, error: "missing" as const };
      return { ok: true as const, place: placeRow(rows[0]) };
    }
    const count = await sql<{ n: number }>`select count(*)::int as n from souq_buyer_places where owner_phone = ${phone}`;
    if (Number(count[0]?.n ?? 0) >= 10) return { ok: false as const, error: "limit" as const };
    const s = await kit();
    const id = `p-${s.randomBytes(8).toString("hex")}`;
    const rows = await sql<{ id: string; name: string; label: string | null; lat: number; lng: number }>`
      insert into souq_buyer_places (id, owner_phone, name, label, lat, lng)
      values (${id}, ${phone}, ${data.name}, ${label}, ${data.lat}, ${data.lng})
      returning id, name, label, lat, lng
    `;
    return { ok: true as const, place: placeRow(rows[0]) };
  });

export const deleteMyPlace = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(2).max(40) }))
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const rows = await sql<{ id: string }>`
      delete from souq_buyer_places where id = ${data.id} and owner_phone = ${phone} returning id
    `;
    if (!rows[0]) return { ok: false as const, error: "missing" as const };
    return { ok: true as const };
  });

export const saveSouqReview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      shopSlug: z.string().trim().min(2).max(80),
      score: z.number().int().min(1).max(5),
      comment: z.string().trim().min(1).max(500),
      area: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const s = await kit();
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    if (!account || account.role !== "buyer") return { ok: false as const, error: "auth" as const };
    const shops = await sql<{ plan: string | null }>`select plan from souq_shops where slug = ${data.shopSlug} limit 1`;
    if (!shopAcceptsReviews(shops[0]?.plan)) return { ok: false as const, error: "plan" as const };
    const ip = clientIp(s);
    const authorName = reviewAuthorName(account.data);
    const area = String(account.data?.city ?? "").trim().slice(0, 80);
    const existing = await sql<{ id: string }>`
      select id from souq_reviews where shop_slug = ${data.shopSlug} and author_phone = ${phone} limit 1
    `;
    const ordered = await sql<{ id: string }>`
      select id from souq_orders
      where shop_slug = ${data.shopSlug} and buyer_phone = ${phone} and status = 'done'
      limit 1
    `;
    if (!ordered[0]) return { ok: false as const, error: "order" as const };
    if (!(await allowReviewWrite((bucket, limit, windowSeconds) => hitRate(sql, bucket, limit, windowSeconds), ip, phone))) {
      return { ok: false as const, error: "rate" as const };
    }
    const saved = await writeBuyerReview(sql, {
      phone,
      shopSlug: data.shopSlug,
      score: data.score,
      comment: data.comment,
      authorName,
      area,
      id: existing[0]?.id || `r-${s.randomBytes(8).toString("hex")}`,
    });
    if (!saved.ok) return saved;
    return { ok: true as const, id: saved.id };
  });

export const deleteSouqReview = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(2).max(40) }))
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    return deleteBuyerReview(sql, data.id, phone);
  });

export const submitSouqPayment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      plan: PLAN,
      billingPeriod: z.enum(["monthly", "yearly"]),
      paymentMethod: z.enum(["cliq", "card"]),
      paymentRef: z.string().trim().min(2).max(80),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    if (!account || account.role !== "seller") return { ok: false as const, error: "auth" as const };
    const next = {
      ...(account.data ?? {}),
      pendingPlan: data.plan,
      paymentStatus: "pending",
      paymentMethod: data.paymentMethod,
      paymentRef: data.paymentRef,
      billingPeriod: data.billingPeriod,
    };
    await sql`update souq_accounts set data = ${JSON.stringify(next)}::jsonb, updated_at = now() where phone = ${phone}`;
    return { ok: true as const };
  });

export const confirmSouqPayment = createServerFn({ method: "POST" })
  .validator(z.object({ phone: z.string().trim().min(8).max(20) }))
  .handler(async ({ data: raw }) => {
    const data = { ...raw, phone: canonPhone(raw.phone) };
    const sql = await db();
    const admin = await sessionPhone(sql);
    const admins = (process.env.SOUQ_ADMIN_PHONES ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    if (!admin || !admins.includes(admin)) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, data.phone);
    if (!account) return { ok: false as const, error: "missing" as const };
    const blob = account.data ?? {};
    const plan = typeof blob.pendingPlan === "string" ? blob.pendingPlan : account.plan || "free";
    const days = blob.billingPeriod === "yearly" ? 365 : 30;
    const oldEnd = typeof blob.planEnds === "number" ? blob.planEnds : 0;
    const now = Date.now();
    const base = oldEnd > 0 ? oldEnd : now;
    const planEnds = base + days * 86400000;
    const { pendingPlan: _pending, ...rest } = blob;
    const next = { ...rest, planEnds, paymentStatus: "active", sellerPlan: plan };
    await sql`update souq_accounts set plan = ${plan}, data = ${JSON.stringify(next)}::jsonb, updated_at = now() where phone = ${data.phone}`;
    if (account.shop_slug) {
      await sql`update souq_shops set plan = ${plan}, updated_at = now() where slug = ${account.shop_slug}`;
    }
    await sweepHelloStorage(data.phone);
    return { ok: true as const, plan, planEnds };
  });

export const recordShopView = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    const sql = await db();
    await sql`
      insert into souq_views (shop_slug, views) values (${data.slug}, 1)
      on conflict (shop_slug) do update set views = souq_views.views + 1
    `;
    const rows = await sql<{ views: number }>`select views from souq_views where shop_slug = ${data.slug}`;
    return { ok: true as const, views: Number(rows[0]?.views ?? 0) };
  });

export const saveSouqListing = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(2).max(80),
      name: z.string().trim().min(2).max(120),
      price: z.number().finite().min(0).max(1_000_000).optional(),
      imageUrl: z.string().trim().max(500).optional(),
      thumbUrl: z.string().trim().max(500).optional(),
      images: z.array(z.string().trim().max(500)).max(6).optional(),
      hidden: z.boolean().optional(),
      body: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (productionDatabaseMissing()) return { ok: false as const, error: "database" as const };
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    if (!account?.shop_slug || account.role !== "seller") return { ok: false as const, error: "auth" as const };
    if (membershipPaused(account)) return { ok: false as const, error: "paused" as const };
    const limits = PLANS[planIdOf(account.plan)];
    const images = (data.images ?? []).filter((url) => url && !url.startsWith("data:")).slice(0, limits.images);
    const image = (data.imageUrl && !data.imageUrl.startsWith("data:") ? data.imageUrl : images[0]) ?? null;
    const thumb = (data.thumbUrl && !data.thumbUrl.startsWith("data:") ? data.thumbUrl : image) ?? null;
    const body: Record<string, unknown> = { ...(data.body ?? {}), images, hidden: Boolean(data.hidden) };
    const cap = limits.descChars;
    if ((typeof body.desc === "string" && body.desc.length > cap) || (typeof body.descAr === "string" && body.descAr.length > cap)) {
      return { ok: false as const, error: "text" as const };
    }
    if (!limits.options) {
      delete body.choices;
      delete body.chart;
    }
    if (typeof body.video === "string" && (body.video.startsWith("data:") || (account.plan !== "premium" && account.plan !== "pro" && account.plan !== "grow"))) delete body.video;
    delete body.password;
    const existing = await sql<{ id: string }>`select id from souq_listings where id = ${data.id} and owner_phone = ${phone}`;
    if (!existing[0]) {
      const count = await sql<{ n: number }>`select count(*)::int as n from souq_listings where shop_slug = ${account.shop_slug} and owner_phone = ${phone}`;
      if (Number(count[0]?.n ?? 0) >= limits.listings) return { ok: false as const, error: "limit" as const };
    }
    await sql`
      insert into souq_listings (id, shop_slug, owner_phone, name, price, image_url, thumb_url, images, body)
      values (${data.id}, ${account.shop_slug}, ${phone}, ${data.name}, ${data.price ?? null}, ${image}, ${thumb}, ${JSON.stringify(images)}::jsonb, ${JSON.stringify(body)}::jsonb)
      on conflict (id) do update set
        name = excluded.name,
        price = excluded.price,
        image_url = excluded.image_url,
        thumb_url = excluded.thumb_url,
        images = excluded.images,
        body = excluded.body
      where souq_listings.owner_phone = ${phone}
    `;
    return { ok: true as const, imageUrl: image, images };
  });

export const deleteSouqListing = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const rows = await sql<{ image_url: string | null; thumb_url: string | null; images: unknown; body: unknown }>`
      select image_url, thumb_url, images, body from souq_listings where id = ${data.id} and owner_phone = ${phone}
    `;
    const row = rows[0];
    await sql`delete from souq_listings where id = ${data.id} and owner_phone = ${phone}`;
    if (row) {
      const body = row.body && typeof row.body === "object" ? row.body as { images?: unknown } : {};
      const urls: string[] = [];
      if (row.image_url) urls.push(row.image_url);
      if (row.thumb_url) urls.push(row.thumb_url);
      if (Array.isArray(row.images)) urls.push(...row.images.filter((url): url is string => typeof url === "string"));
      if (Array.isArray(body.images)) urls.push(...body.images.filter((url): url is string => typeof url === "string"));
      await queueOwnedMedia(phone, urls);
      await sweepHelloStorage(phone);
    }
    return { ok: true as const };
  });

export const setSouqListingHidden = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(2).max(80), hidden: z.boolean() }))
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    await sql`
      update souq_listings
      set body = coalesce(body, '{}'::jsonb) || ${JSON.stringify({ hidden: data.hidden })}::jsonb
      where id = ${data.id} and owner_phone = ${phone}
    `;
    return { ok: true as const };
  });

export const uploadListingImage = createServerFn({ method: "POST" })
  .validator(z.object({ dataUrl: z.string().max(7_000_000), kind: z.enum(["listing", "hello"]).optional() }))
  .handler(async ({ data }) => storeImage(data.dataUrl, data.kind ?? "listing"));

const HELLO_CAP: Record<string, number> = { free: 1, basic: 2, pro: 4, premium: 6, grow: 4 };

async function storeImage(dataUrl: string, kind: "listing" | "hello") {
  const s = await kit();
  const sql = await db();
  const phone = await sessionPhone(sql);
  if (!phone) return { ok: false as const, error: "auth" as const };
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return { ok: false as const, error: "type" as const };
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 5_000_000) return { ok: false as const, error: "size" as const };
  const encoded = await encodeShopPhoto(bytes, kind);
  if (!encoded.ok) return { ok: false as const, error: "type" as const };
  if (!(await allowPhotoUpload((bucket, limit, windowSeconds) => hitRate(sql, bucket, limit, windowSeconds), phone))) {
    return { ok: false as const, error: "rate" as const };
  }
  const id = s.randomBytes(8).toString("hex");
  return saveShopPhoto({ kind, phoneHash: sha256(s, phone), id, main: encoded.main, thumb: encoded.thumb });
}

export const publishHello = createServerFn({ method: "POST" })
  .validator(z.object({
    text: z.string().trim().min(2).max(88),
    lang: z.enum(["en", "ar"]).optional(),
    image: z.string().min(8),
    listingId: z.string().trim().min(2).max(80).optional(),
  }))
  .handler(async ({ data }) => {
    try {
      if (productionDatabaseMissing()) return { ok: false as const, error: "database" as const };
      const sql = await db();
      const phone = await sessionPhone(sql);
      if (!phone) return { ok: false as const, error: "auth" as const };
      const account = await loadAccount(sql, phone);
      if (!account || account.role !== "seller" || !account.shop_slug) return { ok: false as const, error: "auth" as const };
      if (membershipPaused(account)) return { ok: false as const, error: "paused" as const };
      const plan = planIdOf(account.plan);
      const cap = HELLO_CAP[plan] ?? 1;
      let imageUrl = data.image;
      let thumbUrl = data.image;
      if (data.listingId) {
        const listings = await sql<{ image_url: string | null; thumb_url: string | null; images: unknown }>`
          select image_url, thumb_url, images from souq_listings
          where id = ${data.listingId} and owner_phone = ${phone}
        `;
        const listing = listings[0];
        const gallery = Array.isArray(listing?.images) ? listing.images.filter((url): url is string => typeof url === "string" && url.length > 0) : [];
        imageUrl = listing?.image_url || gallery[0] || "";
        thumbUrl = listing?.thumb_url || imageUrl;
        if (!imageUrl) return { ok: false as const, error: "type" as const };
      } else if (data.image.startsWith("data:")) {
        const stored = await storeImage(data.image, "hello");
        if (!stored.ok) return stored;
        imageUrl = stored.url;
        thumbUrl = stored.thumbUrl;
      } else if (!imageUrl.startsWith("/") && !imageUrl.startsWith("https://")) {
        return { ok: false as const, error: "type" as const };
      }
      const s = await kit();
      const id = `hw-${s.randomBytes(6).toString("hex")}`;
      const placed = await tx(async (trx) => {
        await trx`select pg_advisory_xact_lock(hashtext(${phone}))`;
        const spentRows = await trx<{ n: number }>`
          select count(*)::int as n from souq_hello_posts
          where owner_phone = ${phone} and created_at > now() - interval '24 hours'
        `;
        const spent = Number(spentRows[0]?.n ?? 0);
        if (spent >= cap) return { ok: false as const, error: "limit" as const, spent, cap };
        await trx`
          insert into souq_hello_posts (id, shop_slug, owner_phone, text, lang, image_url, thumb_url, expires_at, edit_until)
          values (${id}, ${account.shop_slug}, ${phone}, ${data.text}, ${data.lang ?? "en"}, ${imageUrl}, ${thumbUrl}, now() + interval '24 hours', now() + interval '15 minutes')
        `;
        return { ok: true as const, id, spent: spent + 1, cap, imageUrl, thumbUrl, at: Date.now() };
      });
      return placed;
    } catch (error) {
      console.error("[hello] publish failed", error);
      return { ok: false as const, error: "server" as const };
    }
  });

export const editHello = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(3).max(80), text: z.string().trim().min(2).max(88), image: z.string().optional() }))
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const rows = await sql<{ edit_until: string; image_url: string | null; thumb_url: string | null }>`
      select edit_until, image_url, thumb_url from souq_hello_posts
      where id = ${data.id} and owner_phone = ${phone} and status = 'live'
    `;
    const post = rows[0];
    if (!post) return { ok: false as const, error: "missing" as const };
    if (new Date(post.edit_until).getTime() < Date.now()) return { ok: false as const, error: "locked" as const };
    let imageUrl = post.image_url;
    let thumbUrl = post.thumb_url;
    if (data.image?.startsWith("data:")) {
      const stored = await storeImage(data.image, "hello");
      if (!stored.ok) return stored;
      imageUrl = stored.url;
      thumbUrl = stored.thumbUrl;
    }
    await sql`
      update souq_hello_posts set text = ${data.text}, image_url = ${imageUrl}, thumb_url = ${thumbUrl}
      where id = ${data.id} and owner_phone = ${phone}
    `;
    return { ok: true as const, imageUrl, thumbUrl };
  });

export const deleteHelloPost = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(3).max(80) }))
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const rows = await sql<{ image_url: string | null; thumb_url: string | null }>`
      select image_url, thumb_url from souq_hello_posts where id = ${data.id} and owner_phone = ${phone}
    `;
    const post = rows[0];
    if (!post) return { ok: false as const, error: "missing" as const };
    await sql`
      update souq_hello_posts
      set status = 'removed', image_url = null, thumb_url = null
      where id = ${data.id} and owner_phone = ${phone}
    `;
    await queueOwnedMedia(phone, [post.image_url || "", post.thumb_url || ""]);
    await sweepHelloStorage(phone);
    const spentRows = await sql<{ n: number }>`
      select count(*)::int as n from souq_hello_posts
      where owner_phone = ${phone} and created_at > now() - interval '24 hours'
    `;
    const account = await loadAccount(sql, phone);
    const cap = HELLO_CAP[account?.plan || "free"] ?? 1;
    return { ok: true as const, spent: Number(spentRows[0]?.n ?? 0), cap };
  });

export const repostHello = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(3).max(80) }))
  .handler(async ({ data }) => {
    try {
      if (productionDatabaseMissing()) return { ok: false as const, error: "database" as const };
      const sql = await db();
      const phone = await sessionPhone(sql);
      if (!phone) return { ok: false as const, error: "auth" as const };
      const account = await loadAccount(sql, phone);
      if (!account || account.role !== "seller" || !account.shop_slug) return { ok: false as const, error: "auth" as const };
      if (membershipPaused(account)) return { ok: false as const, error: "paused" as const };
      const ends = typeof account.data?.planEnds === "number" ? account.data.planEnds : 0;
      if (effectivePlan(account.plan, ends, Date.now()) !== "premium") return { ok: false as const, error: "plan" as const };
      const cap = HELLO_CAP.premium;
      const rows = await sql<{ text: string; lang: string; thumb_url: string | null; status: string }>`
        select text, lang, thumb_url, status from souq_hello_posts
        where id = ${data.id} and owner_phone = ${phone}
      `;
      const source = rows[0];
      if (!source || source.status !== "archived" || !source.thumb_url) return { ok: false as const, error: "missing" as const };
      const s = await kit();
      const id = `hw-${s.randomBytes(6).toString("hex")}`;
      const lang = source.lang === "ar" ? "ar" : "en";
      const placed = await tx(async (trx) => {
        await trx`select pg_advisory_xact_lock(hashtext(${phone}))`;
        const spentRows = await trx<{ n: number }>`
          select count(*)::int as n from souq_hello_posts
          where owner_phone = ${phone} and created_at > now() - interval '24 hours'
        `;
        const spent = Number(spentRows[0]?.n ?? 0);
        if (spent >= cap) return { ok: false as const, error: "limit" as const, spent, cap };
        await trx`
          insert into souq_hello_posts (id, shop_slug, owner_phone, text, lang, image_url, thumb_url, expires_at, edit_until)
          values (${id}, ${account.shop_slug}, ${phone}, ${source.text}, ${lang}, ${source.thumb_url}, ${source.thumb_url}, now() + interval '24 hours', now() + interval '15 minutes')
        `;
        return {
          ok: true as const,
          id,
          spent: spent + 1,
          cap,
          imageUrl: source.thumb_url as string,
          thumbUrl: source.thumb_url as string,
          at: Date.now(),
          text: source.text,
          lang: lang as "en" | "ar",
        };
      });
      return placed;
    } catch (error) {
      console.error("[hello] repost failed", error);
      return { ok: false as const, error: "server" as const };
    }
  });

export const helloQuota = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const phone = await sessionPhone(sql);
  if (!phone) return { ok: false as const, error: "auth" as const };
  const account = await loadAccount(sql, phone);
  if (!account || account.role !== "seller") return { ok: false as const, error: "auth" as const };
  try {
    await sweepHelloStorage(phone);
  } catch (error) {
    console.error("[hello] sweep failed", error);
  }
  const plan = account.plan || "free";
  const cap = HELLO_CAP[plan] ?? 1;
  const spentRows = await sql<{ n: number }>`
    select count(*)::int as n from souq_hello_posts
    where owner_phone = ${phone} and created_at > now() - interval '24 hours'
  `;
  const rows = await sql<{
    id: string;
    shop_slug: string;
    text: string;
    lang: string;
    image_url: string | null;
    thumb_url: string | null;
    created_at: string;
    expires_at: string;
    edit_until: string;
    views: number;
    hearts: number;
    status: string;
  }>`
    select id, shop_slug, text, lang, image_url, thumb_url, created_at, expires_at, edit_until, views, hearts, status
    from souq_hello_posts
    where owner_phone = ${phone} and status <> 'removed'
    order by created_at desc
    limit 80
  `;
  const now = Date.now();
  return {
    ok: true as const,
    spent: Number(spentRows[0]?.n ?? 0),
    cap,
    posts: rows.map((row) => {
      const expiresAt = new Date(row.expires_at).getTime();
      const live = row.status === "live" && expiresAt > now;
      return {
        id: row.id,
        shopSlug: row.shop_slug,
        text: row.text,
        lang: row.lang === "ar" ? "ar" as const : "en" as const,
        image: row.thumb_url || row.image_url || "",
        full: live ? row.image_url || "" : "",
        at: new Date(row.created_at).getTime(),
        expiresAt,
        editUntil: new Date(row.edit_until).getTime(),
        views: Number(row.views ?? 0),
        hearts: Number(row.hearts ?? 0),
        status: row.status === "hidden" ? "hidden" as const : live ? "live" as const : "archived" as const,
      };
    }),
  };
});

export const listPublicShops = createServerFn({ method: "GET" })
  .validator(z.object({ cursor: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(20).optional() }).optional())
  .handler(async ({ data }) => {
    const sql = await db();
    const limit = data?.limit ?? 20;
    const cursor = data?.cursor ?? 0;
    const nowMs = Date.now();
    const rows = await sql<{
      slug: string;
      name: string;
      area: string;
      plan: string;
      category: string;
      keywords: unknown;
      bio: string;
      avatar_url: string | null;
      cover_url: string | null;
      thumb_url: string | null;
      created_at: string;
      stall_opens: string | null;
      stall_closes: string | null;
      stall_days: string | null;
      stall_hours: string | null;
      stall_force: string | null;
      bio_ar: string | null;
    }>`
      select s.slug, s.name, s.area, s.plan, s.category, s.keywords, s.bio, s.avatar_url, s.cover_url, s.thumb_url, s.created_at,
        a.data->>'stallOpens' as stall_opens,
        a.data->>'stallCloses' as stall_closes,
        a.data->>'stallDays' as stall_days,
        a.data->>'stallHours' as stall_hours,
        a.data->>'stallForce' as stall_force,
        a.data->>'stallBioAr' as bio_ar
      from souq_shops s
      join souq_accounts a on a.phone = s.owner_phone
      where s.hidden = false
        and s.name_hold = false
        and s.demo = false
        and coalesce(a.data->>'demo', 'false') <> 'true'
        and s.publishable = true
        and a.data->>'whatsappPhone' ~ '^\\+9627[789][0-9]{7}$'
        and (
          coalesce(nullif(a.data->>'planEnds', '')::bigint, 0) = 0
          or (a.data->>'planEnds')::bigint > ${nowMs}
          or (s.plan <> 'free' and (a.data->>'planEnds')::bigint + ${5 * 86400000} > ${nowMs})
        )
      order by s.created_at desc
      limit ${limit} offset ${cursor}
    `;
    const slugs = rows.map((row) => row.slug);
    const listings = slugs.length
      ? await sql<{ id: string; shop_slug: string; name: string; price: string | null; image_url: string | null; thumb_url: string | null; images: unknown }>`
          select id, shop_slug, name, price, image_url, thumb_url, images from souq_listings
          where shop_slug = any(${slugs}::text[])
            and coalesce(body->>'hidden', 'false') <> 'true'
            and coalesce(body->>'demo', 'false') <> 'true'
        `
      : [];
    return {
      ok: true as const,
      shops: rows.map((row) => {
        const rawWords = Array.isArray(row.keywords)
          ? row.keywords
          : typeof row.keywords === "string"
            ? (() => { try { return JSON.parse(row.keywords as string); } catch { return []; } })()
            : [];
        const words = (Array.isArray(rawWords) ? rawWords : []).filter((word): word is string => typeof word === "string");
        const items = listings.filter((item) => item.shop_slug === row.slug).slice(0, 12);
        const photo = row.thumb_url || row.avatar_url || row.cover_url || items[0]?.thumb_url || items[0]?.image_url || "";
        return {
          slug: row.slug,
          name: row.name,
          area: row.area,
          plan: row.plan,
          category: row.category || "misc",
          keywords: words,
          bio: row.bio,
          bioAr: row.bio_ar || row.bio,
          hasWhatsapp: true,
          stallOpens: row.stall_opens || "",
          stallCloses: row.stall_closes || "",
          stallDays: row.stall_days || "",
          stallHours: row.stall_hours || "",
          stallForce: row.stall_force || "",
          avatar: photo,
          cover: row.cover_url || photo,
          createdAt: new Date(row.created_at).getTime(),
          products: items.map((item) => {
            const gallery = Array.isArray(item.images) ? item.images.filter((src): src is string => typeof src === "string" && src.length > 0) : [];
            const full = item.image_url || gallery[0] || item.thumb_url || "";
            return {
              id: item.id,
              name: item.name,
              price: item.price == null ? 0 : Number(item.price),
              image: item.thumb_url || gallery[0] || full,
              full,
              images: gallery.length ? gallery : [full].filter(Boolean),
            };
          }),
        };
      }),
    };
  });

export const searchPublicShops = createServerFn({ method: "POST" })
  .validator(
    z.object({
      q: z.string().trim().max(80),
      follows: z.array(z.string().trim().min(1).max(80)).max(80).optional(),
    }).strict(),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    let follows: string[] = [];
    let interestWords: string[] = [];
    if (phone) {
      const account = await loadAccount(sql, phone);
      const stored = account?.data?.follows;
      const fromAccount = Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
      follows = [...new Set([...fromAccount, ...(data.follows ?? [])])].slice(0, 80);
      interestWords = account ? readAlgo(account.data ?? {}).interestWords.filter((word) => typeof word === "string") : [];
    }
    const shops = await searchLiveShops(sql, { query: data.q, follows, interestWords });
    return { ok: true as const, shops };
  });

export const listHello = createServerFn({ method: "GET" })
  .validator(z.object({
    cursor: z.number().int().nonnegative().optional(),
    limit: z.number().int().min(1).max(20).optional(),
    follows: z.array(z.string().trim().min(1).max(80)).max(80).optional(),
    words: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  }).optional())
  .handler(async ({ data }) => {
    const sql = await db();
    const limit = data?.limit ?? 20;
    const cursor = data?.cursor ?? 0;
    const rows = await sql<{
      id: string;
      shop_slug: string;
      text: string;
      lang: string;
      image_url: string | null;
      thumb_url: string | null;
      created_at: string;
      expires_at: string;
      views: number;
      hearts: number;
      shop_name: string | null;
      keywords: unknown;
      category: string | null;
    }>`
      select p.id, p.shop_slug, p.text, p.lang, p.image_url, p.thumb_url, p.created_at, p.expires_at, p.views, p.hearts,
             s.name as shop_name, s.keywords, s.category
      from souq_hello_posts p
      left join souq_shops s on s.slug = p.shop_slug and s.hidden = false and s.name_hold = false and s.demo = false
      where p.status = 'live' and p.expires_at > now()
        and exists (
          select 1 from souq_shops pub
          join souq_accounts owner on owner.phone = pub.owner_phone
          where pub.slug = p.shop_slug
            and pub.hidden = false
            and pub.name_hold = false
            and pub.demo = false
            and owner.data->>'whatsappPhone' ~ '^\\+9627[789][0-9]{7}$'
        )
        and not exists (
          select 1 from souq_shops blocked
          where blocked.slug = p.shop_slug and (blocked.hidden or blocked.name_hold or blocked.demo)
        )
      order by p.created_at desc
    `;
    const posts = rows.map((row) => ({
      id: row.id,
      shopSlug: row.shop_slug,
      text: row.text,
      lang: row.lang === "ar" ? "ar" as const : "en" as const,
      image: row.thumb_url || row.image_url || "",
      full: row.image_url || row.thumb_url || "",
      at: new Date(row.created_at).getTime(),
      expiresAt: new Date(row.expires_at).getTime(),
      views: Number(row.views ?? 0),
      hearts: Number(row.hearts ?? 0),
      status: "live" as const,
      shopName: row.shop_name ?? "",
      keywords: Array.isArray(row.keywords) ? row.keywords.filter((word): word is string => typeof word === "string") : [],
      category: row.category ?? "",
    }));
    const shops = posts.map((post) => ({
      slug: post.shopSlug,
      name: post.shopName,
      nameAr: post.shopName,
      keywords: post.keywords,
      category: post.category || "misc",
    }));
    const ranked = rankHello(posts, { words: data?.words ?? [], follows: data?.follows ?? [], shops: shops as Shop[] });
    const page = ranked.slice(cursor, cursor + limit);
    return { ok: true as const, posts: page };
  });

export const reportTarget = createServerFn({ method: "POST" })
  .validator(z.object({
    targetType: z.enum(["hello", "shop"]),
    targetId: z.string().trim().min(2).max(80),
    reason: z.string().trim().max(240).optional(),
  }))
  .handler(async ({ data }) => {
    const s = await kit();
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const ip = clientIp(s);
    const prior = await sql<{ id: string }>`
      select id from souq_reports
      where target_type = ${data.targetType} and target_id = ${data.targetId} and reporter_phone = ${phone}
      limit 1
    `;
    if (!prior[0] && !(await allowReport((bucket, limit, windowSeconds) => hitRate(sql, bucket, limit, windowSeconds), ip, phone))) {
      return { ok: false as const, error: "rate" as const };
    }
    const id = `rp-${s.randomBytes(6).toString("hex")}`;
    await fileReport(sql, {
      id,
      targetType: data.targetType,
      targetId: data.targetId,
      phone,
      reason: data.reason ?? "",
    });
    return { ok: true as const };
  });

async function requireAdmin(sql: Awaited<ReturnType<typeof db>>) {
  const phone = await sessionPhone(sql);
  const admins = (process.env.SOUQ_ADMIN_PHONES ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!phone || !admins.includes(phone)) return null;
  return phone;
}

export const adminReports = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  if (!(await requireAdmin(sql))) return { ok: false as const, error: "auth" as const };
  const rows = await sql<{
    id: string;
    target_type: string;
    target_id: string;
    reporter_phone: string;
    reason: string;
    status: string;
    note: string;
    created_at: string;
    hello_text: string | null;
    shop_name: string | null;
  }>`
    select r.id, r.target_type, r.target_id, r.reporter_phone, r.reason, r.status, r.note, r.created_at,
           h.text as hello_text, s.name as shop_name
    from souq_reports r
    left join souq_hello_posts h on r.target_type = 'hello' and h.id = r.target_id
    left join souq_shops s on r.target_type = 'shop' and s.slug = r.target_id
    order by r.created_at desc
    limit 100
  `;
  return { ok: true as const, reports: rows };
});

export const adminModerate = createServerFn({ method: "POST" })
  .validator(z.object({
    targetType: z.enum(["hello", "shop"]),
    targetId: z.string().trim().min(2).max(80),
    action: z.enum(["hide", "remove", "keep"]),
    note: z.string().trim().max(240).optional(),
  }))
  .handler(async ({ data }) => {
    const sql = await db();
    if (!(await requireAdmin(sql))) return { ok: false as const, error: "auth" as const };
    const status = data.action === "keep" ? "kept" : data.action === "remove" ? "removed" : "hidden";
    await sql`
      update souq_reports set status = ${status}, note = ${data.note ?? ""}
      where target_type = ${data.targetType} and target_id = ${data.targetId}
    `;
    if (data.targetType === "hello") {
      const next = data.action === "keep" ? "live" : data.action === "remove" ? "removed" : "hidden";
      await sql`update souq_hello_posts set status = ${next} where id = ${data.targetId}`;
    } else if (data.action === "keep") {
      await sql`update souq_shops set hidden = false where slug = ${data.targetId}`;
    } else {
      await sql`update souq_shops set hidden = true where slug = ${data.targetId}`;
    }
    return { ok: true as const };
  });

export const getPublicShop = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().trim().min(1).max(80) }))
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    const { loadShopPage } = await import("@/lib/public-catalog");
    const page = await loadShopPage(data.slug, phone);
    if (page.shop || !slugHasPhone(data.slug)) return page;
    const { lookupSlugRedirect } = await import("@/lib/shop-slug");
    const next = await lookupSlugRedirect(sql, data.slug);
    if (!next) return page;
    return { ...page, redirect: next };
  });

export const requestAccountDeleteCode = createServerFn({ method: "POST" }).handler(async () => {
  const s = await kit();
  const sql = await db();
  const phone = await sessionPhone(sql);
  if (!phone) return { ok: false as const, error: "auth" as const };
  const account = await loadAccount(sql, phone);
  if (!account) return { ok: false as const, error: "auth" as const };
  const whatsapp = shopWa(account.data?.whatsappPhone);
  if (!whatsapp) return { ok: true as const, needed: false as const };
  const ip = clientIp(s);
  const recent = await sql<{ sent_at: string }>`select sent_at from souq_otp where phone = ${whatsapp}`;
  if (recent[0] && Date.now() - new Date(recent[0].sent_at).getTime() < 60_000) {
    return { ok: false as const, error: "cooldown" as const };
  }
  if (!(await hitRate(sql, `ip:otp:${ip}`, 8, 3600))) return { ok: false as const, error: "rate" as const };
  if (!(await hitRate(sql, `phone:otp:${whatsapp}`, 5, 3600))) return { ok: false as const, error: "rate" as const };
  if (!(await allowDailyCodeSend((bucket, limit, windowSeconds) => hitRate(sql, bucket, limit, windowSeconds), ip, whatsapp))) {
    return { ok: false as const, error: "rate" as const };
  }
  const code = s.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const salt = s.randomBytes(16).toString("hex");
  const { sendWhatsAppCode } = await import("@/lib/whatsapp-otp");
  const sent = await sendWhatsAppCode(whatsapp, code);
  if (!sent.ok && !(sent.error === "unconfigured" && allowTestOtp())) {
    return { ok: false as const, error: sent.error === "unconfigured" ? "unconfigured" as const : "send" as const };
  }
  if (sent.ok || allowTestOtp()) {
    await sql`
      insert into souq_otp (phone, code_hash, salt, expires_at, attempts, sent_at, purpose)
      values (${whatsapp}, ${hashOtp(s, code, salt)}, ${salt}, now() + (${OTP_SECONDS} * interval '1 second'), 0, now(), 'delete')
      on conflict (phone) do update set
        code_hash = excluded.code_hash,
        salt = excluded.salt,
        expires_at = excluded.expires_at,
        attempts = 0,
        sent_at = now(),
        purpose = 'delete'
    `;
  }
  return { ok: true as const, needed: true as const };
});

export const deleteSouqAccount = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z.string().trim().min(1).max(40),
      password: z.string().min(1).max(80),
      code: z.string().trim().max(8).optional(),
    }).strict(),
  )
  .handler(async ({ data }) => {
    const s = await kit();
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:delete:${ip}`, 30, 3600))) return { ok: false as const, error: "rate" as const };
    if (!(await hitRate(sql, `phone:delete:${phone}`, 10, 3600))) return { ok: false as const, error: "rate" as const };
    const account = await loadAccount(sql, phone);
    if (!account) return { ok: false as const, error: "auth" as const };
    const whatsapp = shopWa(account.data?.whatsappPhone);
    const result = await deleteConfirmedAccount(sql, {
      phone,
      username: data.username,
      password: data.password,
      code: data.code,
      whatsapp,
      allowTestCode: allowTestOtp(),
      passwordMatches: (password, hash) => s.compare(password, hash),
      codeMatches: (code, salt, digest) => otpMatches(s, code, salt, digest),
      transact: (fn) => tx(fn),
    });
    if (!result.ok) return { ok: false as const, error: result.error === "missing" ? "auth" as const : result.error };
    try {
      await queueOwnedMedia(phone, result.urls);
      await releaseOwnedMedia(sql, result.urls);
      await sweepHelloStorage();
    } catch {
      /* the account row is already gone; still drop the cookie */
    }
    clearSessionCookie(s);
    return { ok: true as const };
  });

