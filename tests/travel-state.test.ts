import assert from "node:assert/strict";
import test from "node:test";
import { canSubmitMilestone } from "../src/lib/travel-state.ts";

test("arrival can only be submitted during an active trip", () => {
  assert.equal(canSubmitMilestone("IN_TRANSIT", "ARRIVAL", false), true);
  assert.equal(canSubmitMilestone("CHECKOUT_SUBMITTED", "ARRIVAL", false), false);
});

test("explicit check-out requires the same trip's submitted arrival", () => {
  assert.equal(canSubmitMilestone("ARRIVAL_SUBMITTED", "CHECKOUT", true), true);
  assert.equal(canSubmitMilestone("CHECKED_IN", "CHECKOUT", true), true);
  assert.equal(canSubmitMilestone("IN_TRANSIT", "CHECKOUT", false), false);
  assert.equal(canSubmitMilestone("CHECKED_OUT", "CHECKOUT", true), false);
});
