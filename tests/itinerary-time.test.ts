import assert from "node:assert/strict";
import test from "node:test";
import { manilaInput, manilaInputToTimestamp } from "../src/lib/itinerary-time.ts";

test("builder uses Manila time and preserves timestamp milliseconds on edit", () => {
  const instant = "2026-11-07T16:30:45.123Z";
  const input = manilaInput(instant);
  assert.equal(input, "2026-11-08T00:30:45.123");
  assert.equal(new Date(manilaInputToTimestamp(input)!).toISOString(), instant);
});

test("builder supports optional and minute-precision times", () => {
  assert.equal(manilaInput(null), "");
  assert.equal(manilaInputToTimestamp(""), null);
  assert.equal(manilaInputToTimestamp("2026-11-08T09:30"), "2026-11-08T09:30:00+08:00");
});
