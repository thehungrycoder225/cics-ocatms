import assert from "node:assert/strict";
import test from "node:test";
import { formatRecordedLocation } from "../src/lib/participant-trip-display.ts";

test("a missing recorded fix is not presented as a location", () => {
  assert.equal(formatRecordedLocation({
    lastAccuracyM: null,
    lastGpsAcquiredAt: null,
    lastLocationReceivedAt: null,
  }), "Not reported. This is not a live location.");
});

test("recorded accuracy, acquisition and receipt are displayed together", () => {
  const gps = "2026-11-08T10:00:00Z";
  const received = "2026-11-08T10:00:05Z";
  const result = formatRecordedLocation({
    lastAccuracyM: 12.4,
    lastGpsAcquiredAt: gps,
    lastLocationReceivedAt: received,
  });
  assert.match(result, /Accuracy ±12 m/);
  assert.ok(result.includes(new Date(gps).toLocaleString("en-PH", { timeZone: "Asia/Manila" })));
  assert.ok(result.includes(new Date(received).toLocaleString("en-PH", { timeZone: "Asia/Manila" })));
  assert.match(result, /not a live location/);
});

test("partial recorded data does not fabricate missing timestamps", () => {
  const result = formatRecordedLocation({
    lastAccuracyM: 8,
    lastGpsAcquiredAt: null,
    lastLocationReceivedAt: null,
  });
  assert.match(result, /GPS acquisition time unavailable/);
  assert.match(result, /Server receipt time unavailable/);
  assert.match(result, /Accuracy ±8 m/);
});
