import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DUMMY_PASSWORD_HASH, decideLogin } from "./login-guard.ts";
import { LEGACY_HOST, souqWriteAllowed } from "./site.ts";

const HASH = "$2b$12$realhashrealhashrealhashrealh";

function account(patch: Partial<{
  phone_verified: boolean;
  must_reset: boolean;
  password_hash: string | null;
  failed_logins: number;
  locked_until: string | null;
  role: string;
}> = {}) {
  return {
    phone_verified: true,
    must_reset: false,
    password_hash: HASH,
    failed_logins: 0,
    locked_until: null,
    role: "buyer",
    ...patch,
  };
}

test("an unknown number and a wrong password are the same credentials error", async () => {
  const seen: string[] = [];
  const compare = async (_password: string, hash: string) => {
    seen.push(hash);
    return false;
  };
  const missing = await decideLogin({ account: null, password: "Secret12", compare });
  const wrong = await decideLogin({ account: account(), password: "Secret12", compare });
  assert.equal(missing.ok, false);
  assert.equal(wrong.ok, false);
  if (!missing.ok && !wrong.ok) {
    assert.equal(missing.error, "credentials");
    assert.equal(wrong.error, "credentials");
  }
  const wrongDoor = await decideLogin({
    account: account({ role: "buyer" }),
    password: "Secret12",
    asRole: "seller",
    compare: async () => false,
  });
  assert.equal(wrongDoor.ok, false);
  if (!wrongDoor.ok) assert.equal(wrongDoor.error, "credentials");
  assert.equal(seen[0], DUMMY_PASSWORD_HASH);
  assert.equal(seen[1], HASH);
  assert.equal("fails" in missing, false);
  if (!wrong.ok && wrong.error === "credentials") assert.equal(wrong.fails, 1);
});

test("unverified and must-reset stay credentials even when the password matches", async () => {
  const compare = async () => true;
  const unverified = await decideLogin({
    account: account({ phone_verified: false }),
    password: "Secret12",
    compare,
  });
  const reset = await decideLogin({
    account: account({ must_reset: true }),
    password: "Secret12",
    compare,
  });
  const noHash = await decideLogin({
    account: account({ password_hash: null }),
    password: "Secret12",
    compare,
  });
  for (const result of [unverified, reset, noHash]) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "credentials");
  }
});

test("the right password signs in, the wrong door is told only after that, and lockout stays distinct", async () => {
  const ok = await decideLogin({
    account: account(),
    password: "Secret12",
    asRole: "buyer",
    compare: async () => true,
  });
  assert.equal(ok.ok, true);
  const sellerDoor = await decideLogin({
    account: account({ role: "buyer" }),
    password: "Secret12",
    asRole: "seller",
    compare: async () => true,
  });
  assert.deepEqual(sellerDoor, { ok: false, error: "notSeller" });
  const buyerDoor = await decideLogin({
    account: account({ role: "seller" }),
    password: "Secret12",
    asRole: "buyer",
    compare: async () => true,
  });
  assert.deepEqual(buyerDoor, { ok: false, error: "notBuyer" });
  let compared = false;
  const locked = await decideLogin({
    account: account({ locked_until: new Date(Date.now() + 60_000).toISOString() }),
    password: "Secret12",
    compare: async () => {
      compared = true;
      return false;
    },
  });
  assert.deepEqual(locked, { ok: false, error: "lockout" });
  assert.equal(compared, false);
  const fifth = await decideLogin({
    account: account({ failed_logins: 4 }),
    password: "Secret12",
    compare: async () => false,
  });
  assert.deepEqual(fifth, { ok: false, error: "lockout", lock: true, fails: 5 });
});

test("sign-in copy is one line in both languages and reset still hides a missing number", () => {
  const i18n = readFileSync(new URL("./i18n.ts", import.meta.url), "utf8");
  assert.match(i18n, /badSignIn: "That number or password is not right\."/);
  assert.match(i18n, /badSignIn: "الرقم أو كلمة السر غير صحيحة\."/);
  const page = readFileSync(new URL("../routes/sign-in.tsx", import.meta.url), "utf8");
  assert.match(page, /t\.badSignIn/);
  assert.match(page, /result\.error === "lockout"/);
  assert.match(page, /to="\/forgot"/);
  assert.equal(page.includes("t.needVerify"), false);
  assert.equal(page.includes("t.mustReset"), false);
  assert.equal(page.includes("t.wrongPass"), false);
  const sync = readFileSync(new URL("./souq-sync.ts", import.meta.url), "utf8");
  const claim = sync.slice(sync.indexOf("export const claimSouq"), sync.indexOf("export const signOutSouq"));
  assert.match(claim, /decideLogin/);
  assert.equal(claim.includes('error: "verify"'), false);
  assert.equal(claim.includes('error: "password"'), false);
  assert.equal(claim.includes('error: "reset"'), false);
  assert.match(sync, /if \(!account\?\.phone_verified\) return \{ ok: true as const, retryAfter: 60 \}/);
  assert.match(sync, /souqWriteAllowed/);
  assert.match(sync, /if \(crossSiteWrite\(s\)\) return null/);
  assert.match(sync, /searchLiveShops/);
});

function req(origin: string, host = LEGACY_HOST, referer = "") {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  if (referer) headers.set("referer", referer);
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", "https");
  return { url: `https://${host}/_server`, headers };
}

test("a session write allows this site and the preview, and rejects a sibling", () => {
  assert.equal(souqWriteAllowed(req("")), true);
  assert.equal(souqWriteAllowed(req(`https://${LEGACY_HOST}`)), true);
  assert.equal(souqWriteAllowed(req("", "souqbattuta.com", `https://${LEGACY_HOST}/seller`)), true);
  const prev = process.env.SITE_URL;
  process.env.SITE_URL = "https://souqbattuta.com";
  try {
    assert.equal(souqWriteAllowed(req("https://souqbattuta.com", "souqbattuta.com")), true);
    assert.equal(souqWriteAllowed(req(`https://${LEGACY_HOST}`, "souqbattuta.com")), true);
  } finally {
    if (prev === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prev;
  }
  assert.equal(souqWriteAllowed(req("https://evil.example")), false);
  assert.equal(souqWriteAllowed(req("https://other.grok.me")), false);
  assert.equal(souqWriteAllowed(req("null")), false);
});
