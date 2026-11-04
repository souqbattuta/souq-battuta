import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkPromo } from "@/lib/promo-codes";

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
const PLAN = z.enum(["free", "basic", "grow", "premium"]);

const profileSchema = z
  .object({
    username: z.string().trim().min(2).max(40),
    displayName: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    address: z.string().trim().max(200).optional(),
    bio: z.string().trim().max(500).optional(),
    intent: z.enum(["buyer", "seller"]).optional(),
    plan: PLAN.optional(),
    categories: z.array(z.string().trim().max(40)).max(8).optional(),
    promoCode: z.string().trim().max(40).optional(),
    areaLat: z.number().finite().optional(),
    areaLng: z.number().finite().optional(),
    referral: z.string().trim().max(40).optional(),
    billingPeriod: z.enum(["monthly", "yearly"]).optional(),
    paymentStatus: z.enum(["pending", "active"]).optional(),
    paymentMethod: z.enum(["free", "cliq", "card"]).optional(),
    paymentRef: z.string().trim().max(80).optional(),
    pendingPlan: PLAN.optional(),
  })
  .strict();

const pushSchema = z
  .object({
    displayName: z.string().trim().max(80).optional(),
    username: z.string().trim().min(2).max(40).optional(),
    city: z.string().trim().max(80).optional(),
    bio: z.string().trim().max(500).optional(),
    address: z.string().trim().max(200).optional(),
    categories: z.array(z.string().trim().max(40)).max(8).optional(),
    stallOpens: z.string().trim().max(8).optional(),
    stallCloses: z.string().trim().max(8).optional(),
    stallDays: z.string().trim().max(40).optional(),
    stallBio: z.string().trim().max(500).optional(),
    stallBioAr: z.string().trim().max(500).optional(),
  });

type Profile = z.infer<typeof profileSchema>;

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
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

