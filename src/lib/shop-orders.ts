/** Seller order list and the WhatsApp reply link. The list never includes a phone. */

export type ShopOrderStatus = "new" | "preparing" | "done" | "cancelled";

export type ShopOrder = {
  id: string;
  status: string;
  productName: string;
  addressName: string;
  createdAt: string;
  username: string;
};

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

const STATUSES = new Set<ShopOrderStatus>(["new", "preparing", "done", "cancelled"]);

export function sellerShopSlug(account: { role?: string | null; shop_slug?: string | null } | null | undefined) {
  if (!account || account.role !== "seller") return "";
  const slug = String(account.shop_slug ?? "").trim();
  return slug;
}

function stamp(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

/** Last 200 orders for this shop. Username only — never the buyer's phone. */
export async function readShopOrders(sql: Sql, shopSlug: string): Promise<ShopOrder[]> {
  const slug = shopSlug.trim();
  if (!slug) return [];
  const rows = await sql.query<{
    id: string;
    status: string;
    product_name: string;
    address_name: string | null;
    created_at: unknown;
    username: string | null;
  }>(
    `select o.id, o.status, o.product_name, o.address_name, o.created_at,
            coalesce(nullif(btrim(a.data->>'username'), ''), '') as username
     from souq_orders o
     left join souq_accounts a on a.phone = o.buyer_phone
     where o.shop_slug = $1
     order by o.created_at desc
     limit 200`,
    [slug],
  );
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    productName: row.product_name,
    addressName: row.address_name ?? "",
    createdAt: stamp(row.created_at),
    username: row.username ?? "",
  }));
}

export function isShopOrderStatus(value: string): value is ShopOrderStatus {
  return STATUSES.has(value as ShopOrderStatus);
}

/** Same shop check as patching an order. Does not change the status. */
export async function replyLinkForShop(sql: Sql, sellerSlug: string, orderId: string) {
  const slug = sellerSlug.trim();
  if (!slug) return { ok: false as const, error: "auth" as const };
  const rows = await sql.query<{ shop_slug: string; buyer_phone: string }>(
    `select shop_slug, buyer_phone from souq_orders where id = $1`,
    [orderId],
  );
  const order = rows[0];
  if (!order || order.shop_slug !== slug) return { ok: false as const, error: "auth" as const };
  const href = buyerReplyHref(order.buyer_phone);
  if (!href) return { ok: false as const, error: "missing" as const };
  return { ok: true as const, href };
}

/** wa.me with no prefilled message. Sellers write their own reply. */
export function buyerReplyHref(phone: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!/^9627[789]\d{7}$/.test(digits)) return "";
  return `https://wa.me/${digits}`;
}
