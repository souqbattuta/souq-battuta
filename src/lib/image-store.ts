const DB = "souq-images";
const STORE = "files";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(key: string, value: string) {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbGet(key: string) {
  return openDb().then(
    (db) =>
      new Promise<string | undefined>((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
        req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

async function keyFor(value: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].slice(0, 10).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function walk(value: unknown, map: (src: string) => Promise<string>): Promise<unknown> {
  if (typeof value === "string") return value.startsWith("data:image") || value.startsWith("idb:") ? map(value) : value;
  if (Array.isArray(value)) return Promise.all(value.map((item) => walk(item, map)));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = await walk(item, map);
  return out;
}

export async function offloadImages(value: unknown) {
  if (typeof indexedDB === "undefined") return stripImages(value);
  try {
    return await walk(value, async (src) => {
      if (!src.startsWith("data:image")) return src;
      const key = await keyFor(src);
      await idbPut(key, src);
      return `idb:${key}`;
    });
  } catch {
    return stripImages(value);
  }
}

export async function hydrateImages(value: unknown) {
  if (typeof indexedDB === "undefined") return value;
  try {
    return await walk(value, async (src) => {
      if (!src.startsWith("idb:")) return src;
      return (await idbGet(src.slice(4))) || "";
    });
  } catch {
    return value;
  }
}

function stripImages(value: unknown): unknown {
  if (typeof value === "string") return value.startsWith("data:image") ? "" : value;
  if (Array.isArray(value)) return value.map(stripImages);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = stripImages(item);
  return out;
}

export function guardStorage() {
  if (typeof localStorage === "undefined") return;
  const flag = localStorage as Storage & { __souq?: boolean };
  if (flag.__souq) return;
  flag.__souq = true;
  const original = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    try {
      original(key, value);
    } catch (error) {
      const quota = error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22);
      if (!quota) throw error;
      freePhotoQuota();
      try {
        localStorage.removeItem(key);
      } catch {
        /* the old value is what filled the quota */
      }
      try {
        original(key, value);
      } catch {
        /* stay signed in even if this browser cannot store the session */
      }
    }
  };
}

guardStorage();

export function freePhotoQuota() {
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith("souq-src:")) drop.push(key);
    }
    drop.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage can already be locked */
  }
}
