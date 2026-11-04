export const CAMPAIGN_STEPS = [
  { buyers: 60, months: 1 },
  { buyers: 80, months: 2 },
  { buyers: 100, months: 3 },
] as const;

export function campaignStanding(used: number) {
  const earned = CAMPAIGN_STEPS.reduce((months, step) => (used >= step.buyers ? step.months : months), 0);
  const next = CAMPAIGN_STEPS.find((step) => used < step.buyers) ?? null;
  return { earned, next, left: next ? next.buyers - used : 0 };
}

export function countCodeUses(accounts: Record<string, { role?: string; referral?: string }>, code: string) {
  const key = code.trim().toLowerCase();
  if (!key) return 0;
  return Object.values(accounts).filter((account) => account.role === "buyer" && account.referral?.trim().toLowerCase() === key).length;
}

export function mintSellerCode(taken: Iterable<string | undefined>) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const used = new Set(taken);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let body = "";
    for (let i = 0; i < 4; i += 1) body += alphabet[Math.floor(Math.random() * alphabet.length)];
    const code = `SB-${body}`;
    if (!used.has(code)) return code;
  }
  return `SB-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
