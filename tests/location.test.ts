import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyGeofence,
  getReviewFlags,
  getGpsAgeMs,
  locationFixSchema,
  validateFreshLocation,
} from "../src/lib/location.ts";

const now = Date.parse("2026-11-07T12:00:00.000Z");
const freshFix = {
  latitude: 14.6,
  longitude: 121.0,
  accuracyM: 12,
  gpsAcquiredAt: "2026-11-07T11:59:55.000Z",
};

test("location fixes require valid coordinates, accuracy, and offset timestamp", () => {
  assert.equal(locationFixSchema.safeParse(freshFix).success, true);
  assert.equal(locationFixSchema.safeParse({ ...freshFix, latitude: 91 }).success, false);
  assert.equal(locationFixSchema.safeParse({ ...freshFix, accuracyM: 0 }).success, false);
  assert.equal(locationFixSchema.safeParse({ ...freshFix, gpsAcquiredAt: "not-a-date" }).success, false);
});

test("stale GPS fixes are rejected, but low accuracy is flagged for review", () => {
  assert.doesNotThrow(() => validateFreshLocation(freshFix, now));
  assert.throws(
    () => validateFreshLocation({ ...freshFix, gpsAcquiredAt: "2026-11-07T11:50:00.000Z" }, now),
    /stale/i,
  );
  assert.deepEqual(getReviewFlags(240, "INSIDE", true, now, freshFix.gpsAcquiredAt), ["LOW_ACCURACY"]);
});

test("geofence classification accounts for GPS accuracy rather than only the point center", () => {
  assert.equal(classifyGeofence(20, 10, 100), "INSIDE");
  assert.equal(classifyGeofence(130, 10, 100), "OUTSIDE");
  assert.equal(classifyGeofence(95, 10, 100), "UNCERTAIN");
});

test("device acquisition time remains distinct from server receipt time", () => {
  assert.equal(getGpsAgeMs(freshFix.gpsAcquiredAt, now), 5_000);
  assert.deepEqual(
    getReviewFlags(12, "OUTSIDE", false, now, freshFix.gpsAcquiredAt),
    ["OUTSIDE_GEOFENCE", "MISSING_EVIDENCE"],
  );
});
