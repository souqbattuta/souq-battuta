/** Daily cap on codes that go out over WhatsApp. Counts with hitRate. */
export const OTP_DAY_PHONE = 10;
export const OTP_DAY_IP = 20;
export const OTP_DAY_SECONDS = 24 * 60 * 60;

type Hit = (bucket: string, limit: number, windowSeconds: number) => Promise<boolean>;

/** Reserve one daily send. False when this phone or address is already at the cap. */
export async function allowDailyCodeSend(hit: Hit, ip: string, phone: string) {
  if (!(await hit(`ip:otp:day:${ip}`, OTP_DAY_IP, OTP_DAY_SECONDS))) return false;
  return hit(`phone:otp:day:${phone}`, OTP_DAY_PHONE, OTP_DAY_SECONDS);
}

/**
 * Signup send did not go out. A test code is accepted only when allowTest is
 * already true (flag on, and not production). Never stores 424242.
 */
export function signupUnsent(error: "unconfigured" | "send", allowTest: boolean) {
  if (error === "unconfigured" && allowTest) return { ok: true as const };
  return { ok: false as const, error };
}

/**
 * Password-reset send did not go out. Production (allowTest false) returns
 * unconfigured and does not store 424242. Other provider failures stay quiet.
 */
export function resetUnsent(error: "unconfigured" | "send", allowTest: boolean) {
  if (error === "unconfigured" && allowTest) return { ok: true as const, storeTest: true as const };
  if (error === "unconfigured") return { ok: false as const, error: "unconfigured" as const };
  return { ok: true as const, storeTest: false as const };
}
