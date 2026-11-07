import assert from "node:assert/strict";
import test from "node:test";
import { readIdempotencyResponse } from "../src/lib/idempotency-response.ts";

test("idempotency responses support both object and legacy encoded object", () => {
  const response = { travelSessionId: "test-id", status: "IN_TRANSIT" };
  assert.deepEqual(readIdempotencyResponse(response), response);
  assert.deepEqual(readIdempotencyResponse(JSON.stringify(response)), response);
});

test("idempotency responses reject invalid stored values", () => {
  for (const value of [null, [], 1, "null", "[]", "not-json"]) {
    assert.throws(() => readIdempotencyResponse(value));
  }
});
