import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copy } from "./i18n.ts";
import { allowDailyCodeSend, resetUnsent, signupUnsent } from "./otp-limit.ts";
import { allowTestOtp } from "./runtime-flags.ts";

test("the OTP page does not mention the test code", () => {
  assert.equal(copy.en.otpBody.includes("424242"), false);
  assert.equal(copy.ar.otpBody.includes("424242"), false);
  assert.match(copy.en.otpBody, /five minutes/);
  assert.match(copy.ar.otpBody, /خمس دقائق/);
  assert.equal(copy.en.otpRate, "Too many codes were sent. Wait and try again.");
  assert.match(copy.ar.otpRate, /أُرسلت رموز كثيرة/);
  const plan = readFileSync(new URL("../routes/join.seller_.plan.tsx", import.meta.url), "utf8");
  const otp = readFileSync(new URL("../routes/otp.tsx", import.meta.url), "utf8");
  assert.equal(plan.includes("424242"), false);
  assert.equal(otp.includes("424242"), false);
  const forgot = readFileSync(new URL("../routes/forgot.tsx", import.meta.url), "utf8");
  assert.match(forgot, /import\.meta\.env\.DEV &&/);
});

test("424242 is stored only when the test flag is on and this is not production", () => {
  const production = allowTestOtp({ SOUQ_ALLOW_TEST_OTP: "1", NODE_ENV: "production" });
  assert.equal(production, false);
  const liveReset = resetUnsent("unconfigured", production);
  assert.equal(liveReset.ok, false);
  const liveSignup = signupUnsent("unconfigured", production);
  assert.equal(liveSignup.ok, false);
  if (!liveSignup.ok) assert.equal(liveSignup.error, "unconfigured");

  const local = allowTestOtp({ SOUQ_ALLOW_TEST_OTP: "1", NODE_ENV: "development" });
  assert.equal(local, true);
  const devReset = resetUnsent("unconfigured", local);
  assert.equal(devReset.ok, true);
  if (devReset.ok) assert.equal(devReset.storeTest, true);
  assert.equal(signupUnsent("unconfigured", local).ok, true);
  const providerDown = resetUnsent("send", local);
  assert.equal(providerDown.ok, true);
  if (providerDown.ok) assert.equal(providerDown.storeTest, false);
  assert.equal(allowTestOtp({ NODE_ENV: "development" }), false);
});

function counter() {
  const hits = new Map<string, number>();
  return async (bucket: string, limit: number) => {
    const next = (hits.get(bucket) ?? 0) + 1;
    hits.set(bucket, next);
    return next <= limit;
  };
}

test("the eleventh code to the same number in a day is refused", async () => {
  const hit = counter();
  const phone = "+962795636663";
  for (let n = 0; n < 10; n += 1) {
    assert.equal(await allowDailyCodeSend(hit, `203.0.113.${n}`, phone), true);
  }
  assert.equal(await allowDailyCodeSend(hit, "203.0.113.99", phone), false);
});

test("the twenty-first code from the same address in a day is refused", async () => {
  const hit = counter();
  const ip = "198.51.100.10";
  for (let n = 0; n < 20; n += 1) {
    assert.equal(await allowDailyCodeSend(hit, ip, `+96279000${String(n).padStart(4, "0")}`), true);
  }
  assert.equal(await allowDailyCodeSend(hit, ip, "+962791111111"), false);
});
