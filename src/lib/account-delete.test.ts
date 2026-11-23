import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { deleteConfirmedAccount, releaseOwnedMedia, usernamesMatch } from "./account-delete.ts";
import { copy } from "./i18n.ts";

const passwordMatches = async (password: string, hash: string) => password === hash;
const codeMatches = (code: string, salt: string, digest: string) => digest === `${salt}:${code}`;

test("delete account copy is the account-settings text, in both languages", () => {
  assert.equal(copy.en.deleteAccount, "Delete your account");
  assert.equal(copy.ar.deleteAccount, "احذف حسابك");
  assert.equal(
    copy.en.deleteAccountBody,
    "This permanently removes your account, your shop if you have one, your photos, reviews, saved places and Hello World posts. Orders already sent on WhatsApp cannot be unsent. Type your username to confirm.",
  );
  assert.equal(
    copy.ar.deleteAccountBody,
    "هذا يحذف حسابك نهائياً، ودكانك إن كان عندك، وصورك وتقييماتك وأماكنك المحفوظة ومنشورات هلا وورلد. الطلبات اللي انبعثت على واتساب ما بتنسحب. اكتب اسم المستخدم للتأكيد.",
  );
  assert.equal(copy.en.deleteAccountGo, "Delete my account · احذف حسابي");
  assert.equal(copy.ar.deleteAccountGo, "Delete my account · احذف حسابي");
  assert.equal(copy.en.accountDeleted, "Your account has been deleted.");
  assert.equal(copy.ar.accountDeleted, "تم حذف حسابك.");
  assert.equal(usernamesMatch("Lina Shop", "lina shop"), true);
  assert.equal(usernamesMatch("Lina", "other"), false);
  const account = readFileSync(new URL("../routes/account.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../routes/home.tsx", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../routes/admin.tsx", import.meta.url), "utf8");
  const privacy = readFileSync(new URL("../routes/privacy.tsx", import.meta.url), "utf8");
  assert.match(account, /t\.deleteAccount/);
  assert.match(account, /t\.deleteAccountBody/);
  assert.match(account, /t\.deleteAccountGo/);
  assert.match(account, /souq-account-deleted/);
  assert.match(account, /signOut\(\)/);
  assert.match(account, /<form onSubmit=\{onDelete\}>/);
  assert.equal(admin.includes("deleteSouqAccount"), false);
  assert.equal(privacy.includes("احذف حسابك"), false);
  assert.match(home, /t\.accountDeleted/);
  assert.match(home, /souq-account-deleted/);
});

test("deleteSouqAccount uses the session, not a phone typed in the request", () => {
  const source = readFileSync(new URL("./souq-sync.ts", import.meta.url), "utf8");
  const send = source.slice(source.indexOf("export const requestAccountDeleteCode"), source.indexOf("export const deleteSouqAccount"));
  const fn = source.slice(source.indexOf("export const deleteSouqAccount"));
  assert.match(send, /sessionPhone/);
  assert.equal(send.includes(".validator"), false);
  assert.match(send, /'delete'/);
  assert.match(fn, /sessionPhone\(sql\)/);
  assert.equal(fn.includes("data.phone"), false);
  assert.match(fn, /clearSessionCookie\(s\)/);
  assert.match(fn, /queueOwnedMedia/);
  assert.match(fn, /releaseOwnedMedia/);
  assert.match(fn, /deleteConfirmedAccount/);
  assert.match(source, /otp\.purpose === "reset" \|\| otp\.purpose === "delete"/);
  assert.equal(source.includes("allowTestOtp() {"), false);
});

async function openPg() {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((item) => item.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(dir, name), "utf8"));
  }
  return {
    pg,
    sql: {
      query: async <T>(text: string, params: unknown[] = []) => (await pg.query(text, params)).rows as T[],
    },
  };
}

async function account(
  sql: { query: (text: string, params?: unknown[]) => Promise<unknown[]> },
  phone: string,
  role: string,
  data: Record<string, unknown>,
  slug: string | null,
) {
  await sql.query(
    `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role, shop_slug, plan)
     values ($1, '', 'secret12', $2::jsonb, false, true, $3, $4, $5)`,
    [phone, JSON.stringify(data), role, slug, role === "seller" ? "basic" : null],
  );
}

