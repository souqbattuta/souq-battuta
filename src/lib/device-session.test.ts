import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deviceMarkKey, mergeDeviceSession, persistedSession, scrubStoredSession } from "./device-session.ts";

const phoneA = "+962795636663";
const phoneB = "+962790000002";

function fresh() {
  return {
    lang: "en",
    user: null as any,
    signedIn: false,
    accounts: {} as Record<string, unknown>,
    follows: [] as string[],
    pageLikes: [] as string[],
    interestWords: [] as string[],
    mutedWords: [] as string[],
    recentSlugs: [] as string[],
    orders: [] as unknown[],
    addresses: [] as unknown[],
    mail: [] as unknown[],
    listings: [] as unknown[],
    notes: [] as unknown[],
    staff: false,
  };
}

test("a signed-in phone keeps language and preferences, not numbers, places, or orders", () => {
  const saved = persistedSession({
    lang: "ar",
    signedIn: true,
    follows: ["hala-kitchen"],
    pageLikes: ["hala-kitchen"],
    interestWords: ["bread"],
    mutedWords: ["spam"],
    recentSlugs: ["hala-kitchen"],
  });
  const raw = JSON.stringify(saved);
  assert.equal(saved.lang, "ar");
  assert.equal(saved.signedIn, true);
  assert.deepEqual(saved.follows, ["hala-kitchen"]);
  assert.equal(raw.includes(phoneA), false);
  assert.equal(raw.includes("password"), false);
  assert.equal(raw.includes("accounts"), false);
  assert.equal(raw.includes("orders"), false);
  assert.equal(raw.includes("addresses"), false);
});

test("sign-out storage has no previous account, and language stays", () => {
  const signedOut = persistedSession({
    lang: "ar",
    signedIn: false,
    follows: ["hala-kitchen"],
    pageLikes: ["hala-kitchen"],
    interestWords: ["bread"],
    mutedWords: ["spam"],
    recentSlugs: ["hala-kitchen"],
  });
  assert.equal(signedOut.lang, "ar");
  assert.equal(signedOut.signedIn, false);
  assert.deepEqual(signedOut.follows, []);
  assert.deepEqual(signedOut.pageLikes, []);
  const reloaded = mergeDeviceSession(signedOut, fresh(), { liveUser: false, livePending: false, joinPending: null });
  assert.equal(reloaded.lang, "ar");
  assert.equal(reloaded.user, null);
  assert.deepEqual(reloaded.follows, []);
  assert.deepEqual(reloaded.addresses, []);
  assert.deepEqual(reloaded.orders, []);
  assert.equal(JSON.stringify(reloaded).includes(phoneA), false);
});

test("an old accounts map is dropped, and a signed-out blob loses orders and places", () => {
  const old = {
    lang: "en",
    user: null,
    accounts: {
      [phoneA]: {
        phone: phoneA,
        whatsappPhone: phoneA,
        displayName: "Auntie",
        password: "SecretPass1",
        orders: [{ id: "o-a", buyerPhone: phoneA }],
        addresses: [{ name: "Auntie pin", lat: 31.95 }],
      },
    },
    orders: [{ id: "o-a", buyerPhone: phoneA, productName: "Bread" }],
    addresses: [{ name: "Auntie pin", lat: 31.95, lng: 35.91 }],
    mail: [{ id: "m-a", fromPhone: phoneA }],
    staff: true,
    promoRedemptions: [{ code: "KEEP", phone: phoneA }],
  };
  scrubStoredSession(old);
  assert.equal(old.accounts, undefined);
  assert.equal(old.orders, undefined);
  assert.equal(old.addresses, undefined);
  assert.equal(old.mail, undefined);
  assert.equal(old.staff, undefined);
  assert.equal(JSON.stringify(old).includes(phoneA), false);
  assert.equal(JSON.stringify(old).includes("Auntie pin"), false);
  const merged = mergeDeviceSession(
    {
      lang: "ar",
      user: null,
      accounts: { [phoneA]: { phone: phoneA, displayName: "Auntie" } },
      orders: [{ buyerPhone: phoneA }],
      addresses: [{ name: "Auntie pin" }],
      follows: ["hala-kitchen"],
      staff: true,
    },
    fresh(),
    { liveUser: false, livePending: false, joinPending: null },
  );
  assert.equal(merged.lang, "ar");
  assert.deepEqual(merged.accounts, {});
  assert.deepEqual(merged.orders, []);
  assert.deepEqual(merged.addresses, []);
  assert.deepEqual(merged.follows, []);
  assert.equal(merged.staff, false);
  assert.equal(JSON.stringify(merged).includes(phoneA), false);
  assert.equal(JSON.stringify(merged).includes("Auntie"), false);
});

