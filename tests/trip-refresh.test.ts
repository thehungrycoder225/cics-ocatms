import assert from "node:assert/strict";
import test from "node:test";
import { tryRefreshTripState } from "../src/lib/trip-refresh.ts";

test("successful refresh allows the confirmed trip state to be used", async () => {
  let calls = 0;
  const failure = await tryRefreshTripState(async () => { calls++; });
  assert.equal(failure, null);
  assert.equal(calls, 1);
});

test("a failed refresh reports the error and runs only once", async () => {
  let calls = 0;
  const failure = await tryRefreshTripState(async () => {
    calls++;
    throw new Error("Network unavailable");
  });
  assert.equal(failure, "Network unavailable");
  assert.equal(calls, 1);
});

test("refresh retry succeeds independently after a failure", async () => {
  let calls = 0;
  const refresh = async () => {
    calls++;
    if (calls === 1) throw new Error("State unavailable");
  };
  assert.equal(await tryRefreshTripState(refresh), "State unavailable");
  assert.equal(await tryRefreshTripState(refresh), null);
  assert.equal(calls, 2);
});

test("non-Error refresh failures are still surfaced", async () => {
  assert.equal(
    await tryRefreshTripState(async () => { throw "network failure"; }),
    "The trip state could not be refreshed.",
  );
});