test("a wrong password or code deletes nothing", async () => {
  const { sql } = await openPg();
  const seller = "+962791110001";
  const wa = "+962791110001";
  await account(sql, seller, "seller", { username: "Namo Shop", whatsappPhone: wa }, "namo-shop");
  await sql.query(
    `insert into souq_shops (slug, owner_phone, name, plan, hidden) values ('namo-shop', $1, 'Namo', 'basic', false)`,
    [seller],
  );
  await sql.query(
    `insert into souq_otp (phone, code_hash, salt, expires_at, attempts, purpose)
     values ($1, 'salt:654321', 'salt', now() + interval '5 minutes', 0, 'delete')`,
    [wa],
  );
  const wrongPass = await deleteConfirmedAccount(sql, {
    phone: seller,
    username: "Namo Shop",
    password: "nope1234",
    code: "654321",
    whatsapp: wa,
    passwordMatches,
    codeMatches,
  });
  assert.equal(wrongPass.ok, false);
  if (!wrongPass.ok) assert.equal(wrongPass.error, "password");
  const wrongName = await deleteConfirmedAccount(sql, {
    phone: seller,
    username: "someone else",
    password: "secret12",
    code: "000000",
    whatsapp: wa,
    passwordMatches,
    codeMatches,
  });
  assert.equal(wrongName.ok, false);
  if (!wrongName.ok) assert.equal(wrongName.error, "username");
  const wrongCode = await deleteConfirmedAccount(sql, {
    phone: seller,
    username: "namo shop",
    password: "secret12",
    code: "000000",
    whatsapp: wa,
    passwordMatches,
    codeMatches,
  });
  assert.equal(wrongCode.ok, false);
  if (!wrongCode.ok) assert.equal(wrongCode.error, "otp");
  const still = await sql.query<{ phone: string; hidden: boolean; attempts: number }>(
    `select a.phone, s.hidden, o.attempts
     from souq_accounts a
     join souq_shops s on s.owner_phone = a.phone
     join souq_otp o on o.phone = $1
     where a.phone = $1`,
    [seller],
  );
  assert.equal(still.length, 1);
  assert.equal(still[0]?.hidden, false);
  assert.equal(Number(still[0]?.attempts), 1);
});

