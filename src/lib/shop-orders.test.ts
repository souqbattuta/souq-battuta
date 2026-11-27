import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { copy } from "./i18n.ts";
import { buyerReplyHref, readShopOrders, replyLinkForShop, sellerShopSlug } from "./shop-orders.ts";

test("the unrecorded-order line is the one on Confirm", () => {
  assert.equal(copy.en.orderUnrecorded, "Your order wasn't recorded, please try again.");
  assert.equal(copy.ar.orderUnrecorded, "ما انحفظ طلبك، حاول مرة ثانية.");
  const sheet = readFileSync(new URL("../components/wa-sheet.tsx", import.meta.url), "utf8");
  const send = sheet.slice(sheet.indexOf("async function sendBoth"), sheet.indexOf('if (step === "confirm")'));
  assert.match(send, /t\.orderUnrecorded/);
  assert.ok(send.indexOf("if (!res?.ok)") < send.indexOf("win.location.href"));
  assert.match(send, /win\?\.close\(\)/);
  const session = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
  const place = session.slice(session.indexOf("placeOrder:"), session.indexOf("voteReview:"));
  const waited = place.indexOf("await placeSouqOrder");
  const wrote = place.indexOf("orders:");
  assert.ok(waited >= 0 && wrote > waited);
  assert.match(place, /if \(!remote\.ok\) return remote/);
  assert.match(place, /id: remote\.id/);
  assert.equal(place.includes("o-${Date.now()}"), false);
  assert.equal(place.includes("buyerPhone:"), false);
});

test("seller order routes stay on the session and do not change order caps", () => {
  const source = readFileSync(new URL("./souq-sync.ts", import.meta.url), "utf8");
  const place = source.slice(source.indexOf("export const placeSouqOrder"), source.indexOf("export const listShopOrders"));
  assert.match(place, /`order:day:\$\{phone\}`, 20, 86400/);
  assert.match(place, /`order:hour:\$\{phone\}:\$\{data\.shopSlug\}`, 5, 3600/);
  const list = source.slice(source.indexOf("export const listShopOrders"), source.indexOf("export const orderReplyLink"));
  assert.match(list, /sessionPhone/);
  assert.match(list, /sellerShopSlug/);
  assert.match(list, /readShopOrders/);
  assert.equal(list.includes("buyer_phone"), false);
  assert.equal(list.includes("buyerPhone"), false);
  const reply = source.slice(source.indexOf("export const orderReplyLink"), source.indexOf("const JORDAN"));
  assert.match(reply, /sessionPhone/);
  assert.match(reply, /sellerShopSlug/);
  assert.match(reply, /replyLinkForShop/);
  assert.match(reply, /hitRate\(sql, `order-reply:\$\{phone\}`, 60, 3600\)/);
  assert.equal(reply.includes("update souq_orders"), false);
  assert.equal(reply.includes("console."), false);
  const patch = source.slice(source.indexOf("export const patchSouqOrder"), source.indexOf("export const placeSouqOrder"));
  assert.match(patch, /order\.shop_slug !== account\.shop_slug/);
  assert.match(patch, /account\.role !== "seller"/);
  const board = readFileSync(new URL("../routes/seller.tsx", import.meta.url), "utf8");
  assert.match(board, /Reply on WhatsApp · رد على واتساب/);
  assert.match(board, /New · جديد/);
  assert.match(board, /Preparing · قيد التحضير/);
  assert.match(board, /Cancelled · ملغي/);
  assert.match(board, /listShopOrders/);
  assert.match(board, /patchSouqOrder/);
  assert.match(board, /onTouchEnd/);
  const replyFn = board.slice(board.indexOf("async function reply"), board.indexOf("return (", board.indexOf("async function reply")));
  assert.equal(replyFn.includes("localStorage"), false);
  assert.equal(replyFn.includes("setReplyNote(href"), false);
});

