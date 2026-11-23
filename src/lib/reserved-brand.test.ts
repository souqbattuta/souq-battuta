import assert from "node:assert/strict";
import test from "node:test";
import { isReservedBrand, usernameKey } from "./reserved-brand.ts";

const reserved = [
  "Souq Battuta",
  "souq-battuta",
  "souqbattuta",
  "S00q Battuta",
  "سوق بطوطة",
  "سوق بطوطه",
  "Souq Battuta Official",
  "سوق بطوطة الرسمي",
  "battuta",
  "بطوطة",
  "بطوطه",
  "sooqbattuta",
  "سوق بطوطه",
  "Battuta Official",
  "battuta admin",
  "بطوطة الرسمي",
  "Souq Battuta Staff",
  "Souq Battuta Support",
  "بطوطة رسمي",
  "offic1al battuta",
  "battuta officia1",
  "بـطوطة",
  "بَطُوطَة",
];

const allowed = ["Hala Kitchen", "Namos", "The Souq", "Battuta Street", "butter shop", "admin", "hala.kitchen"];

test("reserved brand names and lookalikes are blocked", () => {
  for (const name of reserved) assert.equal(isReservedBrand(name), true, name);
});

test("ordinary shop names stay available", () => {
  for (const name of allowed) assert.equal(isReservedBrand(name), false, name);
});

test("username keys ignore case and extra space", () => {
  assert.equal(usernameKey("  Hala  Kitchen "), usernameKey("hala kitchen"));
  assert.notEqual(usernameKey("hala"), usernameKey("halak"));
});
