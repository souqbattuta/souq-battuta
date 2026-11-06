/** Production hosts must set these. They are never stored in the repo.
 * DATABASE_URL — durable Postgres. Required when NODE_ENV is production.
 * BLOB_READ_WRITE_TOKEN — Vercel Blob. Required in production; uploads fail instead of writing public/media.
 * SOUQ_ADMIN_PHONES — comma-separated owner phones allowed to open /admin.
 * SOUQ_ALLOW_TEST_OTP=1 — accepts 424242 only when NODE_ENV is not production.
 */
export function allowTestOtp(env: NodeJS.ProcessEnv = process.env) {
  return env.SOUQ_ALLOW_TEST_OTP === "1" && env.NODE_ENV !== "production";
}

export function productionDatabaseMissing(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" && !env.DATABASE_URL?.trim();
}
