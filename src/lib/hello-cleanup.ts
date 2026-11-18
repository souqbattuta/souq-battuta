import { getSql, withSqlTransaction, type Sql } from "@/lib/db";
import { effectivePlan, helloKeep } from "@/lib/hello-archive";
import { deleteStoredObject, isOwnedMedia } from "@/lib/object-store";

type PostRow = {
  id: string;
  owner_phone: string;
  image_url: string | null;
  thumb_url: string | null;
  expires_at: string;
  status: string;
  plan: string | null;
  plan_ends: string | null;
};

function urlsOf(image: string | null, thumb: string | null) {
  return [...new Set([image, thumb].filter((url): url is string => Boolean(url && isOwnedMedia(url))))];
}

async function referenced(sql: Sql, url: string) {
  const rows = await sql<{ hit: number }>`
    select 1 as hit from souq_listings
    where image_url = ${url} or thumb_url = ${url} or images @> ${JSON.stringify([url])}::jsonb
    union all
    select 1 from souq_hello_posts
    where image_url = ${url} or thumb_url = ${url}
    limit 1
  `;
  return Boolean(rows[0]);
}

async function queue(sql: Sql, phone: string, urls: string[]) {
  for (const url of urls) {
    if (!isOwnedMedia(url)) continue;
    await sql`
      insert into souq_media_gc (url, owner_phone)
      values (${url}, ${phone})
      on conflict (url) do nothing
    `;
  }
}

/** Decide which expired posts to shrink or remove. Does not touch the file store. */
export async function planHelloSweep(sql: Sql, phone?: string) {
  const now = Date.now();
  const rows = phone
    ? await sql<PostRow>`
        select p.id, p.owner_phone, p.image_url, p.thumb_url, p.expires_at, p.status, a.plan,
               a.data->>'planEnds' as plan_ends
        from souq_hello_posts p
        join souq_accounts a on a.phone = p.owner_phone
        where p.owner_phone = ${phone}
          and p.expires_at <= now()
          and p.status <> 'removed'
        order by p.expires_at
        limit 200
      `
    : await sql<PostRow>`
        select p.id, p.owner_phone, p.image_url, p.thumb_url, p.expires_at, p.status, a.plan,
               a.data->>'planEnds' as plan_ends
        from souq_hello_posts p
        join souq_accounts a on a.phone = p.owner_phone
        where p.expires_at <= now()
          and p.status <> 'removed'
          and (
            p.status = 'live'
            or coalesce(p.image_url, '') <> ''
            or coalesce(a.plan, 'free') = 'free'
            or (a.plan = 'basic' and p.expires_at <= now() - interval '30 days')
            or (a.plan = 'grow' and p.expires_at <= now() - interval '90 days')
            or (
              coalesce(nullif(a.data->>'planEnds', '')::bigint, 0) > 0
              and (a.data->>'planEnds')::bigint + ${5 * 24 * 60 * 60 * 1000} < ${now}
            )
          )
        order by p.expires_at
        limit 200
      `;
  let changed = 0;
  for (const row of rows) {
    const ends = Number(row.plan_ends || 0);
    const plan = effectivePlan(row.plan, Number.isFinite(ends) ? ends : 0, now);
    const fate = helloKeep(plan, new Date(row.expires_at).getTime(), now);
    if (fate === "live") continue;
    if (fate === "drop") {
      await queue(sql, row.owner_phone, urlsOf(row.image_url, row.thumb_url));
      await sql`delete from souq_hello_posts where id = ${row.id}`;
      changed += 1;
      continue;
    }
    const full = row.image_url && row.image_url !== row.thumb_url ? row.image_url : "";
    if (row.status === "archived" && !full) continue;
    if (full) await queue(sql, row.owner_phone, [full]);
    await sql`
      update souq_hello_posts
      set image_url = null, status = 'archived'
      where id = ${row.id}
    `;
    changed += 1;
  }
  return changed;
}

async function drainQueue(sql: Sql) {
  const queued = await sql<{ url: string }>`
    select url from souq_media_gc order by created_at limit 200
  `;
  let files = 0;
  for (const item of queued) {
    if (await referenced(sql, item.url)) {
      await sql`delete from souq_media_gc where url = ${item.url}`;
      continue;
    }
    const result = await deleteStoredObject(item.url);
    if (result === "skipped" && !item.url.startsWith("/media/") && isOwnedMedia(item.url)) continue;
    if (result === "deleted") files += 1;
    await sql`delete from souq_media_gc where url = ${item.url}`;
  }
  return files;
}

/** Drop expired full photos, apply the current tier's archive rule, then delete queued files. */
export async function sweepHelloStorage(phone?: string) {
  const changed = await withSqlTransaction(async (sql) => {
    await sql`select pg_advisory_xact_lock(hashtext('souq-hello-gc'))`;
    return planHelloSweep(sql, phone);
  });
  const sql = await getSql();
  const files = await drainQueue(sql);
  return { posts: changed, files };
}

export async function queueOwnedMedia(phone: string, urls: string[]) {
  const owned = urls.filter((url) => isOwnedMedia(url));
  if (!owned.length) return;
  await withSqlTransaction(async (sql) => {
    await queue(sql, phone, owned);
  });
}
