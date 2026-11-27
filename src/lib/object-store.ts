/** Store and delete shop photos. Missing files count as done, so a cleanup can run again. */

export type DeleteResult = "deleted" | "missing" | "skipped";

const OWNED_KEY = /^(?:listing|hello)\/[a-f0-9]{16,64}\/[a-f0-9]{8,32}(?:-thumb)?\.webp$/;

export function r2PublicBase(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.R2_PUBLIC_BASE?.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path && path !== "/" ? path : ""}`;
  } catch {
    return "";
  }
}

/** Preferred store. All four must be set, and the public base must be https. */
export function r2Ready(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.R2_ACCOUNT_ID?.trim() && env.R2_BUCKET?.trim() && env.R2_API_TOKEN?.trim() && r2PublicBase(env));
}

export function shopPhotoKey(kind: "listing" | "hello", phoneHash: string, id: string, thumb = false) {
  const hash = phoneHash.trim().toLowerCase();
  const name = id.trim().toLowerCase();
  if (!/^[a-f0-9]{16,64}$/.test(hash) || !/^[a-f0-9]{8,32}$/.test(name)) return "";
  return `${kind}/${hash}/${name}${thumb ? "-thumb" : ""}.webp`;
}

export function r2ObjectUrl(base: string, key: string) {
  return `${base.replace(/\/+$/, "")}/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function objectKey(url: string) {
  const got = new URL(url);
  let path = got.pathname;
  const base = r2PublicBase();
  if (base) {
    const pub = new URL(base);
    const prefix = pub.pathname.replace(/\/+$/, "");
    if (got.hostname === pub.hostname && prefix && (path === prefix || path.startsWith(`${prefix}/`))) {
      path = path.slice(prefix.length);
    }
  }
  const key = decodeURIComponent(path.replace(/^\/+/, ""));
  if (!key || key.includes("..")) return "";
  return key;
}

function onPublicBase(url: string) {
  const base = r2PublicBase();
  if (!base) return false;
  try {
    const pub = new URL(base);
    const got = new URL(url);
    if (got.protocol !== "https:" || got.hostname !== pub.hostname) return false;
    return OWNED_KEY.test(objectKey(url));
  } catch {
    return false;
  }
}

function ownable(url: string) {
  if (!url || url.startsWith("data:") || url.startsWith("/brand/")) return false;
  if (url.startsWith("/media/")) return true;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith(".blob.vercel-storage.com") || host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com")) return true;
  } catch {
    return false;
  }
  return onPublicBase(url);
}

export function isOwnedMedia(url: string) {
  return ownable(url);
}

async function deleteLocal(url: string): Promise<DeleteResult> {
  const name = url.slice("/media/".length).split("?")[0];
  if (!name || name.includes("..") || name.includes("/")) return "skipped";
  const { unlink } = await import("node:fs/promises");
  try {
    await unlink(`public/media/${name}`);
    return "deleted";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return "missing";
    throw error;
  }
}

async function deleteBlob(url: string): Promise<DeleteResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return "skipped";
  const { del } = await import("@vercel/blob");
  try {
    await del(url, { token });
    return "deleted";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not found|404|BlobNotFound|does not exist/i.test(message)) return "missing";
    throw error;
  }
}

async function deleteR2(url: string): Promise<DeleteResult> {
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const token = process.env.R2_API_TOKEN?.trim();
  if (!account || !bucket || !token) return "skipped";
  let key = "";
  try {
    key = objectKey(url);
  } catch {
    return "skipped";
  }
  if (!key) return "skipped";
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
  const res = await fetch(endpoint, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) return "missing";
  if (!res.ok) throw new Error(`R2 delete failed (${res.status})`);
  return "deleted";
}

export async function deleteStoredObject(url: string): Promise<DeleteResult> {
  if (!ownable(url)) return "skipped";
  if (url.startsWith("/media/")) return deleteLocal(url);
  if (url.includes(".blob.vercel-storage.com")) return deleteBlob(url);
  return deleteR2(url);
}

