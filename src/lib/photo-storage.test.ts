import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHOTO_DAY, PHOTO_HOUR } from "./abuse.ts";
import { helloFailCopy } from "./hello.ts";
import { copy } from "./i18n.ts";
import { deleteStoredObject, encodeShopPhoto, isOwnedMedia, r2Ready, saveShopPhoto } from "./object-store.ts";

const HASH = "a".repeat(64);
const ID = "b".repeat(16);
const BASE = "https://media.souqbattuta.com";
const TOKEN = "r2-token-not-for-logs";

const ENV_KEYS = ["NODE_ENV", "R2_ACCOUNT_ID", "R2_BUCKET", "R2_API_TOKEN", "R2_PUBLIC_BASE", "BLOB_READ_WRITE_TOKEN"] as const;

function restoreEnv(prev: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (prev[key] === undefined) delete process.env[key];
    else process.env[key] = prev[key];
  }
}

function rememberEnv() {
  const prev: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) prev[key] = process.env[key];
  return prev;
}

function clearStorageEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

test("the storage refusal is the bilingual line, and photo caps stay", () => {
  assert.equal(copy.en.photoStorage, "Photos cannot be saved right now. Try again later.");
  assert.equal(copy.ar.photoStorage, "تعذر حفظ الصور الآن. حاول لاحقاً.");
  assert.equal(helloFailCopy("storage", false), copy.en.photoStorage);
  assert.equal(helloFailCopy("storage", true), copy.ar.photoStorage);
  assert.equal(PHOTO_HOUR, 30);
  assert.equal(PHOTO_DAY, 80);
  const seller = readFileSync(new URL("../routes/seller.tsx", import.meta.url), "utf8");
  const listError = seller.slice(seller.indexOf("setListError("), seller.indexOf("setListError(\"\""));
  assert.ok(listError.indexOf('code === "storage"') < listError.indexOf("t.photoStorage"));
  assert.ok(listError.indexOf("t.photoStorage") < listError.indexOf('code === "type"'));
  const store = readFileSync(new URL("./souq-sync.ts", import.meta.url), "utf8");
  assert.match(store, /searchLiveShops/);
  const fn = store.slice(store.indexOf("async function storeImage"), store.indexOf("export const publishHello"));
  assert.match(fn, /encodeShopPhoto/);
  assert.match(fn, /saveShopPhoto/);
  assert.match(fn, /allowPhotoUpload/);
  assert.match(fn, /5_000_000/);
  assert.match(fn, /phoneHash: sha256\(s, phone\)/);
  assert.equal(fn.includes("public/media"), false);
  assert.equal(fn.includes("console."), false);
  assert.equal(fn.includes(TOKEN), false);
  const saved = readFileSync(new URL("./object-store.ts", import.meta.url), "utf8");
  const place = saved.slice(saved.indexOf("export async function saveShopPhoto"), saved.length);
  assert.ok(place.indexOf("r2Ready()") < place.indexOf("BLOB_READ_WRITE_TOKEN"));
  assert.ok(place.indexOf("BLOB_READ_WRITE_TOKEN") < place.indexOf('NODE_ENV === "production"'));
  assert.ok(place.indexOf('NODE_ENV === "production"') < place.indexOf("writeFile"));
  assert.equal(saved.includes("console.log"), false);
  assert.equal(saved.includes("console.error(`[") , false);
  assert.match(saved, /console\.error\("\[souq\] photo storage is not configured"\)/);
});

