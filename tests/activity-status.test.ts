import assert from "node:assert/strict";
import test from "node:test";
import { getActivityStatus, getManilaDate } from "../src/lib/activity-status.ts";

test("activity status uses the Manila calendar date across UTC day boundaries", () => {
  assert.equal(getManilaDate(new Date("2026-11-09T16:30:00.000Z")), "2026-11-10");
  assert.equal(getManilaDate(new Date("2026-11-10T00:30:00.000Z")), "2026-11-10");
});

test("activity status transitions from upcoming to ongoing to completed by date", () => {
  assert.equal(getActivityStatus("2026-11-11", "2026-11-13", "2026-11-10"), "UPCOMING");
  assert.equal(getActivityStatus("2026-11-08", "2026-11-13", "2026-11-10"), "ONGOING");
  assert.equal(getActivityStatus("2026-11-08", "2026-11-10", "2026-11-11"), "COMPLETED");
});

test("activity start and end dates are inclusive", () => {
  assert.equal(getActivityStatus("2026-11-10", "2026-11-13", "2026-11-10"), "ONGOING");
  assert.equal(getActivityStatus("2026-11-08", "2026-11-10", "2026-11-10"), "ONGOING");
});

test("single-day activity changes status exactly at Manila midnight", () => {
  const startDate = "2026-11-10";
  const endDate = "2026-11-10";
  const cases = [
    ["2026-11-09T15:59:59.999Z", "2026-11-09", "UPCOMING"],
    ["2026-11-09T16:00:00.000Z", "2026-11-10", "ONGOING"],
    ["2026-11-10T15:59:59.999Z", "2026-11-10", "ONGOING"],
    ["2026-11-10T16:00:00.000Z", "2026-11-11", "COMPLETED"],
  ] as const;

  for (const [instant, expectedDate, expectedStatus] of cases) {
    const manilaDate = getManilaDate(new Date(instant));
    assert.equal(manilaDate, expectedDate, instant);
    assert.equal(getActivityStatus(startDate, endDate, manilaDate), expectedStatus, instant);
  }
});

test("Manila calendar boundaries handle year changes and leap days", () => {
  const cases = [
    ["2026-12-31T15:59:59.999Z", "2026-12-31", "UPCOMING"],
    ["2026-12-31T16:00:00.000Z", "2027-01-01", "ONGOING"],
    ["2027-01-01T16:00:00.000Z", "2027-01-02", "COMPLETED"],
  ] as const;

  for (const [instant, expectedDate, expectedStatus] of cases) {
    const manilaDate = getManilaDate(new Date(instant));
    assert.equal(manilaDate, expectedDate, instant);
    assert.equal(getActivityStatus("2027-01-01", "2027-01-01", manilaDate), expectedStatus, instant);
  }

  const leapDay = getManilaDate(new Date("2028-02-28T16:00:00.000Z"));
  assert.equal(leapDay, "2028-02-29");
  assert.equal(getActivityStatus("2028-02-29", "2028-03-01", leapDay), "ONGOING");
  const afterLeapDay = getManilaDate(new Date("2028-02-29T16:00:00.000Z"));
  assert.equal(afterLeapDay, "2028-03-01");
  assert.equal(getActivityStatus("2028-02-29", "2028-02-29", afterLeapDay), "COMPLETED");
});
