import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PRIVATE = [
  "password",
  "addresses",
  "interestWords",
  "alertWords",
  "mutedWords",
  "notes",
  "bookmarks",
  "bookmarkLists",
  "followedLists",
  "algoOrder",
  "reviewVotes",
];

function stripImages(value: unknown): unknown {
  if (typeof value === "string") return value.startsWith("data:") && value.length > 40000 ? "" : value;
  if (Array.isArray(value)) return value.map(stripImages);
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) next[key] = stripImages(item);
    return next;
  }
  return value;
}

function publicAccount(phone: string, data: Record<string, unknown>, updatedAt: string) {
  const next: Record<string, unknown> = { ...data, phone, updatedAt };
  for (const key of PRIVATE) delete next[key];
  return next;
}

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

export const listSouqAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql<{ phone: string; data: Record<string, unknown>; updated_at: string }>`
    select phone, data, updated_at from souq_accounts order by updated_at desc
  `;
  return rows.map((row) => publicAccount(row.phone, row.data ?? {}, String(row.updated_at))) as Array<{
    phone: string;
    updatedAt: string;
  }>;
});

export const claimSouq = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().min(8).max(20),
      password: z.string().min(1).max(80),
      account: z.record(z.string(), z.unknown()).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const phone = data.phone;
    const existing = await sql<{ secret: string }>`select secret from souq_accounts where phone = ${phone}`;
    const clean = data.account ? (stripImages({ ...data.account, phone }) as Record<string, unknown>) : null;
    if (clean) delete clean.password;
    if (!existing[0]) {
      if (!clean) return { ok: false as const, error: "missing" as const };
      await sql`insert into souq_accounts (phone, secret, data) values (${phone}, ${data.password}, ${JSON.stringify(clean)}::jsonb)`;
    } else if (existing[0].secret !== data.password) {
      return { ok: false as const, error: "password" as const };
    } else if (clean) {
      await sql`update souq_accounts set data = ${JSON.stringify(clean)}::jsonb, updated_at = now() where phone = ${phone}`;
    }
    const token = crypto.randomUUID();
    await sql`insert into souq_tokens (token, phone) values (${token}, ${phone})`;
    const full = await sql<{ data: Record<string, unknown> }>`select data from souq_accounts where phone = ${phone}`;
    return { ok: true as const, token, account: { ...(full[0]?.data ?? {}), phone } };
  });

export const pushSouq = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(10),
      account: z.record(z.string(), z.unknown()),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const session = await sql<{ phone: string }>`select phone from souq_tokens where token = ${data.token}`;
    const phone = session[0]?.phone;
    if (!phone) return { ok: false as const };
    const clean = stripImages({ ...data.account, phone }) as Record<string, unknown>;
    delete clean.password;
    delete clean.updatedAt;
    await sql`update souq_accounts set data = ${JSON.stringify(clean)}::jsonb, updated_at = now() where phone = ${phone}`;
    return { ok: true as const };
  });

export const patchSouqOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(10),
      orderId: z.string().min(2),
      status: z.string().min(2).max(20),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const session = await sql<{ phone: string }>`select phone from souq_tokens where token = ${data.token}`;
    const sellerPhone = session[0]?.phone;
    if (!sellerPhone) return { ok: false as const };
    const seller = await sql<{ data: { shopSlug?: string } }>`select data from souq_accounts where phone = ${sellerPhone}`;
    const shopSlug = seller[0]?.data?.shopSlug;
    if (!shopSlug) return { ok: false as const };
    const rows = await sql<{ phone: string; data: Record<string, unknown> }>`select phone, data from souq_accounts`;
    for (const row of rows) {
      const orders = Array.isArray(row.data?.orders) ? (row.data.orders as { id?: string; shopSlug?: string }[]) : [];
      const hit = orders.find((order) => order.id === data.orderId);
      if (!hit) continue;
      if (hit.shopSlug !== shopSlug) return { ok: false as const };
      const nextOrders = orders.map((order) => (order.id === data.orderId ? { ...order, status: data.status } : order));
      const notes = Array.isArray(row.data.notes) ? (row.data.notes as { id?: string }[]) : [];
      const note = {
        id: `review-${data.orderId}`,
        title: "Review your order",
        body: "Your order is complete. You can leave a review.",
        href: "/inbox",
        at: Date.now(),
      };
      const next = { ...row.data, orders: nextOrders, notes: [note, ...notes.filter((item) => item.id !== note.id)] };
      await sql`update souq_accounts set data = ${JSON.stringify(next)}::jsonb, updated_at = now() where phone = ${row.phone}`;
      return { ok: true as const };
    }
    return { ok: false as const };
  });