test("a JPEG that contains GPS is stored as a WebP without that GPS", async () => {
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp({
    create: { width: 48, height: 32, channels: 3, background: { r: 180, g: 40, b: 30 } },
  }).jpeg().toBuffer();
  const plain = await sharp(jpeg).withMetadata({
    exif: { IFD0: { ImageDescription: "GPSMARK-31.9539-35.9106" } },
  }).jpeg().toBuffer();
  const withGps = await sharp(jpeg).withMetadata({
    exif: {
      IFD0: { ImageDescription: "GPSMARK-31.9539-35.9106" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "31/1,57/1,1404/100",
        GPSLongitudeRef: "E",
        GPSLongitude: "35/1,54/1,3816/100",
      },
    },
  }).jpeg().toBuffer();
  const plainExif = (await sharp(plain).metadata()).exif;
  const gpsExif = (await sharp(withGps).metadata()).exif;
  assert.ok(plainExif && gpsExif && gpsExif.length > plainExif.length);
  assert.ok(withGps.includes(Buffer.from("GPSMARK-31.9539-35.9106")));
  for (const kind of ["listing", "hello"] as const) {
    const encoded = await encodeShopPhoto(withGps, kind);
    assert.equal(encoded.ok, true);
    if (!encoded.ok) return;
    const meta = await sharp(encoded.main).metadata();
    const thumb = await sharp(encoded.thumb).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(thumb.format, "webp");
    assert.equal(meta.exif, undefined);
    assert.equal(thumb.exif, undefined);
    assert.equal(encoded.main.includes(Buffer.from("GPSMARK-31.9539-35.9106")), false);
    assert.equal(encoded.thumb.includes(Buffer.from("GPSMARK-31.9539-35.9106")), false);
    assert.equal(encoded.main.includes(Buffer.from("31.9539")), false);
  }
});