test("a buyer can delete, a seller shop 404s, and the other account stays", async () => {
  const { sql } = await openPg();
  const buyer = "+962790000111";
  const seller = "+962791110002";
  const wa = "+962798880002";
  const photo = `acct-del-${Date.now()}.jpg`;
  const kept = `acct-keep-${Date.now()}.jpg`;
  const photoUrl = `/media/${photo}`;
  const keptUrl = `/media/${kept}`;
  mkdirSync("public/media", { recursive: true });
  writeFileSync(`public/media/${photo}`, "not-a-real-jpeg");
  writeFileSync(`public/media/${kept}`, "keep-me");
  try {
    await account(sql, buyer, "buyer", { username: "lina" }, null);
    await account(sql, seller, "seller", { username: "Namo Shop", whatsappPhone: wa, stallAvatar: "/brand/avatars/buyer-duck.jpg?v=7", stallCover: photoUrl }, "namo-shop");
    await sql.query(
      `insert into souq_shops (slug, owner_phone, name, plan, avatar_url, cover_url, thumb_url, publishable)
       values ('namo-shop', $1, 'Namo', 'basic', $2, $2, $2, true)`,
      [seller, photoUrl],
    );
    await sql.query(
      `insert into souq_shops (slug, owner_phone, name, plan) values ('other-shop', $1, 'Other', 'basic')`,
      [buyer],
    );
    await sql.query(`update souq_accounts set shop_slug = null where phone = $1`, [buyer]);
    await sql.query(`delete from souq_shops where slug = 'other-shop'`);
    await account(sql, "+962790000222", "seller", { username: "Other Shop" }, "other-shop");
    await sql.query(
      `insert into souq_shops (slug, owner_phone, name, plan, avatar_url) values ('other-shop', '+962790000222', 'Other', 'basic', $1)`,
      [keptUrl],
    );
    await sql.query(
      `insert into souq_listings (id, shop_slug, owner_phone, name, image_url, thumb_url, images)
       values ('sell-item', 'namo-shop', $1, 'Bread', $2, $2, $3::jsonb)`,
      [seller, photoUrl, JSON.stringify([photoUrl])],
    );
    await sql.query(
      `insert into souq_listings (id, shop_slug, owner_phone, name, image_url) values ('keep-item', 'other-shop', '+962790000222', 'Cake', $1)`,
      [keptUrl],
    );
    await sql.query(
      `insert into souq_hello_posts (id, shop_slug, owner_phone, text, image_url, thumb_url, expires_at, edit_until)
       values ('hello-seller', 'namo-shop', $1, 'hello', $2, $2, now() + interval '1 day', now() + interval '1 hour')`,
      [seller, photoUrl],
    );
    await sql.query(
      `insert into souq_hello_posts (id, shop_slug, owner_phone, text, image_url, expires_at, edit_until)
       values ('hello-other', 'other-shop', '+962790000222', 'stay', $1, now() + interval '1 day', now() + interval '1 hour')`,
      [keptUrl],
    );
    await sql.query(
      `insert into souq_orders (id, shop_slug, buyer_phone, status, product_name, address_name)
       values ('ord-buyer', 'other-shop', $1, 'done', 'Bread', 'Jabal Amman, building 4')`,
      [buyer],
    );
    await sql.query(
      `insert into souq_orders (id, shop_slug, buyer_phone, status, product_name, address_name)
       values ('ord-customer', 'namo-shop', '+962790000333', 'new', 'Bread', 'Sweifieh home')`,
    );
    await sql.query(
      `insert into souq_reviews (id, shop_slug, author_phone, author_name, score, comment)
       values ('rev-buyer', 'other-shop', $1, 'Lina', 5, 'Good')`,
      [buyer],
    );
    await sql.query(`insert into souq_views (shop_slug, review_count) values ('other-shop', 1)`);
    await sql.query(
      `insert into souq_buyer_places (id, owner_phone, name, lat, lng) values ('place-1', $1, 'Home', 31.95, 35.91)`,
      [buyer],
    );
    await sql.query(
      `insert into souq_buyer_places (id, owner_phone, name, lat, lng) values ('place-2', '+962790000222', 'Work', 31.9, 35.9)`,
    );
    await sql.query(
      `insert into souq_reports (id, target_type, target_id, reporter_phone, reason)
       values ('rep-buyer', 'shop', 'other-shop', $1, 'shop'), ('rep-other', 'shop', 'namo-shop', '+962790000222', 'shop')`,
      [buyer],
    );
    await sql.query(`insert into souq_tokens (token, phone) values ('tok-buyer', $1), ('tok-other', '+962790000222')`, [buyer]);
    await sql.query(
      `insert into souq_promo_uses (code, phone, plan, months) values ('FRIEND', $1, 'pro', 1), ('FRIEND', '+962790000222', 'pro', 1)`,
      [buyer],
    );
    await sql.query(
      `insert into souq_pending (phone, password_hash, profile, expires_at) values ($1, 'x', '{}'::jsonb, now() + interval '1 hour')`,
      [buyer],
    );
    await sql.query(
      `insert into souq_trial_phones (phone, trial_start, trial_end) values ($1, now(), now() + interval '30 days')`,
      [seller],
    );
    await sql.query(
      `insert into souq_slug_redirects (old_slug, slug) values ('stall-111111111', 'namo-shop')`,
    );
    await sql.query(
      `insert into souq_otp (phone, code_hash, salt, expires_at, attempts, purpose)
       values ($1, 'salt:654321', 'salt', now() + interval '5 minutes', 0, 'delete')`,
      [wa],
    );

    const buyerGone = await deleteConfirmedAccount(sql, {
      phone: buyer,
      username: "lina",
      password: "secret12",
      passwordMatches,
      codeMatches,
    });
    assert.equal(buyerGone.ok, true);
    assert.equal((await sql.query(`select phone from souq_accounts where phone = $1`, [buyer])).length, 0);
    assert.equal((await sql.query(`select id from souq_reviews where author_phone = $1`, [buyer])).length, 0);
    assert.equal((await sql.query(`select id from souq_buyer_places where owner_phone = $1`, [buyer])).length, 0);
    assert.equal((await sql.query(`select token from souq_tokens where phone = $1`, [buyer])).length, 0);
    const cleared = await sql.query<{ buyer_phone: string; address_name: string }>(
      `select buyer_phone, address_name from souq_orders where id = 'ord-buyer'`,
    );
    assert.equal(cleared[0]?.buyer_phone, "");
    assert.equal(cleared[0]?.address_name, "");
    assert.equal(cleared[0]?.buyer_phone.includes("962"), false);
    const again = await sql.query(
      `insert into souq_accounts (phone, secret, password_hash, data, must_reset, phone_verified, role)
       values ($1, '', 'new-secret', '{"username":"lina2"}'::jsonb, false, true, 'buyer') returning phone`,
      [buyer],
    );
    assert.equal(again.length, 1);

    const sellerGone = await deleteConfirmedAccount(sql, {
      phone: seller,
      username: "Namo Shop",
      password: "secret12",
      code: "654321",
      whatsapp: wa,
      passwordMatches,
      codeMatches,
    });
    assert.equal(sellerGone.ok, true);
    if (sellerGone.ok) {
      assert.equal(sellerGone.urls.includes(photoUrl), true);
      assert.equal(sellerGone.urls.includes("/brand/avatars/buyer-duck.jpg?v=7"), false);
      await releaseOwnedMedia(sql, sellerGone.urls);
    }
    const shop = await sql.query(
      `select s.slug from souq_shops s join souq_accounts a on a.phone = s.owner_phone where s.slug = 'namo-shop'`,
    );
    assert.equal(shop.length, 0);
    assert.equal((await sql.query(`select slug from souq_slug_redirects where slug = 'namo-shop' or old_slug = 'namo-shop'`)).length, 0);
    assert.equal(existsSync(`public/media/${photo}`), false);
    assert.equal((await sql.query(`select id from souq_listings where image_url = $1 or thumb_url = $1`, [photoUrl])).length, 0);
    assert.equal((await sql.query(`select id from souq_hello_posts where image_url = $1`, [photoUrl])).length, 0);
    assert.equal((await sql.query(`select phone from souq_accounts where phone = $1`, [seller])).length, 0);
    assert.equal((await sql.query(`select phone from souq_trial_phones where phone = $1`, [seller])).length, 1);

    const otherShop = await sql.query<{ slug: string }>(
      `select s.slug from souq_shops s join souq_accounts a on a.phone = s.owner_phone where s.slug = 'other-shop'`,
    );
    assert.equal(otherShop.length, 1);
    assert.equal((await sql.query(`select id from souq_hello_posts where id = 'hello-other'`)).length, 1);
    const customer = await sql.query<{ buyer_phone: string; address_name: string }>(
      `select buyer_phone, address_name from souq_orders where id = 'ord-customer'`,
    );
    assert.equal(customer[0]?.buyer_phone, "+962790000333");
    assert.equal(customer[0]?.address_name, "Sweifieh home");
    assert.equal((await sql.query(`select id from souq_buyer_places where id = 'place-2'`)).length, 1);
    assert.equal((await sql.query(`select code from souq_promo_uses where phone = '+962790000222'`)).length, 1);
    assert.equal((await sql.query(`select code from souq_promo_uses where phone = $1`, [buyer])).length, 0);
    assert.equal((await sql.query(`select id from souq_reports where id = 'rep-other'`)).length, 1);
    assert.equal((await sql.query(`select id from souq_reports where id = 'rep-buyer'`)).length, 0);
    assert.equal(existsSync(`public/media/${kept}`), true);
    const views = await sql.query<{ review_count: number }>(`select review_count from souq_views where shop_slug = 'other-shop'`);
    assert.equal(Number(views[0]?.review_count), 0);
  } finally {
    for (const name of [photo, kept]) {
      if (existsSync(`public/media/${name}`)) unlinkSync(`public/media/${name}`);
    }
  }
});