test("user B does not inherit A's follows, places, or orders", () => {
  const afterA = persistedSession({
    lang: "ar",
    signedIn: false,
    follows: ["a-private-stall"],
    pageLikes: ["a-private-stall"],
    interestWords: ["knafeh"],
    mutedWords: [],
    recentSlugs: ["a-private-stall"],
  });
  const device = mergeDeviceSession(afterA, fresh(), { liveUser: false, livePending: false, joinPending: null });
  const asB = {
    ...device,
    user: { phone: phoneB, displayName: "B" },
    signedIn: true,
    accounts: { [phoneB]: { phone: phoneB } },
    addresses: [] as { name: string }[],
    orders: [] as { id: string }[],
    follows: [] as string[],
  };
  assert.equal(asB.follows.includes("a-private-stall"), false);
  assert.equal(asB.addresses.length, 0);
  assert.equal(asB.orders.length, 0);
  assert.equal(JSON.stringify(asB.accounts).includes(phoneA), false);
  assert.equal(asB.lang, "ar");
});

test("a reload while signed in keeps language and follows, not the accounts map", () => {
  const saved = persistedSession({
    lang: "ar",
    signedIn: true,
    follows: ["hala-kitchen"],
    pageLikes: ["hala-kitchen"],
    interestWords: ["bread"],
    mutedWords: ["spam"],
    recentSlugs: ["hala-kitchen"],
  });
  const leaked = {
    ...saved,
    user: { phone: phoneA, displayName: "Auntie", password: "SecretPass1" },
    accounts: { [phoneA]: { whatsappPhone: phoneA } },
    orders: [{ buyerPhone: phoneA }],
    addresses: [{ name: "Auntie pin" }],
    staff: true,
  };
  const reloaded = mergeDeviceSession(leaked, fresh(), { liveUser: false, livePending: false, joinPending: null });
  assert.equal(reloaded.lang, "ar");
  assert.equal(reloaded.signedIn, true);
  assert.deepEqual(reloaded.follows, ["hala-kitchen"]);
  assert.deepEqual(reloaded.interestWords, ["bread"]);
  assert.equal(reloaded.user, null);
  assert.deepEqual(reloaded.accounts, {});
  assert.deepEqual(reloaded.orders, []);
  assert.deepEqual(reloaded.addresses, []);
  assert.equal(reloaded.staff, false);
  assert.equal(JSON.stringify(reloaded).includes(phoneA), false);
  assert.equal(JSON.stringify(reloaded).includes("SecretPass1"), false);
});

test("sign-in does not merge leftover places, and sign-out does not pack accounts", () => {
  const source = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
  const signIn = source.slice(source.indexOf("signIn: async"), source.indexOf("signOut:"));
  assert.equal(signIn.includes("get().addresses"), false);
  assert.match(signIn, /addresses:\s*\[\]/);
  assert.equal(signIn.includes("...get().accounts"), false);
  const signOut = source.slice(source.indexOf("signOut:"), source.indexOf("updateProfile:"));
  assert.equal(signOut.includes("buyerPack"), false);
  assert.match(signOut, /dropSharedAccount/);
  assert.match(source, /listMyPlaces/);
  assert.equal(deviceMarkKey("souq-places-moved:+962795636663"), true);
  assert.equal(deviceMarkKey("souq-sync-token"), true);
  assert.equal(deviceMarkKey("souq-battuta-session"), false);
});
