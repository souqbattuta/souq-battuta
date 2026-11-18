/** Delete one stored photo. Missing files count as done, so the job can run again. */

export type DeleteResult = "deleted" | "missing" | "skipped";

function ownable(url: string) {
  if (!url || url.startsWith("data:") || url.startsWith("/brand/")) return false;
  if (url.startsWith("/media/")) return true;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".blob.vercel-storage.com") || host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com");
  } catch {
    return false;
  }
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
  const account = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const token = process.env.R2_API_TOKEN;
  if (!account || !bucket || !token) return "skipped";
  let key = "";
  try {
    key = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
  } catch {
    return "skipped";
  }
  if (!key) return "skipped";
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${key.split("/").map(encodeURIComponent).join("/")}`;
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