test("English and Arabic delete screens fit a 360 and 390 phone", async () => {
  const { chromium } = await import("playwright");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const extra = css.slice(css.indexOf(".account-delete{"));
  assert.ok(extra.startsWith(".account-delete{"));
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    for (const width of [360, 390]) {
      for (const lang of ["en", "ar"] as const) {
        const t = copy[lang];
        await page.setViewportSize({ width, height: 844 });
        await page.setContent(`<!doctype html>
          <html dir="${lang === "ar" ? "rtl" : "ltr"}" lang="${lang}">
          <head><style>
            html,body{margin:0;padding:0}
            .site-shell{max-width:1120px;margin:0 auto}
            .buyer-profile{padding:1.5rem 1.25rem 3rem}
            .home{padding:0}
            ${extra}
          </style></head>
          <body>
            <div class="site-shell">
              <main class="buyer-profile">
                <section class="account-delete">
                  <h2>${t.deleteAccount}</h2>
                  <p>${t.deleteAccountBody}</p>
                  <form>
                    <label><span>${t.username}</span><input value="namoshop"></label>
                    <label><span>${t.password}</span><input type="password" value="secret12"></label>
                    <label><span>${t.otpTitle}</span><input value="654321"></label>
                    <button type="button" class="account-delete-send">${t.otpResend}</button>
                    <button type="button" class="account-delete-go">${t.deleteAccountGo}</button>
                  </form>
                </section>
              </main>
              <p class="account-deleted-note">${t.accountDeleted}</p>
            </div>
          </body></html>`);
        const spill = await page.evaluate(() => {
          const root = document.documentElement;
          const section = document.querySelector(".account-delete");
          const kids = section ? [...section.querySelectorAll("*")] : [];
          const child = kids.reduce((max, el) => Math.max(max, el.scrollWidth - el.clientWidth), 0);
          return {
            page: root.scrollWidth - root.clientWidth,
            section: section ? section.scrollWidth - section.clientWidth : 999,
            child,
          };
        });
        assert.ok(spill.page <= 1, `${lang} ${width} page spill ${spill.page}`);
        assert.ok(spill.section <= 1, `${lang} ${width} section spill ${spill.section}`);
        assert.ok(spill.child <= 1, `${lang} ${width} child spill ${spill.child}`);
      }
    }
  } finally {
    await browser.close();
  }
});