test("a buyer or another seller cannot see the phone, and a refresh shows the new status", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((item) => item.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(dir, name), "utf8"));
  }
  const sql = {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query(text, params)).rows as T[],
  };
  const buyer = "+962791112233";
  const seller = "+962790000111";
  const other = "+962790000222";
  await sql.query(
    `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan)
     values ($1, '', 'x', $2::jsonb, false, true, 'buyer', null, null)`,
    [buyer, JSON.stringify({ username: "lina" })],
  );
  await sql.query(
    `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan)
     values ($1, '', 'x', $2::jsonb, false, true, 'seller', 'namo-shop', 'basic')`,
    [seller, JSON.stringify({ username: "Namo Shop", whatsappPhone: "+962798880001" })],
  );
  await sql.query(
    `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan)
     values ($1, '', 'x', $2::jsonb, false, true, 'seller', 'other-shop', 'basic')`,
    [other, JSON.stringify({ username: "Other Shop" })],
  );
  await sql.query(`insert into souq_shops (slug, owner_phone, name, plan) values ('namo-shop', $1, 'Namo', 'basic')`, [seller]);
  await sql.query(`insert into souq_shops (slug, owner_phone, name, plan) values ('other-shop', $1, 'Other', 'basic')`, [other]);
  await sql.query(
    `insert into souq_orders (id, shop_slug, buyer_phone, status, product_name, address_name)
     values ('o-bread', 'namo-shop', $1, 'new', 'Bread', 'Jabal Amman')`,
    [buyer],
  );
  assert.equal(sellerShopSlug({ role: "buyer", shop_slug: "namo-shop" }), "");
  assert.equal(sellerShopSlug({ role: "seller", shop_slug: "other-shop" }), "other-shop");
  assert.equal(sellerShopSlug(null), "");
  const seen = await readShopOrders(sql, "namo-shop");
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.productName, "Bread");
  assert.equal(seen[0]?.addressName, "Jabal Amman");
  assert.equal(seen[0]?.username, "lina");
  assert.equal(seen[0]?.status, "new");
  assert.deepEqual(Object.keys(seen[0] ?? {}).sort(), ["addressName", "createdAt", "id", "productName", "status", "username"]);
  const packed = JSON.stringify(seen);
  assert.equal(packed.includes(buyer), false);
  assert.equal(packed.includes("791112233"), false);
  assert.equal(packed.includes("whatsapp"), false);
  assert.equal((await readShopOrders(sql, "other-shop")).length, 0);
  const stranger = await replyLinkForShop(sql, "other-shop", "o-bread");
  assert.equal(stranger.ok, false);
  if (!stranger.ok) assert.equal(stranger.error, "auth");
  const buyerGate = await replyLinkForShop(sql, "", "o-bread");
  assert.equal(buyerGate.ok, false);
  const link = await replyLinkForShop(sql, "namo-shop", "o-bread");
  assert.equal(link.ok, true);
  if (link.ok) {
    assert.equal(link.href, buyerReplyHref(buyer));
    assert.equal(link.href, "https://wa.me/962791112233");
    assert.equal(link.href.includes("?"), false);
    assert.equal(link.href.includes("text="), false);
  }
  const before = await sql.query<{ status: string }>(`select status from souq_orders where id = 'o-bread'`);
  assert.equal(before[0]?.status, "new");
  await sql.query(`update souq_orders set status = 'preparing' where id = 'o-bread' and shop_slug = 'namo-shop'`);
  const again = await readShopOrders(sql, "namo-shop");
  assert.equal(again[0]?.status, "preparing");
  assert.equal(again[0]?.username, "lina");
  const still = JSON.stringify(again);
  assert.equal(still.includes("791112233"), false);
  const untouched = await sql.query<{ status: string }>(`select status from souq_orders where id = 'o-bread'`);
  assert.equal(untouched[0]?.status, "preparing");
});

test("seller order rows fit a 360 and 390 phone", async () => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const rules = css.slice(css.indexOf(".desk-orders"));
    for (const width of [360, 390]) {
      for (const dir of ["ltr", "rtl"] as const) {
        await page.setViewportSize({ width, height: 800 });
        await page.setContent(`<!doctype html><html dir="${dir}"><head><style>
          html,body{margin:0}
          .site-shell{max-width:1120px;margin:0 auto}
          .seller-desk{padding:1.5rem 1rem}
          .bg-ink{background:#1c305c;color:#f6f1e7}
          .text-cream{color:#f6f1e7}
          .bg-wa{background:#25d366;color:#fff}
          .border{border:1px solid #d9cdb8}
          button{font:inherit}
          ${rules}
        </style></head><body><div class="site-shell"><main class="seller-desk"><section class="desk-orders"><ul>
          <li class="desk-order grid">
            <p class="font-semibold">Manakish with zaatar and a long name</p>
            <p>Jabal Al Weibdeh, building four</p>
            <p>lina</p>
            <div style="display:flex;flex-wrap:wrap;gap:.4rem">
              <button style="min-height:44px">New · جديد</button>
              <button style="min-height:44px">Preparing · قيد التحضير</button>
              <button style="min-height:44px">Done · تم</button>
              <button style="min-height:44px">Cancelled · ملغي</button>
            </div>
            <button class="bg-wa" style="min-height:44px;width:100%">Reply on WhatsApp · رد على واتساب</button>
          </li>
        </ul></section></main></div></body></html>`);
        const spill = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          row: (document.querySelector(".desk-order")?.scrollWidth ?? 0) - (document.querySelector(".desk-order")?.clientWidth ?? 0),
        }));
        assert.ok(spill.page <= 1, `${dir} ${width} page ${spill.page}`);
        assert.ok(spill.row <= 1, `${dir} ${width} row ${spill.row}`);
      }
    }
  } finally {
    await browser.close();
  }
});
