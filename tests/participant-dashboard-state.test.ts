import assert from "node:assert/strict";
import test from "node:test";
import { summarizeParticipantJourney } from "../src/lib/participant-dashboard-state.ts";

const notStarted = {
  sessionId: null,
  status: "NOT_STARTED",
  checkoutAt: null,
  checkoutReviewStatus: null,
};

test("empty journeys do not invent progress or a current stop", () => {
  assert.deepEqual(summarizeParticipantJourney([]), {
    visibleStops: 0,
    submittedCheckouts: 0,
    verifiedCheckouts: 0,
    currentStop: null,
    hasMultipleActiveStops: false,
  });
});

test("submitted and verified check-outs are counted separately", () => {
  const result = summarizeParticipantJourney([
    notStarted,
    { ...notStarted, checkoutAt: "2026-11-08T10:00:00Z", checkoutReviewStatus: "PENDING" },
    { ...notStarted, checkoutAt: "2026-11-08T11:00:00Z", checkoutReviewStatus: "VERIFIED" },
    { ...notStarted, checkoutReviewStatus: "VERIFIED" },
  ]);
  assert.equal(result.visibleStops, 4);
  assert.equal(result.submittedCheckouts, 2);
  assert.equal(result.verifiedCheckouts, 1);
});

test("one recorded open session is the current leg, not an unstarted stop", () => {
  const current = { ...notStarted, sessionId: "session-1", status: "IN_TRANSIT" };
  assert.equal(summarizeParticipantJourney([notStarted, current]).currentStop, current);
  assert.equal(summarizeParticipantJourney([notStarted]).currentStop, null);
});

test("submitted arrival and verified check-in remain open, while checkout is not active", () => {
  for (const status of ["ARRIVAL_SUBMITTED", "CHECKED_IN"]) {
    const stop = { ...notStarted, sessionId: "session-1", status };
    assert.equal(summarizeParticipantJourney([stop]).currentStop, stop);
  }
  const checkedOut = { ...notStarted, sessionId: "session-1", status: "CHECKOUT_SUBMITTED" };
  assert.equal(summarizeParticipantJourney([checkedOut]).currentStop, null);
});

test("ambiguous open sessions do not pick a current leg", () => {
  const result = summarizeParticipantJourney([
    { ...notStarted, sessionId: "session-1", status: "IN_TRANSIT" },
    { ...notStarted, sessionId: "session-2", status: "CHECKED_IN" },
  ]);
  assert.equal(result.currentStop, null);
  assert.equal(result.hasMultipleActiveStops, true);
});
