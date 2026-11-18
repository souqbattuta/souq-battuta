/** How long a Hello World thumbnail stays after the 24-hour post ends. */

export type HelloPlan = "free" | "basic" | "grow" | "premium";

const DAY = 24 * 60 * 60 * 1000;
const GRACE = 5 * DAY;

export function normalizePlan(plan: string | null | undefined): HelloPlan {
  return plan === "basic" || plan === "grow" || plan === "premium" ? plan : "free";
}

/** A paid plan past its end date and the 5-day grace is treated as Free. */
export function effectivePlan(plan: string | null | undefined, planEnds: number | null | undefined, now: number): HelloPlan {
  const tier = normalizePlan(plan);
  if (tier === "free") return "free";
  if (planEnds && now > planEnds + GRACE) return "free";
  return tier;
}

/** Milliseconds to keep the thumbnail archive after expiry. null means no time limit. */
export function archiveKeepMs(plan: HelloPlan): number | null {
  if (plan === "free") return 0;
  if (plan === "basic") return 30 * DAY;
  if (plan === "grow") return 90 * DAY;
  return null;
}

export type HelloKeep = "live" | "archive" | "drop";

export function helloKeep(plan: HelloPlan, expiresAt: number, now: number): HelloKeep {
  if (expiresAt > now) return "live";
  const keep = archiveKeepMs(plan);
  if (keep === 0) return "drop";
  if (keep === null) return "archive";
  if (now >= expiresAt + keep) return "drop";
  return "archive";
}