test("R2 upload returns a public https URL and a second read uses that same object", async () => {
  const prev = rememberEnv();
  const dir = await mkdtemp(join(tmpdir(), "souq-photo-"));
  const calls: { url: string; method: string; body: Buffer | null; auth: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const raw = init?.body;
    const body = raw instanceof Uint8Array ? Buffer.from(raw) : null;
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    calls.push({ url, method: init?.method ?? "GET", body, auth });
    assert.equal(url.includes(TOKEN), false);
    assert.equal(auth.includes(TOKEN), true);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }) as typeof fetch;
  try {
    clearStorageEnv();
    process.env.NODE_ENV = "production";
    process.env.R2_ACCOUNT_ID = "abc123";
    process.env.R2_BUCKET = "souq-media";
    process.env.R2_API_TOKEN = TOKEN;
    process.env.R2_PUBLIC_BASE = `${BASE}/`;
    process.env.BLOB_READ_WRITE_TOKEN = "blob-should-not-win";
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp({
      create: { width: 20, height: 16, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).jpeg().toBuffer();
    const listing = await encodeShopPhoto(jpeg, "listing");
    const hello = await encodeShopPhoto(jpeg, "hello");
    assert.equal(listing.ok && hello.ok, true);
    if (!listing.ok || !hello.ok) return;
    const listed = await saveShopPhoto({ kind: "listing", phoneHash: HASH, id: ID, main: listing.main, thumb: listing.thumb }, dir);
    const posted = await saveShopPhoto({ kind: "hello", phoneHash: HASH, id: ID, main: hello.main, thumb: hello.thumb }, dir);
    assert.equal(listed.ok, true);
    assert.equal(posted.ok, true);
    if (!listed.ok || !posted.ok) return;
    assert.equal(listed.url, `${BASE}/listing/${HASH}/${ID}.webp`);
    assert.equal(listed.thumbUrl, `${BASE}/listing/${HASH}/${ID}-thumb.webp`);
    assert.equal(posted.url, `${BASE}/hello/${HASH}/${ID}.webp`);
    assert.equal(listed.url.startsWith("https://"), true);
    assert.equal(listed.url.startsWith("data:"), false);
    assert.equal(listed.url.includes("/media/"), false);
    assert.equal(isOwnedMedia(listed.url), true);
    assert.equal(isOwnedMedia(posted.url), true);
    assert.equal(isOwnedMedia("data:image/webp;base64,aaaa"), false);
    assert.equal(isOwnedMedia("/brand/avatars/buyer-duck.jpg"), false);
    assert.equal(isOwnedMedia("https://example.com/listing/" + HASH + "/" + ID + ".webp"), false);
    const puts = calls.filter((call) => call.method === "PUT");
    assert.equal(puts.length, 4);
    assert.equal(puts[0]?.body?.equals(listing.main), true);
    assert.equal(puts[1]?.body?.equals(listing.thumb), true);
    assert.equal(puts[2]?.body?.equals(hello.main), true);
    assert.ok(puts[0]?.url.includes(`/listing/${HASH}/${ID}.webp`));
    assert.equal((await readdir(dir)).length, 0);
    calls.length = 0;
    assert.equal(await deleteStoredObject(listed.url), "deleted");
    assert.equal(calls[0]?.method, "DELETE");
    assert.ok(calls[0]?.url.endsWith(`/listing/${HASH}/${ID}.webp`));
    assert.equal(calls[0]?.url.includes(TOKEN), false);
  } finally {
    globalThis.fetch = original;
    restoreEnv(prev);
    await rm(dir, { recursive: true, force: true });
  }
});

test("production with no storage tokens refuses the upload and writes no file", async () => {
  const prev = rememberEnv();
  const dir = await mkdtemp(join(tmpdir(), "souq-photo-closed-"));
  const errors: unknown[][] = [];
  const originalError = console.error;
  const originalFetch = globalThis.fetch;
  let fetched = 0;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  globalThis.fetch = (async () => {
    fetched += 1;
    return new Response(null, { status: 500 });
  }) as typeof fetch;
  try {
    clearStorageEnv();
    process.env.NODE_ENV = "production";
    assert.equal(r2Ready(), false);
    const saved = await saveShopPhoto({
      kind: "listing",
      phoneHash: HASH,
      id: ID,
      main: Buffer.from("RIFF"),
      thumb: Buffer.from("RIFF"),
    }, dir);
    assert.deepEqual(saved, { ok: false, error: "storage" });
    assert.equal(fetched, 0);
    assert.equal((await readdir(dir)).length, 0);
    assert.deepEqual(errors, [["[souq] photo storage is not configured"]]);
    process.env.R2_PUBLIC_BASE = "http://media.souqbattuta.com";
    process.env.R2_ACCOUNT_ID = "abc";
    process.env.R2_BUCKET = "souq-media";
    process.env.R2_API_TOKEN = TOKEN;
    assert.equal(r2Ready(), false);
  } finally {
    console.error = originalError;
    globalThis.fetch = originalFetch;
    restoreEnv(prev);
    await rm(dir, { recursive: true, force: true });
  }
});

test("local dev can still write public media, and a failed R2 upload does not", async () => {
  const prev = rememberEnv();
  const dir = await mkdtemp(join(tmpdir(), "souq-photo-dev-"));
  const original = globalThis.fetch;
  try {
    clearStorageEnv();
    process.env.NODE_ENV = "development";
    const main = Buffer.from("RIFF-main");
    const thumb = Buffer.from("RIFF-thumb");
    const saved = await saveShopPhoto({ kind: "listing", phoneHash: HASH, id: ID, main, thumb }, dir);
    assert.deepEqual(saved, { ok: true, url: `/media/${ID}.webp`, thumbUrl: `/media/${ID}-thumb.webp` });
    assert.equal((await readFile(join(dir, `${ID}.webp`))).equals(main), true);
    clearStorageEnv();
    process.env.NODE_ENV = "development";
    process.env.R2_ACCOUNT_ID = "abc123";
    process.env.R2_BUCKET = "souq-media";
    process.env.R2_API_TOKEN = TOKEN;
    process.env.R2_PUBLIC_BASE = BASE;
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: false }), { status: 200 })) as typeof fetch;
    const failed = await saveShopPhoto({ kind: "hello", phoneHash: HASH, id: "c".repeat(16), main, thumb }, dir);
    assert.deepEqual(failed, { ok: false, error: "storage" });
    assert.equal((await readdir(dir)).includes(`${"c".repeat(16)}.webp`), false);
  } finally {
    globalThis.fetch = original;
    restoreEnv(prev);
    await rm(dir, { recursive: true, force: true });
  }
});
