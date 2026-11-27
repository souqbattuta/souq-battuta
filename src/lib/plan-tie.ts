import { displayPlan } from "./data.ts";

/** Last tie-break only. Premium, then Pro (grow counts as Pro), then Basic. Free matches Basic while Free is off. */
export function planTie(plan: string | null | undefined) {
  const shown = displayPlan(plan);
  if (shown === "premium") return 3;
  if (shown === "pro") return 2;
  if (shown === "basic") return 1;
  return 0;
}
