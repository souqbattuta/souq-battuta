/** Production hosts must set these. They are never stored in the repo.
 * DATABASE_URL — durable Postgres. Required when NODE_ENV is production.
 * R2_ACCOUNT_ID, R2_BUCKET, R2_API_TOKEN, R2_PUBLIC_BASE — Cloudflare R2. Preferred photo store.
 * BLOB_READ_WRITE_TOKEN — Vercel Blob, used when R2 is not set. Production uploads fail closed instead of writing public/media.
 * SOUQ_ADMIN_PHONES — comma-separated owner phones allowed to open /admin.
 * SOUQ_ALLOW_TEST_OTP=1 — accepts 424242 only when NODE_ENV is not production.
 */
export const FREE_TIER_ENABLED = false;

export function allowTestOtp(env: NodeJS.ProcessEnv = process.env) {
  return env.SOUQ_ALLOW_TEST_OTP === "1" && env.NODE_ENV !== "production";
}

export function productionDatabaseMissing(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" && !env.DATABASE_URL?.trim();
}