/** JPEG, PNG, or WebP in. WebP out, with GPS and the rest of EXIF left behind. */
export async function encodeShopPhoto(bytes: Buffer, kind: "listing" | "hello") {
  try {
    const sharp = (await import("sharp")).default;
    const longest = kind === "hello" ? 1080 : 1600;
    const picture = sharp(bytes, { failOn: "none" }).rotate();
    const main = await picture.clone().resize({ width: longest, height: longest, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const thumb = await picture.clone().resize({ width: 400, height: 400, fit: "cover" }).webp({ quality: 76 }).toBuffer();
    return { ok: true as const, main, thumb, type: "image/webp" as const };
  } catch {
    return { ok: false as const };
  }
}

async function putR2Object(key: string, body: Buffer) {
  const account = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const bucket = process.env.R2_BUCKET?.trim() ?? "";
  const token = process.env.R2_API_TOKEN?.trim() ?? "";
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/r2/buckets/${encodeURIComponent(bucket)}/objects/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
  const res = await fetch(endpoint, {
    method: "PUT",
    redirect: "manual",
    headers: { authorization: `Bearer ${token}`, "content-type": "image/webp" },
    body: new Uint8Array(body),
  });
  if (res.status < 200 || res.status >= 300) return false;
  const text = await res.text();
  if (!text) return true;
  try {
    const parsed = JSON.parse(text) as { success?: boolean };
    return parsed.success !== false;
  } catch {
    return true;
  }
}

async function uploadR2(kind: "listing" | "hello", phoneHash: string, id: string, main: Buffer, thumb: Buffer) {
  const base = r2PublicBase();
  const mainKey = shopPhotoKey(kind, phoneHash, id, false);
  const thumbKey = shopPhotoKey(kind, phoneHash, id, true);
  if (!base || !mainKey || !thumbKey) return null;
  if (!(await putR2Object(mainKey, main))) return null;
  if (!(await putR2Object(thumbKey, thumb))) {
    try {
      await deleteStoredObject(r2ObjectUrl(base, mainKey));
    } catch {
      /* the main object can be removed on a later sweep */
    }
    return null;
  }
  return { url: r2ObjectUrl(base, mainKey), thumbUrl: r2ObjectUrl(base, thumbKey) };
}

/** R2, then Vercel Blob, then a local file only outside production. */
export async function saveShopPhoto(
  input: { kind: "listing" | "hello"; phoneHash: string; id: string; main: Buffer; thumb: Buffer },
  localRoot = "public/media",
): Promise<{ ok: true; url: string; thumbUrl: string } | { ok: false; error: "storage" }> {
  if (r2Ready()) {
    try {
      const saved = await uploadR2(input.kind, input.phoneHash, input.id, input.main, input.thumb);
      if (!saved) return { ok: false, error: "storage" };
      return { ok: true, url: saved.url, thumbUrl: saved.thumbUrl };
    } catch {
      return { ok: false, error: "storage" };
    }
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) {
    const mainKey = shopPhotoKey(input.kind, input.phoneHash, input.id, false);
    const thumbKey = shopPhotoKey(input.kind, input.phoneHash, input.id, true);
    if (!mainKey || !thumbKey) return { ok: false, error: "storage" };
    const { put } = await import("@vercel/blob");
    const big = await put(mainKey, input.main, { access: "public", token, contentType: "image/webp" });
    const small = await put(thumbKey, input.thumb, { access: "public", token, contentType: "image/webp" });
    return { ok: true, url: big.url, thumbUrl: small.url };
  }
  if (process.env.NODE_ENV === "production") {
    console.error("[souq] photo storage is not configured");
    return { ok: false, error: "storage" };
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(localRoot, { recursive: true });
  await writeFile(`${localRoot}/${input.id}.webp`, input.main);
  await writeFile(`${localRoot}/${input.id}-thumb.webp`, input.thumb);
  return { ok: true, url: `/media/${input.id}.webp`, thumbUrl: `/media/${input.id}-thumb.webp` };
}