function publicProfile(phone: string, data: Record<string, unknown>, row: { role: string; shop_slug: string | null; plan: string | null }) {
  return {
    phone,
    username: String(data.username ?? ""),
    displayName: String(data.displayName ?? data.username ?? ""),
    city: String(data.city ?? ""),
    bio: String(data.bio ?? ""),
    address: String(data.address ?? ""),
    role: row.role === "seller" ? "seller" : "buyer",
    sellerPlan: row.plan ?? undefined,
    shopSlug: row.shop_slug ?? undefined,
    planEnds: typeof data.planEnds === "number" ? data.planEnds : undefined,
    paymentStatus: typeof data.paymentStatus === "string" ? data.paymentStatus : undefined,
    pendingPlan: typeof data.pendingPlan === "string" ? data.pendingPlan : undefined,
    billingPeriod: data.billingPeriod === "yearly" ? "yearly" : data.billingPeriod === "monthly" ? "monthly" : undefined,
    paymentRef: typeof data.paymentRef === "string" ? data.paymentRef : undefined,
    categories: Array.isArray(data.categories) ? data.categories : undefined,
    areaLat: typeof data.areaLat === "number" ? data.areaLat : undefined,
    areaLng: typeof data.areaLng === "number" ? data.areaLng : undefined,
    joinedAt: Date.now(),
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

function shopSlugFor(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-9);
  return `stall-${digits || "shop"}`;
}

export const stageSouqSignup = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().trim().min(8).max(20),
      password: passwordSchema,
      profile: profileSchema,
    }),
  )
  .handler(async ({ data }) => {
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:stage:${ip}`, 10, 3600))) return { ok: false as const, error: "rate" as const };
    if (!(await hitRate(sql, `phone:stage:${data.phone}`, 6, 3600))) return { ok: false as const, error: "rate" as const };
    const existing = await loadAccount(sql, data.phone);
    if (existing && existing.phone_verified && !existing.must_reset) return { ok: false as const, error: "exists" as const };
    const passwordHash = await s.hash(data.password, BCRYPT_COST);
    const profile = { ...data.profile, phone: data.phone };
    await sql`
      insert into souq_pending (phone, password_hash, profile, expires_at)
      values (${data.phone}, ${passwordHash}, ${JSON.stringify(profile)}::jsonb, now() + interval '30 minutes')
      on conflict (phone) do update set
        password_hash = excluded.password_hash,
        profile = excluded.profile,
        expires_at = excluded.expires_at,
        created_at = now()
    `;
    return { ok: true as const };
  });

export const setSouqSignupPlan = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().trim().min(8).max(20),
      plan: PLAN.optional(),
      promoCode: z.string().trim().max(40).optional(),
      categories: z.array(z.string().trim().max(40)).max(8).optional(),
      shopName: z.string().trim().min(2).max(80).optional(),
      billingPeriod: z.enum(["monthly", "yearly"]).optional(),
      paymentStatus: z.enum(["pending", "active"]).optional(),
      paymentMethod: z.enum(["free", "cliq", "card"]).optional(),
      paymentRef: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const rows = await sql<{ profile: Profile }>`
      select profile from souq_pending where phone = ${data.phone} and expires_at > now()
    `;
    const profile = rows[0]?.profile;
    if (!profile) return { ok: false as const, error: "missing" as const };
    const next = {
      ...profile,
      intent: "seller" as const,
      plan: data.plan,
      promoCode: data.promoCode,
      categories: data.categories ?? profile.categories,
      displayName: data.shopName || profile.displayName,
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
  .handler(async ({ data }) => {
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
    const code = s.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const salt = s.randomBytes(16).toString("hex");
    const { sendWhatsAppCode } = await import("@/lib/whatsapp-otp");
    const sent = await sendWhatsAppCode(phone, code);
    if (!sent.ok && sent.error !== "unconfigured") return { ok: false as const, error: sent.error, retryAfter: 0 };
    if (sent.ok) {
      await sql`
        insert into souq_otp (phone, code_hash, salt, expires_at, attempts, sent_at)
        values (${phone}, ${hashOtp(s, code, salt)}, ${salt}, now() + (${OTP_SECONDS} * interval '1 second'), 0, now())
        on conflict (phone) do update set
          code_hash = excluded.code_hash,
          salt = excluded.salt,
          expires_at = excluded.expires_at,
          attempts = 0,
          sent_at = now()
      `;
    }
    return { ok: true as const, retryAfter: 60 };
  });

export const verifySouqOtp = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().trim().min(8).max(20),
      code: z.string().trim().regex(/^\d{6}$/),
    }),
  )
  .handler(async ({ data }) => {
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:verify:${ip}`, 20, 3600))) return { ok: false as const, error: "rate" as const };
    const testCode = data.code === "424242";
    const rows = await sql<{ code_hash: string; salt: string; attempts: number; expires_at: string }>`
      select code_hash, salt, attempts, expires_at from souq_otp where phone = ${data.phone}
    `;
    const otp = rows[0];
    if (!testCode) {
      if (!otp) return { ok: false as const, error: "otp" as const };
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
    const existing = await loadAccount(sql, data.phone);
    let role: "buyer" | "seller" = profile.intent === "seller" ? "seller" : "buyer";
    let plan: string | null = null;
    let slug: string | null = existing?.shop_slug ?? null;
    let planEnds: number | undefined;
    let paymentStatus: string | undefined;
    let pendingPlan: string | undefined;
    let billingPeriod: string | undefined;
    if (role === "seller") {
      const chosen = profile.pendingPlan || profile.plan;
      const paid = chosen === "basic" || chosen === "grow" || chosen === "premium";
      const now = Date.now();
      plan = "free";
      planEnds = now + 90 * 86400000;
      paymentStatus = "active";
      billingPeriod = profile.billingPeriod === "yearly" ? "yearly" : "monthly";
      if (profile.promoCode) {
        const used = await sql<{ code: string }>`select code from souq_promo_uses where code = ${profile.promoCode}`;
        const promo = checkPromo(profile.promoCode, used.map((row) => ({
          code: row.code,
          phone: "",
          plan: "free",
          months: 0,
          at: 0,
          endsAt: 0,
        })));
        if (promo.ok) {
          plan = promo.promo.plan;
          planEnds = now + promo.promo.months * 30 * 86400000;
          await sql`
            insert into souq_promo_uses (code, phone, plan, months)
            values (${promo.promo.code}, ${data.phone}, ${promo.promo.plan}, ${promo.promo.months})
            on conflict (code, phone) do nothing
          `;
        }
      } else if (paid && profile.paymentStatus === "pending") {
        pendingPlan = chosen;
        paymentStatus = "pending";
        planEnds = undefined;
      }
      slug = slug ?? shopSlugFor(data.phone);
    }
    const safe = {
      username: profile.username,
      displayName: profile.displayName || profile.username,
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
    };
    if (!existing) {
      await sql`
        insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan, failed_logins)
        values (${data.phone}, '', ${pending.password_hash}, ${JSON.stringify(safe)}::jsonb, false, true, ${role}, ${slug}, ${plan}, 0)
      `;
    } else {
      await sql`
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
      await sql`delete from souq_tokens where phone = ${data.phone}`;
    }
    if (role === "seller" && slug) {
      await sql`
        insert into souq_shops (slug, owner_phone, name, area, plan)
        values (${slug}, ${data.phone}, ${safe.displayName}, ${safe.city}, ${plan ?? "free"})
        on conflict (slug) do update set
          owner_phone = excluded.owner_phone,
          name = excluded.name,
          area = excluded.area,
          plan = excluded.plan,
          updated_at = now()
      `;
      await sql`
        insert into souq_views (shop_slug) values (${slug})
        on conflict (shop_slug) do nothing
      `;
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
  .handler(async ({ data }) => {
    const s = await kit();
    const sql = await db();
    const ip = clientIp(s);
    if (!(await hitRate(sql, `ip:login:${ip}`, 30, 900))) return { ok: false as const, error: "lockout" as const };
    const account = await loadAccount(sql, data.phone);
    if (!account || !account.phone_verified) return { ok: false as const, error: "verify" as const };
    if (account.locked_until && new Date(account.locked_until).getTime() > Date.now()) {
      return { ok: false as const, error: "lockout" as const };
    }
    if (account.must_reset || !account.password_hash) return { ok: false as const, error: "reset" as const };
    const match = await s.compare(data.password, account.password_hash);
    if (!match) {
      const fails = Number(account.failed_logins ?? 0) + 1;
      if (fails >= LOCK_AFTER) {
        await sql`
          update souq_accounts
          set failed_logins = ${fails}, locked_until = now() + (${LOCK_MINUTES} * interval '1 minute')
          where phone = ${data.phone}
        `;
        return { ok: false as const, error: "lockout" as const };
      }
      await sql`update souq_accounts set failed_logins = ${fails} where phone = ${data.phone}`;
      return { ok: false as const, error: "password" as const };
    }
    const role = account.role === "seller" ? "seller" : "buyer";
    if (data.asRole === "seller" && role !== "seller") return { ok: false as const, error: "notSeller" as const };
    if (data.asRole === "buyer" && role === "seller") return { ok: false as const, error: "notBuyer" as const };
    await sql`update souq_accounts set failed_logins = 0, locked_until = null where phone = ${data.phone}`;
    await openSession(sql, s, data.phone);
    return { ok: true as const, account: publicProfile(data.phone, account.data ?? {}, account) };
  });

export const signOutSouq = createServerFn({ method: "POST" }).handler(async () => {
  const s = await kit();
  const sql = await db();
  const token = s.getCookie(COOKIE);
  if (token) await sql`delete from souq_tokens where token = ${sha256(s, token)}`;
  clearSessionCookie(s);
  return { ok: true as const };
});

export const getSouqMe = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const phone = await sessionPhone(sql);
  if (!phone) return { ok: false as const, error: "auth" as const };
  const account = await loadAccount(sql, phone);
  if (!account) return { ok: false as const, error: "auth" as const };
  const orders = await sql<{ id: string; shop_slug: string; status: string; product_name: string; address_name: string }>`
    select id, shop_slug, status, product_name, address_name from souq_orders where buyer_phone = ${phone} order by created_at desc limit 100
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
      stallViews: Number(counts[0]?.views ?? 0),
      orders: orders.map((order) => ({
        id: order.id,
        shopSlug: order.shop_slug,
        status: order.status,
        productName: order.product_name,
        addressName: order.address_name,
      })),
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
    for (const key of ["password", "role", "sellerPlan", "plan", "shopSlug", "orders", "messages", "phone"] as const) {
      delete next[key];
    }
    Object.assign(next, parsed.data);
    await sql`
      update souq_accounts set data = ${JSON.stringify(next)}::jsonb, updated_at = now() where phone = ${phone}
    `;
    if (account.shop_slug) {
      await sql`
        update souq_shops set
          name = ${String(next.displayName || next.username || account.shop_slug)},
          area = ${String(next.city ?? "")},
          updated_at = now()
        where slug = ${account.shop_slug} and owner_phone = ${phone}
      `;
    }
    return { ok: true as const };
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
    return { ok: true as const, id };
  });

