import assert from "node:assert/strict";
import test from "node:test";
import { classifyError, HttpError, parseResetFromMessage } from "../dist/src/core/index.js";

test("parses daily free reset time", () => {
  const now = Date.UTC(2026, 9, 3, 10, 0, 0);
  const reset = parseResetFromMessage("Daily free limit reached. Try again in 23h 59m", now);
  assert.equal(reset, now + (23 * 60 + 59) * 60 * 1000);
});

test("classifies promotional quota separately from temporary 429", () => {
  const promo = classifyError(new HttpError(429, "Daily free limit reached. Try again in 12h"), 0);
  const temp = classifyError(new HttpError(429, "Too many requests"), 0);
  assert.equal(promo.kind, "PROMOTIONAL_QUOTA");
  assert.equal(promo.retrySameRoute, false);
  assert.equal(temp.kind, "TEMPORARY_RATE_LIMIT");
  assert.equal(temp.retrySameRoute, true);
});
