import assert from "node:assert/strict";
import test from "node:test";
import { archiveKeepMs, effectivePlan, helloKeep } from "./hello-archive.ts";

const DAY = 24 * 60 * 60 * 1000;

test("free drops the post as soon as it expires", () => {
  const expires = 1_000;
  assert.equal(helloKeep("free", expires, expires - 1), "live");
  assert.equal(helloKeep("free", expires, expires), "drop");
  assert.equal(archiveKeepMs("free"), 0);
});

test("basic keeps a thumbnail for 30 days, grow for 90, premium without a limit", () => {
  const expires = 10_000;
  assert.equal(helloKeep("basic", expires, expires + 30 * DAY - 1), "archive");
  assert.equal(helloKeep("basic", expires, expires + 30 * DAY), "drop");
  assert.equal(helloKeep("pro", expires, expires + 90 * DAY - 1), "archive");
  assert.equal(helloKeep("pro", expires, expires + 90 * DAY), "drop");
  assert.equal(helloKeep("premium", expires, expires + 400 * DAY), "archive");
  assert.equal(archiveKeepMs("premium"), null);
});

test("a dropped paid plan uses the free archive rule", () => {
  const now = 100 * DAY;
  assert.equal(effectivePlan("premium", now - 6 * DAY, now), "free");
  assert.equal(effectivePlan("premium", now - 4 * DAY, now), "premium");
  assert.equal(effectivePlan("basic", 0, now), "basic");
});