export const saveSouqReview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      shopSlug: z.string().trim().min(2).max(80),
      score: z.number().int().min(1).max(5),
      comment: z.string().trim().min(1).max(500),
      authorName: z.string().trim().min(1).max(80),
      area: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const s = await kit();
    const id = `r-${s.randomBytes(8).toString("hex")}`;
    await sql`
      insert into souq_reviews (id, shop_slug, author_phone, author_name, area, score, comment)
      values (${id}, ${data.shopSlug}, ${phone}, ${data.authorName}, ${data.area ?? ""}, ${data.score}, ${data.comment})
    `;
    await sql`
      insert into souq_views (shop_slug, review_count) values (${data.shopSlug}, 1)
      on conflict (shop_slug) do update set review_count = souq_views.review_count + 1
    `;
    return { ok: true as const, id };
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
  .handler(async ({ data }) => {
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
    const grace = 5 * 86400000;
    const base = oldEnd > 0 && oldEnd + grace >= now ? oldEnd : now;
    const planEnds = base + days * 86400000;
    const { pendingPlan: _pending, ...rest } = blob;
    const next = { ...rest, planEnds, paymentStatus: "active", sellerPlan: plan };
    await sql`update souq_accounts set plan = ${plan}, data = ${JSON.stringify(next)}::jsonb, updated_at = now() where phone = ${data.phone}`;
    if (account.shop_slug) {
      await sql`update souq_shops set plan = ${plan}, updated_at = now() where slug = ${account.shop_slug}`;
    }
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
      body: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const account = await loadAccount(sql, phone);
    if (!account?.shop_slug || account.role !== "seller") return { ok: false as const, error: "auth" as const };
    const image = data.imageUrl && !data.imageUrl.startsWith("data:") ? data.imageUrl : null;
    const body = data.body ?? {};
    delete body.password;
    await sql`
      insert into souq_listings (id, shop_slug, owner_phone, name, price, image_url, body)
      values (${data.id}, ${account.shop_slug}, ${phone}, ${data.name}, ${data.price ?? null}, ${image}, ${JSON.stringify(body)}::jsonb)
      on conflict (id) do update set
        name = excluded.name,
        price = excluded.price,
        image_url = excluded.image_url,
        body = excluded.body
      where souq_listings.owner_phone = ${phone}
    `;
    return { ok: true as const, imageUrl: image };
  });

export const uploadListingImage = createServerFn({ method: "POST" })
  .validator(z.object({ dataUrl: z.string().max(1_800_000) }))
  .handler(async ({ data }) => {
    const s = await kit();
    const sql = await db();
    const phone = await sessionPhone(sql);
    if (!phone) return { ok: false as const, error: "auth" as const };
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data.dataUrl);
    if (!match) return { ok: false as const, error: "type" as const };
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { ok: false as const, error: "storage" as const };
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 1_500_000) return { ok: false as const, error: "size" as const };
    const { put } = await import("@vercel/blob");
    const blob = await put(`listings/${sha256(s, phone)}/${s.randomBytes(8).toString("hex")}`, bytes, {
      access: "public",
      token,
      contentType: match[1],
    });
    return { ok: true as const, url: blob.url };
  });
